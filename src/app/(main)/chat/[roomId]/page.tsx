
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent } from "react";
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
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
}

interface ChatRoomDetails {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  participantCount?: number;
  expiresAt?: Timestamp;
}

const ROOM_EXTENSION_COST = 2;
const ROOM_EXTENSION_DURATION_MINUTES = 20;


export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [roomDetails, setRoomDetails] = useState<ChatRoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, userData, updateUserDiamonds, isUserLoading } = useAuth();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    setLoadingRoom(true);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedRoomDetails: ChatRoomDetails = {
          id: docSnap.id,
          name: data.name,
          description: data.description,
          creatorId: data.creatorId,
          participantCount: data.participantCount || 0,
          expiresAt: data.expiresAt,
        };
        setRoomDetails(fetchedRoomDetails);
        document.title = `${fetchedRoomDetails.name} - Sohbet Odası - Sohbet Küresi`;
      } else {
        toast({ title: "Hata", description: "Sohbet odası bulunamadı.", variant: "destructive" });
        router.push("/chat");
      }
      setLoadingRoom(false);
    }, (error) => {
      console.error("Error fetching room details:", error);
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingRoom(false);
    });

    setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          timestamp: data.timestamp,
        });
      });
      setMessages(fetchedMessages.map(msg => ({
        ...msg,
        isOwn: msg.senderId === currentUser?.uid,
        userAiHint: msg.senderId === currentUser?.uid ? "user avatar" : "person talking"
      })));
      setLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingMessages(false);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [roomId, currentUser, toast, router]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !roomId || isRoomExpired) return;
    setIsSending(true);
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };
  
  const handleDeleteRoom = async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) {
      toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm mesajlar silinecektir.`)) {
      return;
    }
    try {
      const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`));
      const messagesSnapshot = await getDocs(messagesQuery);
      const deletePromises: Promise<void>[] = [];
      messagesSnapshot.forEach((messageDoc) => {
        deletePromises.push(deleteDoc(doc(db, `chatRooms/${roomId}/messages`, messageDoc.id)));
      });
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, "chatRooms", roomId));
      toast({ title: "Başarılı", description: `"${roomDetails.name}" odası silindi.` });
      router.push("/chat");
    } catch (error) {
      console.error("Error deleting room: ", error);
      toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const handleExtendDuration = async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid || !roomDetails.expiresAt) {
      toast({ title: "Hata", description: "Süre uzatma işlemi yapılamadı.", variant: "destructive" });
      return;
    }
    if (userData.diamonds < ROOM_EXTENSION_COST) {
      toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds}`, variant: "destructive" });
      return;
    }
    setIsExtending(true);
    try {
      const currentExpiresAt = roomDetails.expiresAt.toDate();
      const newExpiresAtDate = addMinutes(currentExpiresAt, ROOM_EXTENSION_DURATION_MINUTES);
      
      const roomDocRef = doc(db, "chatRooms", roomId);
      await updateDoc(roomDocRef, {
        expiresAt: Timestamp.fromDate(newExpiresAtDate)
      });
      await updateUserDiamonds(userData.diamonds - ROOM_EXTENSION_COST);

      toast({ title: "Başarılı", description: `Oda süresi ${ROOM_EXTENSION_DURATION_MINUTES} dakika uzatıldı. ${ROOM_EXTENSION_COST} elmas harcandı.` });
    } catch (error) {
      console.error("Error extending room duration:", error);
      toast({ title: "Hata", description: "Süre uzatılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsExtending(false);
    }
  };

  const getExpiryInfo = (): string => {
    if (!roomDetails?.expiresAt) return "Süre bilgisi yok";
    const expiryDate = roomDetails.expiresAt.toDate();
    if (isPast(expiryDate)) {
      return "Süresi Doldu";
    }
    return `Kalan süre: ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };


  if (loadingRoom || !roomDetails) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Oda yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.32))] max-h-[calc(100vh-theme(spacing.32))] md:h-[calc(100vh-theme(spacing.36))] md:max-h-[calc(100vh-theme(spacing.36))] bg-card rounded-xl shadow-xl overflow-hidden">
      <header className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 border-b">
        <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" asChild className="md:hidden">
            <Link href="/chat">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
            </Link>
            </Button>
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
            <AvatarImage src={`https://placehold.co/40x40.png?text=${roomDetails.name.substring(0,1)}`} data-ai-hint="group chat"/>
            <AvatarFallback>{roomDetails.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0"> {/* min-w-0 for truncation */}
                <h2 className="text-md sm:text-lg font-semibold text-primary-foreground/90 truncate">{roomDetails.name}</h2>
                <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                    <Users className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{roomDetails.participantCount || 1} aktif üye</span>
                    {roomDetails.expiresAt && (
                        <>
                            <Clock className="ml-2 sm:ml-3 mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="truncate">{getExpiryInfo()}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0"> {/* flex-shrink-0 to prevent squishing */}
            {currentUser && roomDetails.creatorId === currentUser.uid && !isRoomExpired && roomDetails.expiresAt && (
                <Button variant="outline" size="xs" smSize="sm" onClick={handleExtendDuration} disabled={isExtending || isUserLoading} className="px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm">
                    {isExtending ? <Loader2 className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <RefreshCw className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                    Süre Uzat (2 <Gem className="inline h-3 w-3 ml-0.5 sm:ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)
                </Button>
            )}
            {currentUser && roomDetails.creatorId === currentUser.uid && (
                <Button variant="destructive" size="xs" smSize="sm" onClick={handleDeleteRoom} className="px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm">
                    <Trash2 className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Odayı Sil
                </Button>
            )}
        </div>
      </header>

      <ScrollArea className="flex-1 p-2 sm:p-4 space-y-3 sm:space-y-4" ref={scrollAreaRef}>
        {loadingMessages && (
             <div className="flex flex-1 items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p>
            </div>
        )}
        {!loadingMessages && messages.length === 0 && !isRoomExpired && (
            <div className="text-center text-muted-foreground py-10">
                <p>Henüz hiç mesaj yok.</p>
                <p>İlk mesajı sen gönder!</p>
            </div>
        )}
        {isRoomExpired && (
             <div className="text-center text-destructive py-10">
                <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p>
                <p>Yeni mesaj gönderilemez.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.isOwn ? "justify-end" : ""}`}>
            {!msg.isOwn && (
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                <AvatarFallback>{msg.senderName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <div className={`max-w-[70%] p-2 sm:p-3 rounded-xl shadow ${
                msg.isOwn 
                ? "bg-primary text-primary-foreground rounded-br-none" 
                : "bg-secondary text-secondary-foreground rounded-bl-none"
            }`}>
              {!msg.isOwn && <p className="text-xs font-medium mb-0.5 sm:mb-1 text-accent">{msg.senderName}</p>}
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground/70"} text-right`}>
                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Gönderiliyor..."}
              </p>
            </div>
            {msg.isOwn && (
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={currentUser?.photoURL || userData?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{userData?.displayName?.substring(0, 2).toUpperCase() || currentUser?.displayName?.substring(0, 2).toUpperCase() || "SZ"}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-2 sm:p-4 border-t bg-background/50 rounded-b-xl">
        <div className="relative flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={isRoomExpired} className="h-9 w-9 sm:h-10 sm:w-10">
            <Smile className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-accent" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder={isRoomExpired ? "Oda süresi doldu" : "Mesajınızı yazın..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 pr-16 sm:pr-20 rounded-full focus-visible:ring-accent h-9 sm:h-10 text-sm sm:text-base"
            autoComplete="off"
            disabled={!currentUser || isSending || isRoomExpired || isUserLoading}
          />
          <div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button" disabled={isRoomExpired} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
              <Paperclip className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!currentUser || isSending || !newMessage.trim() || isRoomExpired || isUserLoading}>
              {isSending ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-accent-foreground" /> : <Send className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />}
              <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
        {isRoomExpired && <p className="text-xs text-destructive text-center mt-1">Bu odanın süresi dolduğu için mesaj gönderemezsiniz.</p>}
      </form>
    </div>
  );
}
