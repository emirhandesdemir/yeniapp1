
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCheck, UserX, LogOut, AlertTriangle, UserPlus, MessageSquare, Clock } from "lucide-react"; // Clock eklendi
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

export type OneOnOneChatRoomStatus = 'waiting' | 'active' | 'closed_by_leave' | 'closed_by_decline' | 'friends_chat' | 'closed';

export interface ParticipantData {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  decision: 'pending' | 'yes' | 'no';
  hasLeft: boolean;
}

export interface OneOnOneChatRoom {
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

const WAITING_TIMEOUT_SECONDS = 30; // Timeout for a user waiting in a 'waiting' room

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
  const [waitingCountdown, setWaitingCountdown] = useState(WAITING_TIMEOUT_SECONDS);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasNavigatedAwayRef = useRef(false);
  const roomUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const cleanupRoomAndNavigate = useCallback(async (currentRoomId: string, reason: string, isError: boolean = false) => {
    if (hasNavigatedAwayRef.current) return;
    hasNavigatedAwayRef.current = true;

    // console.log(`cleanupRoomAndNavigate called for room ${currentRoomId} due to: ${reason}`);
    toast({ title: "Sohbet Sona Erdi", description: reason, variant: isError ? "destructive" : "default" });
    
    if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
    if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
    if (waitingTimeoutRef.current) clearInterval(waitingTimeoutRef.current);


    try {
      const roomRef = doc(db, "oneOnOneChats", currentRoomId);
      const roomSnap = await getDoc(roomRef);

      // Only delete if the room still exists and current user is a participant or was involved
      // This prevents accidental deletion if another process already handled it.
      if (roomSnap.exists()) {
         const roomData = roomSnap.data() as OneOnOneChatRoom;
         // The user initiating the cleanup (e.g., by leaving, or client-side timeout) should be responsible.
         // Or, if status is already terminal (closed by other), just navigate.
         let shouldDelete = false;
         if (currentUser && roomData.participantUids.includes(currentUser.uid)) {
            if (roomData.status === 'waiting' && roomData.participantUids.length === 1) { // Waiting room timeout
                shouldDelete = true;
            } else if (roomData.status === 'closed_by_leave' || roomData.status === 'closed_by_decline') {
                // If one user leaves/declines, and this client is processing that.
                // The one who sets hasLeft=true or makes decision='no' effectively triggers this.
                // The *last* one to acknowledge might do the delete.
                // Or, the one whose action *caused* the terminal state.
                const myData = roomData.participantsData[currentUser.uid];
                if (myData?.hasLeft || myData?.decision === 'no') {
                    shouldDelete = true;
                } else {
                    // If other left/declined and I'm just reacting, let their client handle delete or rely on a server function.
                    // For now, if I'm the remaining one seeing the other left, I will clean up.
                    const otherUid = roomData.participantUids.find(uid => uid !== currentUser.uid);
                    if (otherUid && roomData.participantsData[otherUid]?.hasLeft) shouldDelete = true;
                    if (otherUid && roomData.participantsData[otherUid]?.decision === 'no') shouldDelete = true;
                }
            }
         }


        if (shouldDelete) {
            // console.log(`Deleting room ${currentRoomId} and its messages.`);
            const messagesQuery = query(collection(db, `oneOnOneChats/${currentRoomId}/messages`));
            const messagesSnapshot = await getDocs(messagesQuery);
            const batch = writeBatch(db);
            messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
            await batch.commit(); 
            
            await deleteDoc(roomRef);
        } else {
            // console.log(`Not deleting room ${currentRoomId}. ShouldDelete: ${shouldDelete}, Room status: ${roomData?.status}`);
        }
      }
    } catch (error) {
      console.error("Error cleaning up room:", currentRoomId, error);
    } finally {
      router.replace("/matchmaking");
    }
  }, [router, toast, currentUser]);


  useEffect(() => {
    // Reset hasNavigatedAwayRef if roomId or currentUser changes, signifying a new context.
    hasNavigatedAwayRef.current = false;
  }, [roomId, currentUser]);


  useEffect(() => {
    if (!roomId || !currentUser) {
      if (!authLoading && !currentUser && !hasNavigatedAwayRef.current) {
        router.replace("/matchmaking");
      }
      return;
    }
    
    // console.log(`[RandomChat ${roomId}] Main useEffect. CurrentUser: ${currentUser.uid}, HasNavigated: ${hasNavigatedAwayRef.current}`);
    setLoadingRoom(true);
    const roomRef = doc(db, "oneOnOneChats", roomId);

    roomUnsubscribeRef.current = onSnapshot(roomRef, (docSnap) => {
      if (hasNavigatedAwayRef.current) return;
      // console.log(`[RandomChat ${roomId}] Room snapshot received. Exists: ${docSnap.exists()}`);

      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<OneOnOneChatRoom, 'id'>;
        const currentRoomData = { id: docSnap.id, ...data };
        setRoomDetails(currentRoomData);
        // console.log(`[RandomChat ${roomId}] Room details set. Status: ${currentRoomData.status}`);

        const myUid = currentUser.uid;
        const otherUid = currentRoomData.participantUids.find(uid => uid !== myUid);

        if (otherUid && currentRoomData.participantsData[otherUid]) {
          setOtherParticipant(currentRoomData.participantsData[otherUid]);
        } else if (currentRoomData.status === 'active' && currentRoomData.participantUids.length === 2 && (!otherUid || !currentRoomData.participantsData[otherUid])) {
            // console.warn(`[RandomChat ${roomId}] Inconsistent participant data for active room. Cleaning up.`);
            cleanupRoomAndNavigate(roomId, "Katılımcı bilgisi eksik, oda kapatılıyor.", true);
            return;
        }
        
        const myData = currentRoomData.participantsData[myUid];
        if(!myData && currentRoomData.status !== 'waiting' && !currentRoomData.participantUids.includes(myUid)){
            // I am not a participant of this active/closed room, or my data is missing.
            // This can happen if I joined, then my data was removed, or I'm accessing a room I shouldn't.
            // console.warn(`[RandomChat ${roomId}] Current user not a participant or data missing. MyUID: ${myUid}, Participants: ${currentRoomData.participantUids.join(',')}`);
            cleanupRoomAndNavigate(roomId, "Bu sohbete erişiminiz yok veya katılımcı veriniz eksik.", true);
            return;
        }


        if (['closed', 'closed_by_leave', 'closed_by_decline'].includes(currentRoomData.status)) {
          // console.log(`[RandomChat ${roomId}] Room status is terminal: ${currentRoomData.status}. Cleaning up.`);
          cleanupRoomAndNavigate(roomId, "Bu sohbet oturumu sona erdi.");
          return;
        }
        
        if (myData?.hasLeft && currentRoomData.status !== 'friends_chat') {
          // console.log(`[RandomChat ${roomId}] Current user (myData) hasLeft. Cleaning up.`);
          cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız.");
          return;
        }
        
        if (otherUid && currentRoomData.participantsData[otherUid]?.hasLeft && currentRoomData.status !== 'friends_chat' && !myData?.hasLeft) {
          // console.log(`[RandomChat ${roomId}] Other participant hasLeft. Updating self and preparing for cleanup.`);
          if (!hasNavigatedAwayRef.current) { // Ensure not already leaving
            updateDoc(roomRef, { 
              [`participantsData.${myUid}.hasLeft`]: true,
              status: "closed_by_leave" 
            }).catch(e => console.error("[RandomChat] Error updating self as left after other left: ", e));
          }
          return; // The status change to closed_by_leave will trigger cleanupRoomAndNavigate in the next snapshot
        }

        if (currentRoomData.status === 'active' && otherUid) {
          const myDecision = myData?.decision;
          const otherDecision = currentRoomData.participantsData[otherUid]?.decision;

          if (myDecision === 'no' || otherDecision === 'no') {
            if (currentRoomData.status !== 'closed_by_decline') { 
              // console.log(`[RandomChat ${roomId}] Decision 'no' made. Updating status to closed_by_decline.`);
              updateDoc(roomRef, { status: "closed_by_decline" })
                  .catch(e => console.error("[RandomChat] Error on decline status update: ", e));
            }
            return; // Status change will trigger cleanup
          }
          if (myDecision === 'yes' && otherDecision === 'yes' && currentRoomData.status !== 'friends_chat') {
            // console.log(`[RandomChat ${roomId}] Both agreed. Updating status to friends_chat.`);
            updateDoc(roomRef, { status: "friends_chat" })
            .then(async () => {
              if (otherParticipant && userData) {
                // console.log(`[RandomChat ${roomId}] Adding friendship between ${myUid} and ${otherParticipant.uid}`);
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
            }).catch(e => console.error("[RandomChat] Error updating to friends_chat: ", e));
          }
        }
        setLoadingRoom(false);
      } else { 
        // console.warn(`[RandomChat ${roomId}] Room document does not exist. Cleaning up.`);
        cleanupRoomAndNavigate(roomId, "Sohbet odası bulunamadı veya silindi.", true);
      }
    }, (error) => {
      console.error("Error fetching 1v1 room details:", error);
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Oda bilgilerine erişilemiyor.", true);
    });

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
      console.error("[RandomChat] Error fetching messages:", error);
    });


    return () => {
      // console.log(`[RandomChat ${roomId}] Main useEffect cleanup. CurrentUser: ${currentUser?.uid}`);
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
      if (waitingTimeoutRef.current) clearInterval(waitingTimeoutRef.current);
    };
  }, [roomId, currentUser, authLoading, router, cleanupRoomAndNavigate, toast, userData, otherParticipant]);


  // Timeout for 'waiting' state
  useEffect(() => {
    if (roomDetails?.status === 'waiting' && currentUser && roomDetails.participantUids[0] === currentUser.uid) {
      // console.log(`[RandomChat ${roomId}] Room is 'waiting'. Starting timeout for user ${currentUser.uid}.`);
      setWaitingCountdown(WAITING_TIMEOUT_SECONDS);
      waitingTimeoutRef.current = setInterval(() => {
        setWaitingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(waitingTimeoutRef.current!);
            waitingTimeoutRef.current = null;
            // console.log(`[RandomChat ${roomId}] Waiting timeout reached for user ${currentUser.uid}.`);
            if (roomDetails?.status === 'waiting' && !hasNavigatedAwayRef.current) { // Re-check status
              toast({ title: "Eşleşme Bulunamadı", description: "Bekleme süresi doldu, eşleşme bulunamadı.", variant: "destructive"});
              handleLeaveLogic(true); // true indicates it's a timeout scenario
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (waitingTimeoutRef.current) {
        // console.log(`[RandomChat ${roomId}] Room status is not 'waiting' or not my waiting room. Clearing waiting timeout.`);
        clearInterval(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }
    }
    return () => {
      if (waitingTimeoutRef.current) clearInterval(waitingTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomDetails, currentUser]); // handleLeaveLogic is not added to avoid loops, it's called directly


  const handleLeaveLogic = useCallback(async (isTimeout = false) => {
    if (!currentUser || !roomId || hasNavigatedAwayRef.current) return;

    // console.log(`[RandomChat ${roomId}] handleLeaveLogic called by user ${currentUser.uid}. IsTimeout: ${isTimeout}`);
    
    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const currentRoomData = roomSnap.data() as OneOnOneChatRoom;
        
        if (currentRoomData.participantsData[currentUser.uid]?.hasLeft && !isTimeout) {
            // Already marked as left, probably navigating away
            if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız.");
            return;
        }

        let newStatus: OneOnOneChatRoomStatus = currentRoomData.status;
        // If it's a waiting room and I'm the one waiting (and it timed out or I'm leaving)
        if (currentRoomData.status === 'waiting' && currentRoomData.participantUids[0] === currentUser.uid) {
            newStatus = 'closed_by_leave'; 
        } 
        // If it's an active/friends_chat room and I'm leaving
        else if (['active', 'friends_chat'].includes(currentRoomData.status)) {
            newStatus = 'closed_by_leave';
        }
        // If already closed by other means, don't overwrite
        else if (['closed', 'closed_by_decline', 'closed_by_leave'].includes(currentRoomData.status)){
            newStatus = currentRoomData.status;
        }
        
        // console.log(`[RandomChat ${roomId}] Updating Firestore. New status: ${newStatus}. User ${currentUser.uid} hasLeft: true.`);
        await updateDoc(roomRef, {
          [`participantsData.${currentUser.uid}.hasLeft`]: true,
          status: newStatus,
        });
        // The onSnapshot listener will see this change and call cleanupRoomAndNavigate.
        // If I am the ONLY one in a 'waiting' room and I leave/timeout, the room document should be deleted.
        // The cleanupRoomAndNavigate will handle deletion if appropriate.
        // Forcing navigation if snapshot doesn't trigger cleanup quickly enough after my own update.
        if(newStatus === 'closed_by_leave' && !hasNavigatedAwayRef.current) {
            cleanupRoomAndNavigate(roomId, isTimeout ? "Bekleme süresi doldu." : "Sohbetten ayrıldınız.");
        }
      } else {
         // Room already deleted, just navigate
         if (!hasNavigatedAwayRef.current) router.replace("/matchmaking");
      }
    } catch (error) {
      console.error("[RandomChat] Error during leave logic:", error);
      if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Ayrılırken bir hata oluştu.", true);
    }
  }, [currentUser, roomId, cleanupRoomAndNavigate, router]);


  useEffect(() => {
    const doCleanup = async () => {
        if (!hasNavigatedAwayRef.current) {
            // console.log(`[RandomChat ${roomId}] Unmount cleanup for user ${currentUser?.uid}`);
            await handleLeaveLogic();
        }
    }
    // ComponentWillUnmount logic
    return () => {
      doCleanup();
    };
  }, [handleLeaveLogic, currentUser, roomId]); // roomId and currentUser are implicitly in handleLeaveLogic


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
      // console.log(`[RandomChat ${roomId}] User ${currentUser.uid} decision: ${decision}`);
      await updateDoc(roomRef, {
        [`participantsData.${currentUser.uid}.decision`]: decision,
      });
    } catch (error) {
      console.error("Error making friend decision:", error);
      toast({ title: "Hata", description: "Kararınız kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoomButtonClick = async () => {
    if (hasNavigatedAwayRef.current) return;
    // console.log(`[RandomChat ${roomId}] Leave button clicked by user ${currentUser?.uid}`);
    toast({ title: "Ayrılıyor...", description: "Sohbetten ayrılıyorsunuz..." });
    await handleLeaveLogic(); 
  };

  if (authLoading || (!currentUser && !hasNavigatedAwayRef.current)) { 
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet için kullanıcı doğrulanıyor...</p>
      </div>
    );
  }
  
  if (loadingRoom || (!roomDetails && !hasNavigatedAwayRef.current)) {
     return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet yükleniyor...</p>
      </div>
    );
  }
  
  if (!roomDetails && !loadingRoom && !hasNavigatedAwayRef.current) {
    // This case should be caught by onSnapshot if room is deleted, leading to cleanup.
    // If somehow roomDetails is null after loading, it's an issue.
    // console.warn(`[RandomChat ${roomId}] Room details null after loading and not navigating away. Forcing cleanup.`);
    cleanupRoomAndNavigate(roomId, "Oda verileri yüklenemedi veya oda mevcut değil.", true);
     return ( 
        <div className="flex flex-1 items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-destructive" />
            <p className="ml-2 text-lg text-destructive">Oda hatası, yönlendiriliyor...</p>
        </div>
     );
  }
  
  if (roomDetails?.status === 'waiting' && roomDetails.participantUids.includes(currentUser?.uid ?? '') && roomDetails.participantUids.length === 1) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 space-y-6 min-h-screen">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />
            <CardTitle className="text-2xl">Rakip Bekleniyor...</CardTitle>
            <CardDescription>
              Sizin için birisi aranıyor. Lütfen bekleyin.
              Kalan süre: {waitingCountdown > 0 ? `${waitingCountdown}s` : "doldu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleLeaveRoomButtonClick} disabled={hasNavigatedAwayRef.current}>
                 İptal Et ve Geri Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const myCurrentDecision = roomDetails?.participantsData[currentUser?.uid ?? '']?.decision;
  const canSendMessage = roomDetails && ['active', 'friends_chat'].includes(roomDetails.status);

  return (
    <div className="flex flex-col sm:flex-row flex-1 h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))] overflow-hidden">
      <div className="flex flex-col flex-1 bg-card sm:rounded-l-xl shadow-lg overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <Button variant="ghost" size="icon" className="sm:hidden flex-shrink-0 h-9 w-9" onClick={handleLeaveRoomButtonClick} disabled={hasNavigatedAwayRef.current}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
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

      {roomDetails && !['closed', 'closed_by_leave', 'closed_by_decline', 'waiting'].includes(roomDetails.status) && otherParticipant && (
        <Card className={cn(
            "bg-card flex flex-col sm:rounded-r-xl sm:border-l",
            "w-full sm:max-w-[200px] md:max-w-[220px] lg:max-w-[260px]", 
            "p-2.5 sm:p-3" 
        )}>
          <CardHeader className="text-center border-b pb-2.5 pt-1.5 sm:pb-3">
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-1.5 sm:mb-2">
              <AvatarImage src={otherParticipant.photoURL || "https://placehold.co/80x80.png"} data-ai-hint="participant avatar large" />
              <AvatarFallback className="text-lg sm:text-xl">{getAvatarFallbackText(otherParticipant.displayName)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-sm sm:text-base truncate" title={otherParticipant.displayName || "Bilinmeyen Kullanıcı"}>{otherParticipant.displayName || "Bilinmeyen Kullanıcı"}</CardTitle>
            {roomDetails.status !== 'friends_chat' && <CardDescription className="text-xs">ile tanıştın!</CardDescription>}
          </CardHeader>

          {roomDetails.status === 'friends_chat' ? (
            <CardContent className="flex-grow flex flex-col justify-center items-center p-2 sm:p-3 space-y-1.5">
                <UserCheck className="h-7 w-7 sm:h-8 sm:w-8 text-green-500 mx-auto mb-1"/>
                <p className="text-xs sm:text-sm font-semibold text-green-600">Artık arkadaşsınız!</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center">Sohbete devam edebilirsiniz.</p>
            </CardContent>
          ) : (
            <CardContent className="flex-grow flex flex-col justify-center items-center p-2 sm:p-3 space-y-2">
              {myCurrentDecision === 'pending' ? (
                <>
                  <p className="text-xs text-muted-foreground text-center">
                    {otherParticipant.displayName || "Bu kullanıcıyı"} arkadaş olarak ekle?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-1.5 w-full">
                    <Button 
                      size="xs"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[11px] sm:text-xs h-7 sm:h-8" 
                      onClick={() => handleFriendDecision('yes')}
                      disabled={actionLoading || hasNavigatedAwayRef.current}
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <UserCheck className="mr-1 h-3.5 w-3.5" />} Evet
                    </Button>
                    <Button 
                      size="xs"
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[11px] sm:text-xs h-7 sm:h-8" 
                      onClick={() => handleFriendDecision('no')}
                      disabled={actionLoading || hasNavigatedAwayRef.current}
                    >
                       {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <UserX className="mr-1 h-3.5 w-3.5" />} Hayır
                    </Button>
                  </div>
                </>
              ) : myCurrentDecision === 'yes' ? (
                  <div className="text-center space-y-1">
                      <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mx-auto"/>
                      <p className="text-xs text-green-600">Arkadaşlık isteği gönderildi.</p>
                      <p className="text-[10px] text-muted-foreground">Diğer kullanıcının kararı bekleniyor...</p>
                      {roomDetails.participantsData[otherParticipant.uid]?.decision === 'yes' && 
                          <p className="text-[10px] text-blue-500 font-semibold">Diğer kullanıcı da kabul etti!</p>
                      }
                      {roomDetails.participantsData[otherParticipant.uid]?.decision === 'no' && 
                           <p className="text-[10px] text-red-500 font-semibold">Diğer kullanıcı reddetti.</p>
                      }
                  </div>
              ) : ( 
                   <div className="text-center space-y-1">
                      <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mx-auto"/>
                      <p className="text-xs text-red-600">Arkadaş olarak eklemedin.</p>
                       <p className="text-[10px] text-muted-foreground">Sohbet yakında kapanacak...</p>
                  </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
    
