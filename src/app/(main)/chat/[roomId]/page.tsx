
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical } from "lucide-react";
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
  where,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


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

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  toUsername: string;
  toAvatarUrl: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
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

  const [popoverOpenForUserId, setPopoverOpenForUserId] = useState<string | null>(null);
  const [popoverTargetUser, setPopoverTargetUser] = useState<UserData | null>(null);
  const [popoverLoading, setPopoverLoading] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<"friends" | "request_sent" | "request_received" | "none">("none");
  const [relevantFriendRequest, setRelevantFriendRequest] = useState<FriendRequest | null>(null);


  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000 * 60); // Update every minute for expiry info
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
      setTimeout(() => scrollToBottom(), 0);
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

  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !roomId || isRoomExpired) return;
    setIsSending(true);
    const tempMessage = newMessage;
    setNewMessage("");
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
      setNewMessage(tempMessage); // Restore message on error
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
    return `${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };

  const handleOpenUserInfoPopover = async (senderId: string) => {
    if (!currentUser || senderId === currentUser.uid) return;
    setPopoverOpenForUserId(senderId);
    setPopoverLoading(true);
    setRelevantFriendRequest(null);

    try {
      const userDocRef = doc(db, "users", senderId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" });
        setPopoverOpenForUserId(null);
        return;
      }
      const targetUser = { uid: userDocSnap.id, ...userDocSnap.data() } as UserData;
      setPopoverTargetUser(targetUser);

      const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, senderId);
      const friendDocSnap = await getDoc(friendDocRef);
      if (friendDocSnap.exists()) {
        setFriendshipStatus("friends");
        setPopoverLoading(false);
        return;
      }

      const outgoingReqQuery = query(
        collection(db, "friendRequests"),
        where("fromUserId", "==", currentUser.uid),
        where("toUserId", "==", senderId),
        where("status", "==", "pending")
      );
      const outgoingReqSnap = await getDocs(outgoingReqQuery);
      if (!outgoingReqSnap.empty) {
        setFriendshipStatus("request_sent");
        setRelevantFriendRequest({id: outgoingReqSnap.docs[0].id, ...outgoingReqSnap.docs[0].data()} as FriendRequest);
        setPopoverLoading(false);
        return;
      }

      const incomingReqQuery = query(
        collection(db, "friendRequests"),
        where("fromUserId", "==", senderId),
        where("toUserId", "==", currentUser.uid),
        where("status", "==", "pending")
      );
      const incomingReqSnap = await getDocs(incomingReqQuery);
      if (!incomingReqSnap.empty) {
        setFriendshipStatus("request_received");
        setRelevantFriendRequest({id: incomingReqSnap.docs[0].id, ...incomingReqSnap.docs[0].data()} as FriendRequest);
        setPopoverLoading(false);
        return;
      }
      setFriendshipStatus("none");
    } catch (error) {
      console.error("Error fetching user info for popover:", error);
      toast({ title: "Hata", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setPopoverLoading(false);
    }
  };

  const handleSendFriendRequestPopover = async () => {
    if (!currentUser || !userData || !popoverTargetUser) return;
    setPopoverLoading(true);
    try {
      const newRequestRef = await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid,
        fromUsername: userData.displayName,
        fromAvatarUrl: userData.photoURL,
        toUserId: popoverTargetUser.uid,
        toUsername: popoverTargetUser.displayName,
        toAvatarUrl: popoverTargetUser.photoURL,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` });
      setFriendshipStatus("request_sent"); 
      setRelevantFriendRequest({ 
        id: newRequestRef.id, 
        fromUserId: currentUser.uid, 
        fromUsername: userData.displayName || "", 
        fromAvatarUrl: userData.photoURL || null,
        toUserId: popoverTargetUser.uid,
        toUsername: popoverTargetUser.displayName || "",
        toAvatarUrl: popoverTargetUser.photoURL || null,
        status: "pending",
        createdAt: Timestamp.now() // Placeholder, actual value is serverTimestamp
      });
      // No need to close popover manually, onOpenChange handles it
    } catch (error) {
      console.error("Error sending friend request from popover:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally {
      setPopoverLoading(false);
    }
  };
  
  const handleAcceptFriendRequestPopover = async () => {
    if (!currentUser || !userData || !relevantFriendRequest || !popoverTargetUser) return;
    setPopoverLoading(true);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, "friendRequests", relevantFriendRequest.id);
      batch.update(requestRef, { status: "accepted" });

      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, popoverTargetUser.uid);
      batch.set(myFriendRef, { 
        displayName: popoverTargetUser.displayName, 
        photoURL: popoverTargetUser.photoURL,
        addedAt: serverTimestamp() 
      });

      const theirFriendRef = doc(db, `users/${popoverTargetUser.uid}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { 
        displayName: userData.displayName, 
        photoURL: userData.photoURL,
        addedAt: serverTimestamp() 
      });
      
      await batch.commit();
      toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} ile arkadaş oldunuz.` });
      setFriendshipStatus("friends");
      setRelevantFriendRequest(null);
    } catch (error) {
      console.error("Error accepting friend request from popover:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally {
      setPopoverLoading(false);
    }
  };
  
  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN"; 
  };

  if (loadingRoom || !roomDetails) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Oda yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))] bg-card rounded-xl shadow-lg overflow-hidden">
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="md:hidden flex-shrink-0 h-9 w-9">
            <Link href="/chat">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
            </Link>
            </Button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={`https://placehold.co/40x40.png?text=${roomDetails.name.substring(0,1)}`} data-ai-hint="group chat"/>
                <AvatarFallback>{roomDetails.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate" title={roomDetails.name}>{roomDetails.name}</h2>
                <div className="flex items-center text-xs text-muted-foreground gap-x-2">
                    <div className="flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        <span>{roomDetails.participantCount || 1}</span>
                    </div>
                    {roomDetails.expiresAt && (
                        <div className="flex items-center truncate">
                            <Clock className="mr-1 h-3 w-3" />
                            <span className="truncate" title={getExpiryInfo()}>{getExpiryInfo()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {currentUser && roomDetails.creatorId === currentUser.uid && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">Oda Seçenekleri</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {!isRoomExpired && roomDetails.expiresAt && (
                        <DropdownMenuItem onClick={handleExtendDuration} disabled={isExtending || isUserLoading}>
                            {isExtending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Süre Uzat (2 <Gem className="inline h-3 w-3 ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleDeleteRoom} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Odayı Sil
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
      </header>

      <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}>
        {loadingMessages && (
             <div className="flex flex-1 items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p>
            </div>
        )}
        {!loadingMessages && messages.length === 0 && !isRoomExpired && (
            <div className="text-center text-muted-foreground py-10 px-4">
                <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                <p className="text-lg font-medium">Henüz hiç mesaj yok.</p>
                <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p>
            </div>
        )}
        {isRoomExpired && (
             <div className="text-center text-destructive py-10">
                <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p>
                <p>Yeni mesaj gönderilemez.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
            {!msg.isOwn && (
                <Popover open={popoverOpenForUserId === msg.senderId} onOpenChange={(isOpen) => {
                    if (!isOpen) setPopoverOpenForUserId(null);
                }}>
                    <PopoverTrigger asChild onClick={() => handleOpenUserInfoPopover(msg.senderId)}>
                        <Avatar className="h-7 w-7 cursor-pointer self-end mb-1">
                            <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                            <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
                        </Avatar>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" side="top" align="start">
                        {popoverLoading && <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                        {!popoverLoading && popoverTargetUser && popoverOpenForUserId === msg.senderId && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={popoverTargetUser.photoURL || `https://placehold.co/80x80.png`} data-ai-hint="user portrait" />
                                        <AvatarFallback>{getAvatarFallbackText(popoverTargetUser.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-semibold truncate">{popoverTargetUser.displayName || "Kullanıcı"}</p>
                                        <p className="text-xs text-muted-foreground truncate">{popoverTargetUser.email}</p>
                                    </div>
                                </div>
                                <hr className="my-2"/>
                                {friendshipStatus === "friends" && <p className="text-xs text-green-600 text-center py-1 px-2 rounded bg-green-500/10">Arkadaşsınız.</p>}
                                {friendshipStatus === "request_sent" && <p className="text-xs text-blue-600 text-center py-1 px-2 rounded bg-blue-500/10">Arkadaşlık isteği gönderildi.</p>}
                                {friendshipStatus === "request_received" && relevantFriendRequest && (
                                    <Button size="sm" className="w-full text-xs" onClick={handleAcceptFriendRequestPopover} disabled={popoverLoading}>
                                        <UserCircle className="mr-1.5 h-3.5 w-3.5" /> İsteği Kabul Et
                                    </Button>
                                )}
                                {friendshipStatus === "none" && (
                                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleSendFriendRequestPopover} disabled={popoverLoading}>
                                        <UserCircle className="mr-1.5 h-3.5 w-3.5" /> Arkadaş Ekle
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => toast({ description: "DM özelliği yakında!"})} >
                                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> DM Gönder
                                </Button>
                            </div>
                        )}
                    </PopoverContent>
                </Popover>
            )}
            <div className={`flex flex-col max-w-[70%] sm:max-w-[65%]`}>
                {!msg.isOwn && (
                    <Popover open={popoverOpenForUserId === msg.senderId && !msg.isOwn} onOpenChange={(isOpen) => {
                        if (!isOpen) setPopoverOpenForUserId(null);
                    }}>
                        <PopoverTrigger asChild onClick={() => handleOpenUserInfoPopover(msg.senderId)}>
                             <span className="text-xs text-muted-foreground mb-0.5 px-2 cursor-pointer hover:underline self-start">{msg.senderName}</span>
                        </PopoverTrigger>
                    </Popover>
                )}
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

            {msg.isOwn && (
              <Avatar className="h-7 w-7 cursor-default self-end mb-1">
                <AvatarImage src={currentUser?.photoURL || userData?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(userData?.displayName || currentUser?.displayName)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={isRoomExpired || isUserLoading} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
            <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder={isRoomExpired ? "Oda süresi doldu" : "Mesajınızı yazın..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
            autoComplete="off"
            disabled={!currentUser || isSending || isRoomExpired || isUserLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button" disabled={isRoomExpired || isUserLoading} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
              <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!currentUser || isSending || !newMessage.trim() || isRoomExpired || isUserLoading}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
        {isRoomExpired && <p className="text-xs text-destructive text-center mt-1.5">Bu odanın süresi dolduğu için mesaj gönderemezsiniz.</p>}
      </form>
    </div>
  );
}

    