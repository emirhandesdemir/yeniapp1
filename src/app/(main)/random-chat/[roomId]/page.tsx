
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCheck, UserX, LogOut, AlertTriangle, UserPlus, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  deleteDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type OneOnOneChatRoomStatus = 'waiting' | 'active' | 'closed_by_leave' | 'closed_by_decline' | 'friends_chat' | 'closed';

interface ParticipantData {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  decision: 'pending' | 'yes' | 'no';
  hasLeft: boolean;
}

interface OneOnOneChatRoom {
  id: string;
  participantUids: string[];
  participantsData: { [key: string]: ParticipantData }; // key is uid
  status: OneOnOneChatRoomStatus;
  createdAt: Timestamp;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp | null;
  isOwn?: boolean;
}

export default function RandomChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { currentUser, userData, isUserLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [roomDetails, setRoomDetails] = useState<OneOnOneChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherParticipant, setOtherParticipant] = useState<ParticipantData | null>(null);
  
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); 

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasNavigatedAwayRef = useRef(false);
  const roomUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const cleanupRoomAndNavigate = useCallback(async (currentRoomId: string, reason: string) => {
    if (hasNavigatedAwayRef.current) return;
    hasNavigatedAwayRef.current = true;

    // console.log(`cleanupRoomAndNavigate called for room ${currentRoomId} due to: ${reason}`);
    toast({ title: "Sohbet Sona Erdi", description: reason, variant: "default" });
    
    if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
    if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();

    try {
      const roomRef = doc(db, "oneOnOneChats", currentRoomId);
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        // Delete messages sub-collection first
        const messagesQuery = query(collection(db, `oneOnOneChats/${currentRoomId}/messages`));
        const messagesSnapshot = await getDocs(messagesQuery);
        const batch = writeBatch(db);
        messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
        await batch.commit(); // Commit message deletions
        
        // Then delete the room document itself
        await deleteDoc(roomRef);
      }
    } catch (error) {
      console.error("Error cleaning up room:", currentRoomId, error);
      // toast({ title: "Temizleme Hatası", description: "Oda temizlenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      router.replace("/matchmaking");
    }
  }, [router, toast]);


  useEffect(() => {
    if (!roomId || !currentUser) {
      if (!loadingRoom && !hasNavigatedAwayRef.current) router.replace("/matchmaking");
      return;
    }

    hasNavigatedAwayRef.current = false;
    setLoadingRoom(true);
    const roomRef = doc(db, "oneOnOneChats", roomId);

    roomUnsubscribeRef.current = onSnapshot(roomRef, (docSnap) => {
      if (hasNavigatedAwayRef.current) return;

      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<OneOnOneChatRoom, 'id'>;
        const currentRoomData = { id: docSnap.id, ...data };
        setRoomDetails(currentRoomData);

        const myUid = currentUser.uid;
        const otherUid = currentRoomData.participantUids.find(uid => uid !== myUid);

        if (otherUid && currentRoomData.participantsData[otherUid]) {
          setOtherParticipant(currentRoomData.participantsData[otherUid]);
        } else if (currentRoomData.status !== 'waiting' && currentRoomData.participantUids.length === 2 && !otherUid) {
            // This case implies something is wrong, a participant is missing
            cleanupRoomAndNavigate(roomId, "Katılımcı bilgisi eksik, oda kapatılıyor.");
            return;
        }
        
        const myData = currentRoomData.participantsData[myUid];

        if (currentRoomData.status === 'closed' || 
            currentRoomData.status === 'closed_by_leave' || 
            currentRoomData.status === 'closed_by_decline') {
          cleanupRoomAndNavigate(roomId, "Bu sohbet oturumu sona erdi.");
          return;
        }
        
        if (myData?.hasLeft && currentRoomData.status !== 'friends_chat') {
          cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız.");
          return;
        }
        
        if (otherUid && currentRoomData.participantsData[otherUid]?.hasLeft && currentRoomData.status !== 'friends_chat') {
          // Other user left, current user should also be marked as left and room closed
          if (!myData?.hasLeft) { // Avoid redundant updates
            updateDoc(roomRef, { 
              [`participantsData.${myUid}.hasLeft`]: true,
              status: "closed_by_leave"
            }).catch(e => console.error("Error updating self as left after other left: ", e));
             // The status change to closed_by_leave will trigger cleanupRoomAndNavigate in the next snapshot
          }
          return;
        }

        if (currentRoomData.status === 'active' && otherUid) {
          const myDecision = myData?.decision;
          const otherDecision = currentRoomData.participantsData[otherUid]?.decision;

          if (myDecision === 'no' || otherDecision === 'no') {
            if (currentRoomData.status !== 'closed_by_decline') { // Avoid redundant updates
              updateDoc(roomRef, { status: "closed_by_decline" })
                  .catch(e => console.error("Error on decline status update: ", e));
              // Status change will trigger cleanup
            }
            return;
          }
          if (myDecision === 'yes' && otherDecision === 'yes' && currentRoomData.status !== 'friends_chat') {
            updateDoc(roomRef, { status: "friends_chat" })
            .then(async () => {
              if (otherParticipant && userData) {
                const myFriendRef = doc(db, `users/${myUid}/confirmedFriends`, otherParticipant.uid);
                const friendSnap = await getDoc(myFriendRef);
                if (!friendSnap.exists()) {
                  const batch = writeBatch(db);
                  batch.set(myFriendRef, {
                    displayName: otherParticipant.displayName,
                    photoURL: otherParticipant.photoURL,
                    addedAt: serverTimestamp()
                  });
                  const theirFriendRef = doc(db, `users/${otherParticipant.uid}/confirmedFriends`, myUid);
                  batch.set(theirFriendRef, {
                    displayName: userData.displayName,
                    photoURL: userData.photoURL,
                    addedAt: serverTimestamp()
                  });
                  await batch.commit();
                  toast({title: "Arkadaş Eklendi!", description: `${otherParticipant.displayName} ile artık arkadaşsınız.`});
                }
              }
            }).catch(e => console.error("Error updating to friends_chat: ", e));
          }
        }
        setLoadingRoom(false);
      } else { // Room does not exist
        cleanupRoomAndNavigate(roomId, "Sohbet odası bulunamadı veya silindi.");
      }
    }, (error) => {
      console.error("Error fetching 1v1 room details:", error);
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Oda bilgilerine erişilemiyor.");
    });

    // Listener for messages
    const messagesQuery = query(collection(db, `oneOnOneChats/${roomId}/messages`), orderBy("timestamp", "asc"));
    messagesUnsubscribeRef.current = onSnapshot(messagesQuery, (querySnapshot) => {
      if (hasNavigatedAwayRef.current) return;
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          timestamp: data.timestamp,
        });
      });
      setMessages(fetchedMessages.map(msg => ({
        ...msg,
        isOwn: msg.senderId === currentUser.uid, 
      })));
      setTimeout(() => scrollToBottom(), 0); 
    }, (error) => {
      console.error("Error fetching messages:", error);
      // Don't navigate away for message fetch errors, but log it.
    });


    return () => {
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
      // `handleLeaveLogic` will be called by the main unmount effect
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser]); // Removed cleanupRoomAndNavigate, userData, otherParticipant, loadingRoom


  const handleLeaveLogic = useCallback(async () => {
    if (!currentUser || !roomId || hasNavigatedAwayRef.current) return;

    hasNavigatedAwayRef.current = true; // Mark that we are initiating a leave
    if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
    if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
    
    // console.log(`handleLeaveLogic called for room ${roomId} by user ${currentUser.uid}`);

    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const roomData = roomSnap.data() as OneOnOneChatRoom;
        // Only update if not already left and room is not already in a terminal state by other means
        if (!roomData.participantsData[currentUser.uid]?.hasLeft && 
            !['closed', 'closed_by_leave', 'closed_by_decline'].includes(roomData.status)) {
              
          let newStatus: OneOnOneChatRoomStatus = roomData.status;
          const otherUid = roomData.participantUids.find(uid => uid !== currentUser.uid);
          const otherParticipantHasLeft = otherUid ? roomData.participantsData[otherUid]?.hasLeft : true;

          if (roomData.participantUids.length === 1 || otherParticipantHasLeft) {
            // If I am the last one or the other has already left, the room is fully closed.
            newStatus = 'closed_by_leave';
          } else {
            // If the other person is still there, just mark me as left, their client will see this and close.
            newStatus = 'closed_by_leave'; // Indicate one person left
          }

          await updateDoc(roomRef, {
            [`participantsData.${currentUser.uid}.hasLeft`]: true,
            status: newStatus,
          });

          // If I determined I am the last one effectively, I can initiate cleanup.
          if (newStatus === 'closed_by_leave' && (roomData.participantUids.length === 1 || otherParticipantHasLeft)) {
            // This will be caught by the onSnapshot listener of the (now ex) other user, or just cleanup
            cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız, oda kapatılıyor.");
            return; 
          }
        }
      }
    } catch (error) {
      console.error("Error during leave logic:", error);
    }
    // Fallback navigation if cleanup isn't triggered by status change
    if (!hasNavigatedAwayRef.current) { // Double check, as cleanupRoomAndNavigate sets it
        router.replace("/matchmaking");
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, roomId, router, cleanupRoomAndNavigate]); // cleanupRoomAndNavigate added

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
       // This is a best-effort attempt. Complex async logic here is unreliable.
       // The goal is to quickly mark the user as 'hasLeft'.
       if (currentUser && roomId && roomDetails && !['closed', 'closed_by_leave', 'closed_by_decline', 'friends_chat'].includes(roomDetails.status) && !hasNavigatedAwayRef.current) {
            // Fire-and-forget update. The onSnapshot listeners should handle the rest.
            const roomRef = doc(db, "oneOnOneChats", roomId);
            updateDoc(roomRef, { 
                [`participantsData.${currentUser.uid}.hasLeft`]: true,
                status: 'closed_by_leave' // Assume this if tab is closed abruptly
            }).catch(console.error);
       }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Call the leave logic when the component unmounts if not already navigated
      if (!hasNavigatedAwayRef.current) {
        handleLeaveLogic();
      }
    };
  }, [currentUser, roomId, roomDetails, handleLeaveLogic]);


  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (hasNavigatedAwayRef.current || !currentUser || !newMessage.trim() || !roomId || !roomDetails || !['active', 'friends_chat'].includes(roomDetails.status)) {
        toast({ title: "Gönderilemedi", description: "Mesaj göndermek için uygun durumda değilsiniz.", variant: "destructive" });
        return;
    }

    setIsSending(true);
    const tempMessage = newMessage;
    setNewMessage("");

    try {
      await addDoc(collection(db, `oneOnOneChats/${roomId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
      setNewMessage(tempMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleFriendDecision = async (decision: 'yes' | 'no') => {
    if (hasNavigatedAwayRef.current || !currentUser || !roomId || !roomDetails || !otherParticipant || actionLoading || roomDetails.status !== 'active') return;
    setActionLoading(true);
    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      await updateDoc(roomRef, {
        [`participantsData.${currentUser.uid}.decision`]: decision,
      });
      // The onSnapshot listener will handle the consequences (becoming friends or closing room)
    } catch (error) {
      console.error("Error making friend decision:", error);
      toast({ title: "Hata", description: "Kararınız kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoomButtonClick = async () => {
    if (hasNavigatedAwayRef.current) return;
    toast({ title: "Ayrılıyor...", description: "Sohbetten ayrılıyorsunuz..." });
    await handleLeaveLogic(); // This will set hasNavigatedAwayRef and handle navigation/cleanup
  };


  if (loadingRoom || authLoading || !currentUser || (!roomDetails && !hasNavigatedAwayRef.current)) { 
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet yükleniyor...</p>
      </div>
    );
  }
  
  // If roomDetails is null AFTER loading and we haven't started navigating away, it's an issue.
  if (!roomDetails && !loadingRoom && !hasNavigatedAwayRef.current) {
     cleanupRoomAndNavigate(roomId, "Oda verileri yüklenemedi veya oda mevcut değil.");
     return ( // Fallback UI during navigation
        <div className="flex flex-1 items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-destructive" />
            <p className="ml-2 text-lg text-destructive">Oda hatası, yönlendiriliyor...</p>
        </div>
     );
  }
  
  if (roomDetails?.status === 'waiting' && roomDetails.participantUids.includes(currentUser.uid) && roomDetails.participantUids.length === 1) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 space-y-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />
            <CardTitle className="text-2xl">Rakip Bekleniyor...</CardTitle>
            <CardDescription>Sizin için birisi aranıyor. Lütfen bekleyin.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleLeaveRoomButtonClick}>
                 İptal Et ve Geri Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const myCurrentDecision = roomDetails?.participantsData[currentUser.uid]?.decision;
  const canSendMessage = roomDetails && ['active', 'friends_chat'].includes(roomDetails.status);


  return (
    <div className="flex flex-col sm:flex-row flex-1 h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))] overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-card sm:rounded-l-xl shadow-lg overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <Button variant="ghost" size="icon" asChild className="sm:hidden flex-shrink-0 h-9 w-9">
              <Link href="/matchmaking" onClick={(e) => { e.preventDefault(); handleLeaveRoomButtonClick();}}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
              </Link>
            </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
              <AvatarImage src={otherParticipant?.photoURL || "https://placehold.co/40x40.png"} data-ai-hint="person avatar chat" />
              <AvatarFallback>{getAvatarFallbackText(otherParticipant?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate" title={otherParticipant?.displayName || "Bilinmeyen Kullanıcı"}>
                {otherParticipant?.displayName || "Bilinmeyen Kullanıcı"}
              </h2>
              <p className="text-xs text-muted-foreground truncate">ile rastgele sohbet</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-9 px-2.5" onClick={handleLeaveRoomButtonClick} disabled={hasNavigatedAwayRef.current || actionLoading}>
            <LogOut className="mr-1.5 h-4 w-4" /> Ayrıl
          </Button>
        </header>

        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}>
          {messages.length === 0 && canSendMessage && (
            <div className="text-center text-muted-foreground py-10 px-4">
                <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                <p className="text-lg font-medium">Henüz hiç mesaj yok.</p>
                <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p>
            </div>
          )}
          {(!canSendMessage && roomDetails?.status !== 'waiting') && (
             <div className="text-center text-destructive py-10 px-4">
                <AlertTriangle className="mx-auto h-16 w-16 text-destructive/80 mb-3" />
                <p className="text-lg font-semibold">Sohbet Kapalı</p>
                <p>Bu sohbet oturumu artık aktif değil.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
              {!msg.isOwn && (
                <Avatar className="h-7 w-7 self-end mb-1 flex-shrink-0">
                  <AvatarImage src={otherParticipant?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person talking" />
                  <AvatarFallback>{getAvatarFallbackText(otherParticipant?.displayName)}</AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col max-w-[70%] sm:max-w-[65%]`}>
                <div className={`p-2.5 sm:p-3 shadow-md ${
                  msg.isOwn
                    ? "bg-primary text-primary-foreground rounded-t-2xl rounded-l-2xl"
                    : "bg-secondary text-secondary-foreground rounded-t-2xl rounded-r-2xl"
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                <p className={`text-[10px] sm:text-xs mt-1 px-2 ${msg.isOwn ? "text-primary-foreground/60 text-right" : "text-muted-foreground/80 text-left"}`}>
                  {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Gönderiliyor..."}
                </p>
              </div>
              {msg.isOwn && userData && (
                <Avatar className="h-7 w-7 self-end mb-1 flex-shrink-0">
                  <AvatarImage src={userData.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar" />
                  <AvatarFallback>{getAvatarFallbackText(userData.displayName)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
          <div className="relative flex items-center gap-2">
            <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading || hasNavigatedAwayRef.current} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Emoji Ekle</span>
            </Button>
            <Input
              placeholder={!canSendMessage ? "Mesaj gönderilemez." : "Mesajınızı yazın..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
              autoComplete="off"
              disabled={!canSendMessage || isSending || authLoading || hasNavigatedAwayRef.current}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading || hasNavigatedAwayRef.current} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
                <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
                <span className="sr-only">Dosya Ekle</span>
              </Button>
              <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || authLoading || hasNavigatedAwayRef.current}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Gönder</span>
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Side Panel for Friend Decision - Adjusted for responsiveness */}
      {roomDetails && !['closed', 'closed_by_leave', 'closed_by_decline', 'waiting'].includes(roomDetails.status) && otherParticipant && (
        <Card className={cn(
            "bg-card flex flex-col sm:rounded-r-xl sm:border-l",
            "w-full sm:max-w-[220px] md:max-w-[240px] lg:max-w-[280px]", // Responsive max width
            "p-3 sm:p-4" 
        )}>
          <CardHeader className="text-center border-b pb-3 pt-2 sm:pb-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-2 sm:mb-3">
              <AvatarImage src={otherParticipant.photoURL || "https://placehold.co/80x80.png"} data-ai-hint="participant avatar large" />
              <AvatarFallback className="text-xl sm:text-2xl">{getAvatarFallbackText(otherParticipant.displayName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-base sm:text-lg truncate" title={otherParticipant.displayName || "Bilinmeyen Kullanıcı"}>{otherParticipant.displayName || "Bilinmeyen Kullanıcı"}</CardTitle>
            {roomDetails.status !== 'friends_chat' && <CardDescription className="text-xs sm:text-sm">ile tanıştın!</CardDescription>}
          </CardHeader>

          {roomDetails.status === 'friends_chat' ? (
            <CardContent className="flex-grow flex flex-col justify-center items-center p-3 sm:p-4 space-y-2">
                <UserCheck className="h-8 w-8 sm:h-10 sm:w-10 text-green-500 mx-auto mb-1 sm:mb-2"/>
                <p className="text-sm sm:text-base font-semibold text-green-600">Artık arkadaşsınız!</p>
                <p className="text-xs text-muted-foreground text-center">Sohbete devam edebilirsiniz.</p>
            </CardContent>
          ) : (
            <CardContent className="flex-grow flex flex-col justify-center items-center p-3 sm:p-4 space-y-2 sm:space-y-3">
              {myCurrentDecision === 'pending' ? (
                <>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    {otherParticipant.displayName || "Bu kullanıcıyı"} arkadaş olarak eklemek ister misin?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <Button 
                      size="sm"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm" 
                      onClick={() => handleFriendDecision('yes')}
                      disabled={actionLoading || hasNavigatedAwayRef.current}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="mr-1 sm:mr-2 h-4 w-4" />} Evet
                    </Button>
                    <Button 
                      size="sm"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm" 
                      onClick={() => handleFriendDecision('no')}
                      disabled={actionLoading || hasNavigatedAwayRef.current}
                    >
                       {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="mr-1 sm:mr-2 h-4 w-4" />} Hayır
                    </Button>
                  </div>
                </>
              ) : myCurrentDecision === 'yes' ? (
                  <div className="text-center space-y-1 sm:space-y-2">
                      <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mx-auto"/>
                      <p className="text-xs sm:text-sm text-green-600">Arkadaşlık isteği gönderildi.</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Diğer kullanıcının kararı bekleniyor...</p>
                      {roomDetails.participantsData[otherParticipant.uid]?.decision === 'yes' && 
                          <p className="text-[10px] sm:text-xs text-blue-500 font-semibold">Diğer kullanıcı da kabul etti!</p>
                      }
                      {roomDetails.participantsData[otherParticipant.uid]?.decision === 'no' && 
                           <p className="text-[10px] sm:text-xs text-red-500 font-semibold">Diğer kullanıcı reddetti.</p>
                      }
                  </div>
              ) : ( // myCurrentDecision === 'no'
                   <div className="text-center space-y-1 sm:space-y-2">
                      <UserX className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mx-auto"/>
                      <p className="text-xs sm:text-sm text-red-600">Arkadaş olarak eklemedin.</p>
                       <p className="text-[10px] sm:text-xs text-muted-foreground">Sohbet yakında kapanacak...</p>
                  </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
    