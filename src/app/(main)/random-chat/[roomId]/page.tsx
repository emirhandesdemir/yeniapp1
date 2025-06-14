
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCheck, UserX, LogOut, AlertTriangle, UserPlus, Sparkles, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent, useCallback, ChangeEvent } from "react";
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
  arrayRemove,
  arrayUnion
} from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type OneOnOneChatStatus = 'waiting' | 'active' | 'closed_by_leave' | 'closed_by_decline' | 'friends_chat' | 'closed';

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
  status: OneOnOneChatStatus;
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
  const [actionLoading, setActionLoading] = useState(false); // For friend decision buttons

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasLeftRoomRef = useRef(false); // To prevent multiple leave actions

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const cleanupRoom = useCallback(async (currentRoomId: string) => {
    try {
      const batch = writeBatch(db);
      const messagesQuery = query(collection(db, `oneOnOneChats/${currentRoomId}/messages`));
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
      batch.delete(doc(db, "oneOnOneChats", currentRoomId));
      await batch.commit();
    } catch (error) {
      console.error("Error cleaning up room:", error);
      // Don't toast here as it might be aggressive if both users try to cleanup
    }
  }, []);

  // Room and participant listener
  useEffect(() => {
    if (!roomId || !currentUser) return () => {};

    setLoadingRoom(true);
    const roomRef = doc(db, "oneOnOneChats", roomId);

    const unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<OneOnOneChatRoom, 'id'>;
        const currentRoomData = { id: docSnap.id, ...data };
        setRoomDetails(currentRoomData);

        const otherUid = currentRoomData.participantUids.find(uid => uid !== currentUser.uid);
        if (otherUid && currentRoomData.participantsData[otherUid]) {
          setOtherParticipant(currentRoomData.participantsData[otherUid]);
        } else if (currentRoomData.status !== 'waiting' && currentRoomData.participantUids.length === 2) {
            // Should not happen if data is consistent
            console.warn("Other participant data missing in active room.");
            setOtherParticipant(null);
        }


        if (currentRoomData.status === 'closed' || currentRoomData.status === 'closed_by_leave' || currentRoomData.status === 'closed_by_decline') {
          if (!hasLeftRoomRef.current) { // Prevent multiple navigations/toasts
            hasLeftRoomRef.current = true; // Mark as handled
            toast({ title: "Sohbet Kapandı", description: "Bu sohbet oturumu sona erdi.", variant: "destructive" });
            cleanupRoom(roomId); // Attempt cleanup
            router.replace("/matchmaking");
          }
          return;
        }
        
        // Check if other user has left
        if (otherUid && currentRoomData.participantsData[otherUid]?.hasLeft && currentRoomData.status !== 'friends_chat') {
            if(!hasLeftRoomRef.current){
                hasLeftRoomRef.current = true;
                toast({ title: "Kullanıcı Ayrıldı", description: "Diğer kullanıcı sohbetten ayrıldı. Oda kapatılıyor.", variant: "destructive" });
                updateDoc(roomRef, { status: "closed_by_leave", [`participantsData.${currentUser.uid}.hasLeft`]: true })
                    .then(() => cleanupRoom(roomId))
                    .catch(e => console.error("Error updating self as left and cleaning: ", e));
                router.replace("/matchmaking");
            }
            return;
        }

        // Check friend decisions if status is active (not yet friends_chat)
        if (currentRoomData.status === 'active' && otherUid) {
            const myDecision = currentRoomData.participantsData[currentUser.uid]?.decision;
            const otherDecision = currentRoomData.participantsData[otherUid]?.decision;

            if (myDecision === 'no' || otherDecision === 'no') {
                if(!hasLeftRoomRef.current){
                    hasLeftRoomRef.current = true;
                    toast({ title: "Arkadaşlık Reddedildi", description: "Oda kapatılıyor.", variant: "destructive" });
                    updateDoc(roomRef, { status: "closed_by_decline" })
                        .then(() => cleanupRoom(roomId))
                        .catch(e => console.error("Error on decline and cleaning: ", e));
                    router.replace("/matchmaking");
                }
                return;
            }
            if (myDecision === 'yes' && otherDecision === 'yes') {
                // Both accepted!
                updateDoc(roomRef, { status: "friends_chat" }); // This will be caught by next snapshot
                // Friendship creation logic handled in handleFriendDecision
            }
        }

      } else {
        // Room doesn't exist (maybe deleted by other user or timeout)
        if (!hasLeftRoomRef.current) {
            hasLeftRoomRef.current = true;
            toast({ title: "Sohbet Bulunamadı", description: "Bu sohbet odası artık mevcut değil.", variant: "destructive" });
            router.replace("/matchmaking");
        }
      }
      setLoadingRoom(false);
    }, (error) => {
      console.error("Error fetching 1v1 room details:", error);
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingRoom(false);
      router.replace("/matchmaking");
    });

    return () => {
      unsubscribeRoom();
    };
  }, [roomId, currentUser, router, toast, cleanupRoom]);


  // Messages listener
  useEffect(() => {
    if (!roomId || !currentUser) return;

    const messagesQuery = query(collection(db, `oneOnOneChats/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
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
        isOwn: msg.senderId === currentUser?.uid,
      })));
      setTimeout(() => scrollToBottom(), 0);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" });
    });

    return () => unsubscribeMessages();
  }, [roomId, currentUser?.uid, toast]);


  // Handle user leaving the page (cleanup)
  useEffect(() => {
    const handleBeforeUnload = async (event?: BeforeUnloadEvent) => {
      if (roomId && currentUser && roomDetails && roomDetails.status !== 'closed' && roomDetails.status !== 'friends_chat' && !hasLeftRoomRef.current) {
        hasLeftRoomRef.current = true; // Mark that leave is initiated
        const roomRef = doc(db, "oneOnOneChats", roomId);
        try {
            // Update user's status to hasLeft
            await updateDoc(roomRef, {
                [`participantsData.${currentUser.uid}.hasLeft`]: true,
            });

            // Check if the other user has also left or if this makes the room ready for closure
            const currentRoomSnap = await getDoc(roomRef);
            if (currentRoomSnap.exists()) {
                const currentRoomData = currentRoomSnap.data() as OneOnOneChatRoom;
                const otherUid = currentRoomData.participantUids.find(uid => uid !== currentUser.uid);
                if (otherUid && currentRoomData.participantsData[otherUid]?.hasLeft) {
                    // If other user also left, this client can attempt cleanup
                    await cleanupRoom(roomId);
                } else if (!otherUid || currentRoomData.participantUids.length < 2) {
                    // If current user was the only one left or waiting, cleanup
                    await cleanupRoom(roomId);
                }
                // Otherwise, the other user's listener will handle full cleanup
            }
        } catch (error) {
          console.error("Error during cleanup on unmount/beforeunload:", error);
        }
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Call handleBeforeUnload also on component unmount for SPA navigations
      handleBeforeUnload(); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, roomDetails, cleanupRoom]); // Ensure roomDetails is a dependency

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
    if (!currentUser || !newMessage.trim() || !roomId || roomDetails?.status !== 'active' && roomDetails?.status !== 'friends_chat') return;

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
    if (!currentUser || !roomId || !roomDetails || !otherParticipant || actionLoading) return;
    setActionLoading(true);
    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      await updateDoc(roomRef, {
        [`participantsData.${currentUser.uid}.decision`]: decision,
      });

      // Decision logic will be handled by the onSnapshot listener reacting to this change.
      // If 'yes', and other also 'yes', it will create friendship.
      // If 'no', it will close room.
      if (decision === 'yes' && roomDetails.participantsData[otherParticipant.uid]?.decision === 'yes') {
        // Both decided yes, let's ensure friendship is created by current user as well
        // (snapshot listener might have already triggered if other user was faster)
        const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, otherParticipant.uid);
        const theirFriendRef = doc(db, `users/${otherParticipant.uid}/confirmedFriends`, currentUser.uid);
        const myUserData = userData; // from useAuth()
        const otherUserData = otherParticipant; // from state

        const batch = writeBatch(db);
        batch.set(myFriendRef, {
          displayName: otherUserData.displayName,
          photoURL: otherUserData.photoURL,
          addedAt: serverTimestamp()
        });
        batch.set(theirFriendRef, {
          displayName: myUserData?.displayName,
          photoURL: myUserData?.photoURL,
          addedAt: serverTimestamp()
        });
        // Remove pending friend requests if any
        const reqQuery1 = query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", otherParticipant.uid), where("status", "==", "pending"));
        const reqQuery2 = query(collection(db, "friendRequests"), where("fromUserId", "==", otherParticipant.uid), where("toUserId", "==", currentUser.uid), where("status", "==", "pending"));
        
        const [snap1, snap2] = await Promise.all([getDocs(reqQuery1), getDocs(reqQuery2)]);
        snap1.forEach(doc => batch.delete(doc.ref));
        snap2.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        toast({title: "Arkadaş Eklendi!", description: `${otherParticipant.displayName} ile artık arkadaşsınız.`});
        await updateDoc(roomRef, { status: "friends_chat" });
      }

    } catch (error) {
      console.error("Error making friend decision:", error);
      toast({ title: "Hata", description: "Kararınız kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveAndDeleteRoom = async () => {
    if (!currentUser || !roomId || hasLeftRoomRef.current) return;
    hasLeftRoomRef.current = true; // Mark that leave is initiated by this user
    toast({ title: "Ayrılıyor...", description: "Sohbetten ayrılıyorsunuz ve oda siliniyor." });
    
    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      // Set my status as left and close the room
      await updateDoc(roomRef, {
        [`participantsData.${currentUser.uid}.hasLeft`]: true,
        status: 'closed_by_leave' 
      });
      // The useEffect snapshot listener on other client will see status change and also hasLeft, then redirect.
      // This client will also redirect due to status change via its own listener.
      // Cleanup will be attempted by the listener when status is 'closed_by_leave'.
    } catch (error) {
      console.error("Error leaving and deleting room:", error);
      toast({ title: "Hata", description: "Odadan ayrılırken bir sorun oluştu.", variant: "destructive" });
      router.replace("/matchmaking"); // Fallback redirect
    }
  };


  if (loadingRoom || authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet yükleniyor...</p>
      </div>
    );
  }
  
  if (!roomDetails || !currentUser) {
     // This case should be handled by the useEffect redirecting if room/user not found
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="ml-2 text-lg text-destructive">Sohbet odası bulunamadı veya yüklenemedi.</p>
         <Button asChild variant="link" className="mt-4"><Link href="/matchmaking">Eşleşmeye geri dön</Link></Button>
      </div>
    );
  }

  if (roomDetails.status === 'waiting' && roomDetails.participantUids.includes(currentUser.uid)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 space-y-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />
            <CardTitle className="text-2xl">Rakip Bekleniyor...</CardTitle>
            <CardDescription>Sizin için birisi aranıyor. Lütfen bekleyin.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => router.push('/matchmaking')}>
                <XCircle className="mr-2 h-5 w-5" /> Eşleşmeyi İptal Et
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const myCurrentDecision = roomDetails.participantsData[currentUser.uid]?.decision;
  const canSendMessage = roomDetails.status === 'active' || roomDetails.status === 'friends_chat';


  return (
    <div className="flex flex-1 h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))]">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-card rounded-l-xl shadow-lg overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <Button variant="ghost" size="icon" asChild className="md:hidden flex-shrink-0 h-9 w-9">
              <Link href="/matchmaking">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
              </Link>
            </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
              <AvatarImage src={otherParticipant?.photoURL || "https://placehold.co/40x40.png"} data-ai-hint="person avatar chat" />
              <AvatarFallback>{getAvatarFallbackText(otherParticipant?.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate">
                {otherParticipant?.displayName || "Bilinmeyen Kullanıcı"}
              </h2>
              <p className="text-xs text-muted-foreground">ile rastgele sohbet</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90" onClick={handleLeaveAndDeleteRoom} disabled={hasLeftRoomRef.current}>
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
          {!canSendMessage && roomDetails.status !== 'waiting' && (
             <div className="text-center text-destructive py-10 px-4">
                <AlertTriangle className="mx-auto h-16 w-16 text-destructive/80 mb-3" />
                <p className="text-lg font-semibold">Sohbet Kapalı</p>
                <p>Bu sohbet oturumu artık aktif değil.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
              {!msg.isOwn && (
                <Avatar className="h-7 w-7 self-end mb-1">
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
                <Avatar className="h-7 w-7 self-end mb-1">
                  <AvatarImage src={userData.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar" />
                  <AvatarFallback>{getAvatarFallbackText(userData.displayName)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
          <div className="relative flex items-center gap-2">
            <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Emoji Ekle</span>
            </Button>
            <Input
              placeholder={!canSendMessage ? "Mesaj gönderilemez." : "Mesajınızı yazın..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
              autoComplete="off"
              disabled={!canSendMessage || isSending || authLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
                <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
                <span className="sr-only">Dosya Ekle</span>
              </Button>
              <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || authLoading}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Gönder</span>
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Side Panel for Friend Decision */}
      {roomDetails.status !== 'closed' && roomDetails.status !== 'closed_by_leave' && roomDetails.status !== 'closed_by_decline' && roomDetails.status !== 'friends_chat' && otherParticipant && (
        <Card className="w-64 sm:w-72 border-l-0 rounded-l-none rounded-r-xl shadow-lg flex flex-col">
          <CardHeader className="text-center border-b pb-4">
            <Avatar className="h-20 w-20 mx-auto mb-3">
              <AvatarImage src={otherParticipant.photoURL || "https://placehold.co/80x80.png"} data-ai-hint="participant avatar large" />
              <AvatarFallback className="text-2xl">{getAvatarFallbackText(otherParticipant.displayName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg">{otherParticipant.displayName || "Bilinmeyen Kullanıcı"}</CardTitle>
            <CardDescription>ile tanıştın!</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-center items-center p-4 space-y-3">
            {myCurrentDecision === 'pending' ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  {otherParticipant.displayName || "Bu kullanıcıyı"} arkadaş olarak eklemek ister misin?
                </p>
                <div className="flex gap-3 w-full">
                  <Button 
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white" 
                    onClick={() => handleFriendDecision('yes')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4" />} Evet
                  </Button>
                  <Button 
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white" 
                    onClick={() => handleFriendDecision('no')}
                    disabled={actionLoading}
                  >
                     {actionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="mr-2 h-4 w-4" />} Hayır
                  </Button>
                </div>
              </>
            ) : myCurrentDecision === 'yes' ? (
                <div className="text-center space-y-2">
                    <UserPlus className="h-8 w-8 text-green-500 mx-auto"/>
                    <p className="text-sm text-green-600">Arkadaşlık isteği gönderildi.</p>
                    <p className="text-xs text-muted-foreground">Diğer kullanıcının kararı bekleniyor...</p>
                    {roomDetails.participantsData[otherParticipant.uid]?.decision === 'yes' && 
                        <p className="text-xs text-blue-500 font-semibold">Diğer kullanıcı da kabul etti!</p>
                    }
                    {roomDetails.participantsData[otherParticipant.uid]?.decision === 'no' && 
                         <p className="text-xs text-red-500 font-semibold">Diğer kullanıcı reddetti.</p>
                    }
                </div>
            ) : ( // myCurrentDecision === 'no'
                 <div className="text-center space-y-2">
                    <UserX className="h-8 w-8 text-red-500 mx-auto"/>
                    <p className="text-sm text-red-600">Arkadaş olarak eklemedin.</p>
                     <p className="text-xs text-muted-foreground">Sohbet yakında kapanacak...</p>
                </div>
            )}
          </CardContent>
        </Card>
      )}
      {roomDetails.status === 'friends_chat' && otherParticipant && (
         <Card className="w-64 sm:w-72 border-l-0 rounded-l-none rounded-r-xl shadow-lg flex flex-col">
           <CardHeader className="text-center border-b pb-4">
             <Avatar className="h-20 w-20 mx-auto mb-3">
              <AvatarImage src={otherParticipant.photoURL || "https://placehold.co/80x80.png"} data-ai-hint="friend avatar" />
              <AvatarFallback className="text-2xl">{getAvatarFallbackText(otherParticipant.displayName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg">{otherParticipant.displayName || "Bilinmeyen Kullanıcı"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-center items-center p-4 space-y-3">
             <UserCheck className="h-10 w-10 text-green-500 mx-auto mb-2"/>
             <p className="text-sm font-semibold text-green-600">Artık arkadaşsınız!</p>
             <p className="text-xs text-muted-foreground">Sohbete devam edebilirsiniz.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
