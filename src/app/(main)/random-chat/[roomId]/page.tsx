
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCheck, UserX, LogOut, AlertTriangle, UserPlus, MessageSquare, Clock } from "lucide-react";
// import Link from "next/link"; // Gerekli değilse kaldırıldı
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
import { useAuth } from "@/contexts/AuthContext"; // UserData'yı AuthContext'ten alıyoruz
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
  participantsData: { [key: string]: ParticipantData }; 
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

const WAITING_TIMEOUT_SECONDS = 30; 

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

    // console.log(`[RandomChat Cleanup] Room: ${currentRoomId}, Reason: ${reason}, Error: ${isError}`);
    toast({ title: "Sohbet Durumu", description: reason, variant: isError ? "destructive" : "default" });
    
    if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
    if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
    if (waitingTimeoutRef.current) clearInterval(waitingTimeoutRef.current);

    try {
      const roomRef = doc(db, "oneOnOneChats", currentRoomId);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
         const roomData = roomSnap.data() as OneOnOneChatRoom;
         let shouldDelete = false;
         // Oda durumuna göre silme kararı ver
         if (['waiting', 'closed_by_leave', 'closed_by_decline', 'closed'].includes(roomData.status) ) {
            shouldDelete = true;
         }
         // Eğer aktif ve katılımcı sayısı 2'den azsa (biri ayrılmış olabilir), bu da silme nedeni olabilir
         // Ancak bu durum `closed_by_leave` ile zaten yakalanmalı.

        if (shouldDelete) {
            // console.log(`[RandomChat Cleanup] Deleting room ${currentRoomId} and its messages.`);
            const messagesQuery = query(collection(db, `oneOnOneChats/${currentRoomId}/messages`));
            const messagesSnapshot = await getDocs(messagesQuery);
            const batch = writeBatch(db);
            messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));
            await batch.commit(); 
            
            await deleteDoc(roomRef);
        } else {
            // console.log(`[RandomChat Cleanup] Room ${currentRoomId} not deleted based on status: ${roomData.status}`);
        }
      }
    } catch (error) {
      console.error("Error cleaning up room:", currentRoomId, error);
      // Hata olsa bile yönlendirmeyi dene
    } finally {
      router.replace("/matchmaking");
    }
  }, [router, toast]); // roomId bağımlılıklardan çıkarıldı, currentRoomId parametre olarak alınıyor


  const handleLeaveLogic = useCallback(async (isTimeout = false) => {
    if (!currentUser || !roomId || hasNavigatedAwayRef.current) return;
    // console.log(`[RandomChat handleLeaveLogic] User: ${currentUser.uid}, Room: ${roomId}, Timeout: ${isTimeout}`);
    
    const roomRef = doc(db, "oneOnOneChats", roomId);
    try {
      const roomSnap = await getDoc(roomRef); // En güncel oda bilgisini al
      if (roomSnap.exists()) {
        const currentRoomData = roomSnap.data() as OneOnOneChatRoom;
        
        if (currentRoomData.participantsData[currentUser.uid]?.hasLeft && !isTimeout) {
            // console.log("[RandomChat handleLeaveLogic] User already marked as left.");
            if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız.");
            return;
        }

        let newStatus: OneOnOneChatRoomStatus = currentRoomData.status;
        if (currentRoomData.status === 'waiting' && currentRoomData.participantUids[0] === currentUser.uid) {
            newStatus = 'closed_by_leave'; 
        } 
        else if (['active', 'friends_chat'].includes(currentRoomData.status)) {
            newStatus = 'closed_by_leave';
        }
        
        await updateDoc(roomRef, {
          [`participantsData.${currentUser.uid}.hasLeft`]: true,
          status: newStatus,
        });
        // Durum değişikliği onSnapshot tarafından yakalanıp cleanupRoomAndNavigate'i tetikleyecek.
      } else {
        // Oda zaten yoksa veya silinmişse, kullanıcıyı matchmaking'e yönlendir
        if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Oda bulunamadı.", true);
      }
    } catch (error) {
      console.error("[RandomChat] Error during leave logic:", error);
      if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Ayrılırken bir hata oluştu.", true);
    }
  }, [currentUser, roomId, cleanupRoomAndNavigate]);

  const handleLeaveLogicRef = useRef(handleLeaveLogic);
  useEffect(() => {
    handleLeaveLogicRef.current = handleLeaveLogic;
  }, [handleLeaveLogic]);


  useEffect(() => {
    // Ana oda ve mesaj dinleyici useEffect'i
    if (!roomId || !currentUser || authLoading || hasNavigatedAwayRef.current) {
      if (!authLoading && !currentUser && !hasNavigatedAwayRef.current) {
        cleanupRoomAndNavigate(roomId, "Kullanıcı oturumu doğrulanamadı.", true);
      }
      return;
    }
    
    // console.log(`[RandomChat MainEffect] Subscribing to room ${roomId}. Initial loadingRoom: ${loadingRoom}`);
    // Sadece roomDetails null ise ve yeniden yükleme yapılıyorsa setLoadingRoom(true) yap
    if (!roomDetails && loadingRoom) {
        // setLoadingRoom(true) zaten başta true olduğu için burada tekrar set etmeye gerek yok
    } else if (roomDetails && roomDetails.id !== roomId) {
        // Oda ID'si değiştiyse, state'leri sıfırla ve yeniden yükle
        setRoomDetails(null);
        setMessages([]);
        setOtherParticipant(null);
        setLoadingRoom(true); // Yeniden yükleme için
    }


    roomUnsubscribeRef.current = onSnapshot(doc(db, "oneOnOneChats", roomId), (docSnap) => {
      if (hasNavigatedAwayRef.current) return;

      if (docSnap.exists()) {
        const currentRoomData = { id: docSnap.id, ...docSnap.data() } as OneOnOneChatRoom;
        // console.log("[RandomChat MainEffect] Room snapshot received:", currentRoomData);

        const myUid = currentUser.uid;

        if (!currentRoomData.participantUids.includes(myUid)) {
           if (currentRoomData.status !== 'waiting' || (currentRoomData.status === 'waiting' && currentRoomData.participantUids.length > 0 && currentRoomData.participantUids[0] !== myUid)) {
            if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Bu sohbete erişiminiz yok.", true);
            return;
          }
        }
        
        const myData = currentRoomData.participantsData[myUid];
        if (!myData && currentRoomData.status !== 'waiting') { // Waiting durumunda ilk katılımcının verisi olmayabilir
          if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Katılımcı veriniz bulunamadı.", true);
          return;
        }

        const otherUserUid = currentRoomData.participantUids.find(uid => uid !== myUid);
        if (otherUserUid) {
          const otherData = currentRoomData.participantsData[otherUserUid];
          if (otherData) {
            setOtherParticipant(otherData);
          } else if (currentRoomData.status === 'active' && currentRoomData.participantUids.length === 2) {
            // Aktif odada diğer katılımcının verisi yoksa bu bir sorundur, ama hemen kapatmak yerine biraz bekleyebiliriz
            // Şimdilik bu durumu izleyelim, eğer sürekli oluyorsa daha katı bir kontrol eklenebilir
            // console.warn(`[RandomChat MainEffect] Other participant data missing for active room ${roomId}`);
          }
        } else if (currentRoomData.status === 'active' && currentRoomData.participantUids.length === 2) {
            if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Katılımcı yapısı tutarsız.", true);
            return;
        }
        
        setRoomDetails(currentRoomData); // Önce roomDetails'ı set et

        // Terminal durum kontrolleri
        if (['closed', 'closed_by_leave', 'closed_by_decline'].includes(currentRoomData.status)) {
          let reason = "Bu sohbet oturumu sona erdi.";
          if(currentRoomData.status === 'closed_by_leave') reason = "Bir katılımcı sohbetten ayrıldı.";
          if(currentRoomData.status === 'closed_by_decline') reason = "Arkadaşlık teklifi reddedildi veya bir kullanıcı devam etmek istemedi.";
          if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, reason);
          return;
        }
        
        if (myData?.hasLeft && currentRoomData.status !== 'friends_chat') {
          if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Sohbetten ayrıldınız.");
          return;
        }
        
        if (otherUserUid && currentRoomData.participantsData[otherUserUid]?.hasLeft && currentRoomData.status !== 'friends_chat' && !myData?.hasLeft) {
          if (!hasNavigatedAwayRef.current) { 
            // Diğer kullanıcı ayrıldıysa, mevcut kullanıcıyı da ayrılmış say ve durumu güncelle
            updateDoc(doc(db, "oneOnOneChats", roomId), { 
              [`participantsData.${myUid}.hasLeft`]: true,
              status: "closed_by_leave" 
            }).catch(e => console.error("[RandomChat] Error updating self as left after other left: ", e));
            // Bu güncelleme sonrası onSnapshot tekrar tetiklenecek ve cleanupRoomAndNavigate çağrılacak.
            return; 
          }
        }

        // Arkadaşlık kararları
        if (currentRoomData.status === 'active' && otherUserUid && myData) {
          const myDecision = myData.decision;
          const otherDecision = currentRoomData.participantsData[otherUserUid]?.decision;

          if (myDecision === 'no' || otherDecision === 'no') {
            if (currentRoomData.status !== 'closed_by_decline') { 
              updateDoc(doc(db, "oneOnOneChats", roomId), { status: "closed_by_decline" })
                  .catch(e => console.error("[RandomChat] Error on decline status update: ", e));
            }
            return; 
          }
          if (myDecision === 'yes' && otherDecision === 'yes' && currentRoomData.status !== 'friends_chat') {
            updateDoc(doc(db, "oneOnOneChats", roomId), { status: "friends_chat" })
            .then(async () => {
              if (otherParticipant && userData) { // userData null kontrolü eklendi
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
                    displayName: userData.displayName, // userData burada kullanılacak
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
        
        if (loadingRoom) setLoadingRoom(false); // Tüm kontrollerden sonra loadingRoom'u false yap

      } else { 
        if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Sohbet odası bulunamadı.", true);
      }
    }, (error) => {
      console.error("[RandomChat MainEffect] Error fetching 1v1 room details:", error);
      if (!hasNavigatedAwayRef.current) cleanupRoomAndNavigate(roomId, "Oda bilgilerine erişirken hata.", true);
    });

    messagesUnsubscribeRef.current = onSnapshot(query(collection(db, `oneOnOneChats/${roomId}/messages`), orderBy("timestamp", "asc")), (querySnapshot) => {
      if (hasNavigatedAwayRef.current) return;
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data()} as Message);
      });
      setMessages(fetchedMessages.map(msg => ({ ...msg, isOwn: msg.senderId === currentUser.uid })));
      setTimeout(() => scrollToBottom(), 0); 
    }, (error) => {
      console.error("[RandomChat MainEffect] Error fetching messages:", error);
      // Mesaj hatası için odayı kapatmayalım, ama kullanıcıya bilgi verilebilir.
    });

    return () => {
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
    };
  }, [roomId, currentUser, authLoading, cleanupRoomAndNavigate, userData, loadingRoom]); // userData eklendi, otherParticipant çıkarıldı


  useEffect(() => {
    // Waiting durumundaki oda için zaman aşımı
    if (roomDetails?.status === 'waiting' && currentUser && roomDetails.participantUids[0] === currentUser.uid && !hasNavigatedAwayRef.current) {
      setWaitingCountdown(WAITING_TIMEOUT_SECONDS);
      waitingTimeoutRef.current = setInterval(() => {
        setWaitingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(waitingTimeoutRef.current!);
            waitingTimeoutRef.current = null;
            // Zaman aşımı olduğunda handleLeaveLogic'i çağır, o da odayı kapatacak
            if (!hasNavigatedAwayRef.current) { // Ekstra kontrol
                // console.log("[RandomChat WaitingTimeout] Timeout reached. Calling handleLeaveLogic.");
                handleLeaveLogicRef.current(true); 
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (waitingTimeoutRef.current) {
        clearInterval(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }
    }
    return () => {
      if (waitingTimeoutRef.current) clearInterval(waitingTimeoutRef.current);
    };
  }, [roomDetails?.status, roomDetails?.participantUids, currentUser?.uid]); // handleLeaveLogicRef bağımlılıktan çıkarıldı


  useEffect(() => {
    // Sayfadan ayrılma veya kapatma durumlarını yönet
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        if (currentUser && roomId && roomDetails && !hasNavigatedAwayRef.current && ['active', 'friends_chat', 'waiting'].includes(roomDetails.status) ) {
            // Sadece hasLeft'i güncelle, onSnapshot bunu yakalayıp gerisini halletmeli
             updateDoc(doc(db, "oneOnOneChats", roomId), {
              [`participantsData.${currentUser.uid}.hasLeft`]: true,
              status: roomDetails.status === 'waiting' ? 'closed_by_leave' : 'closed_by_leave', 
            }).catch(e => console.warn("[RandomChat beforeUnload] Error updating doc: ", e));
        }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      // Component unmount olduğunda, eğer navigasyon zaten başlamadıysa, ayrılma mantığını çalıştır
      if (currentUser && roomId && !hasNavigatedAwayRef.current) {
        // console.log("[RandomChat Unmount] Component unmounting. Calling handleLeaveLogic.");
        handleLeaveLogicRef.current();
      }
    };
  }, [currentUser, roomId, roomDetails]);


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
        if (!['active', 'friends_chat'].includes(roomDetails?.status ?? '')) {
            toast({ title: "Gönderilemedi", description: "Sohbet aktif değil.", variant: "destructive" });
        }
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
      // Karar sonrası durum değişikliği onSnapshot tarafından yakalanacak.
    } catch (error) {
      console.error("Error making friend decision:", error);
      toast({ title: "Hata", description: "Kararınız kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoomButtonClick = async () => {
    if (hasNavigatedAwayRef.current || actionLoading) return;
    setActionLoading(true);
    // console.log("[RandomChat LeaveButton] Clicked. Calling handleLeaveLogic.");
    await handleLeaveLogicRef.current(); 
    setActionLoading(false);
  };


  if (authLoading || (!currentUser && !hasNavigatedAwayRef.current && loadingRoom)) { 
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Kullanıcı doğrulanıyor...</p>
      </div>
    );
  }
  
  if (loadingRoom) { 
     return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet odası yükleniyor...</p>
      </div>
    );
  }
  
  // roomDetails null ve loadingRoom false ise, muhtemelen cleanupRoomAndNavigate zaten çağrılmıştır.
  // Bu durum için bir fallback gösterilebilir veya useEffect içinde yönlendirme beklenir.
  if (!roomDetails && !loadingRoom) {
     return ( 
        <div className="flex flex-1 items-center justify-center min-h-screen">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="ml-2 text-lg text-destructive">Oda bilgileri yüklenemedi. Yönlendiriliyorsunuz...</p>
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
              Kalan süre: {waitingCountdown > 0 ? `${waitingCountdown}s` : "doldu..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleLeaveRoomButtonClick} disabled={hasNavigatedAwayRef.current || actionLoading}>
                 İptal Et ve Geri Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const myCurrentDecision = roomDetails?.participantsData[currentUser?.uid ?? '']?.decision;
  const canSendMessage = roomDetails && ['active', 'friends_chat'].includes(roomDetails.status) && !roomDetails.participantsData[currentUser?.uid ?? '']?.hasLeft && (!otherParticipant || !otherParticipant.hasLeft);


  return (
    <div className="flex flex-col sm:flex-row flex-1 h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))] overflow-hidden">
      {/* Sohbet Alanı */}
      <div className="flex flex-col flex-1 bg-card sm:rounded-l-xl shadow-lg overflow-hidden">
        <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <Button variant="ghost" size="icon" className="sm:hidden flex-shrink-0 h-9 w-9" onClick={handleLeaveRoomButtonClick} disabled={hasNavigatedAwayRef.current || actionLoading}>
                <ArrowLeft className="h-5 w-5" />
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
          {(!canSendMessage && roomDetails?.status !== 'waiting' && roomDetails?.status !== 'friends_chat') && (
             <div className="text-center text-destructive py-10 px-4">
                <AlertTriangle className="mx-auto h-16 w-16 text-destructive/80 mb-3" />
                <p className="text-lg font-semibold">Sohbet Kapalı</p>
                <p>Bu sohbet oturumu artık aktif değil veya bir katılımcı ayrıldı.</p>
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
            <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading || hasNavigatedAwayRef.current || actionLoading} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
            </Button>
            <Input
              placeholder={!canSendMessage ? "Mesaj gönderilemez." : "Mesajınızı yazın..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
              autoComplete="off"
              disabled={!canSendMessage || isSending || authLoading || hasNavigatedAwayRef.current || actionLoading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
              <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || authLoading || hasNavigatedAwayRef.current || actionLoading} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
                <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
              </Button>
              <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || authLoading || hasNavigatedAwayRef.current || actionLoading}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Arkadaşlık Karar Paneli */}
      {roomDetails && !['closed', 'closed_by_leave', 'closed_by_decline', 'waiting'].includes(roomDetails.status) && otherParticipant && (
        <Card className={cn(
            "bg-card flex flex-col sm:rounded-r-xl sm:border-l",
            "w-full sm:w-[200px] md:w-[220px] lg:w-[260px]", // Farklı ekran boyutları için genişlik
            "p-2.5 sm:p-3 mt-2 sm:mt-0" // Mobil için üstte boşluk
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
          ) : ( // 'active' durumu
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
              ) : ( // myCurrentDecision === 'no'
                   <div className="text-center space-y-1">
                      <UserX className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mx-auto"/>
                      <p className="text-xs text-red-500">Arkadaş olarak eklemedin.</p>
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
    

    