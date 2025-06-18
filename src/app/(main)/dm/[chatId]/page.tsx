
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCircle, MessageSquare, Video, MoreVertical, ShieldAlert, Ban } from "lucide-react";
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
  Timestamp,
  where,
  getDocs,
  setDoc
} from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { generateDmChatId } from "@/lib/utils"; 
import DirectMessageItem from "@/components/dm/DirectMessageItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string; 
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
}

interface DmPartnerDetails {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string | null; 
}

const TYPING_DEBOUNCE_DELAY = 1500; 

export default function DirectMessagePage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string; 
  const [dmPartnerDetails, setDmPartnerDetails] = useState<DmPartnerDetails | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingDmPartner, setLoadingDmPartner] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, userData, isUserLoading } = useAuth();
  const { toast } = useToast();

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const getAvatarFallbackText = useCallback((name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  }, []);

  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;

    const uids = chatId.split('_');
    const partnerUid = uids[0] === currentUser.uid ? uids[1] : uids[0];

    if (!partnerUid) {
        toast({ title: "Hata", description: "Sohbet partneri belirlenemedi.", variant: "destructive" });
        router.push("/friends"); 
        return;
    }
    
    setLoadingDmPartner(true);
    const userDocRef = doc(db, "users", partnerUid);
    const unsubscribePartner = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const partnerData = docSnap.data() as UserData;
        setDmPartnerDetails({
          uid: partnerUid,
          displayName: partnerData.displayName,
          photoURL: partnerData.photoURL,
          email: partnerData.email,
        });
        document.title = `${partnerData.displayName || 'Sohbet'} - DM`;
      } else {
        toast({ title: "Hata", description: "Sohbet partneri bulunamadı.", variant: "destructive" });
        router.push("/friends");
      }
      setLoadingDmPartner(false);
    }, (error) => {
      console.error("Error fetching DM partner details:", error);
      toast({ title: "Hata", description: "Partner bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingDmPartner(false);
    });
    return () => unsubscribePartner();
  }, [chatId, currentUser?.uid, toast, router]);


  useEffect(() => {
    if(!chatId || !currentUser?.uid) return;
    setLoadingMessages(true);
    const messagesQuery = query(collection(db, `directMessages/${chatId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: DirectMessage[] = [];
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
      console.error("Error fetching DM messages:", error);
      toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingMessages(false);
    });
    return () => unsubscribeMessages();
  }, [chatId, currentUser?.uid, toast]);


  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);


  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);


  const handleNewMessageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value;
    setNewMessage(currentMessage);
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !chatId || !userData || !dmPartnerDetails || isUserLoading) return;

    if (isSending) return; 

    setIsSending(true);
    const tempMessage = newMessage.trim();
    
    try {
      const dmChatDocRef = doc(db, "directMessages", chatId);
      const dmChatDocSnap = await getDoc(dmChatDocRef);
      
      const messageDataForParentDoc = {
        lastMessageTimestamp: serverTimestamp(),
        lastMessageText: tempMessage.substring(0, 50), 
        lastMessageSenderId: currentUser.uid,
      };

      if (!dmChatDocSnap.exists()) {
        await setDoc(dmChatDocRef, {
          participantUids: [currentUser.uid, dmPartnerDetails.uid].sort(),
          participantInfo: {
            [currentUser.uid]: {
              displayName: userData.displayName,
              photoURL: userData.photoURL,
            },
            [dmPartnerDetails.uid]: {
              displayName: dmPartnerDetails.displayName,
              photoURL: dmPartnerDetails.photoURL,
            },
          },
          createdAt: serverTimestamp(),
          ...messageDataForParentDoc
        });
      } else {
         await setDoc(dmChatDocRef, messageDataForParentDoc, { merge: true });
      }

      await addDoc(collection(db, `directMessages/${chatId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        timestamp: serverTimestamp(),
      });
      setNewMessage(""); 
    } catch (error) {
      console.error("Error sending DM:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleVideoCall = useCallback(() => {
    toast({
      title: "Görüntülü Arama (Yakında)",
      description: `${dmPartnerDetails?.displayName || 'Kullanıcı'} ile görüntülü arama özelliği yakında eklenecektir.`,
    });
  }, [dmPartnerDetails, toast]);

  const handleReportUser = useCallback(() => {
    toast({
      title: "Kullanıcıyı Şikayet Et (Yakında)",
      description: `${dmPartnerDetails?.displayName || 'Kullanıcı'} şikayet etme özelliği yakında eklenecektir.`,
      variant: "default"
    });
  }, [dmPartnerDetails, toast]);

  const handleBlockUser = useCallback(() => {
    toast({
      title: "Kullanıcıyı Engelle (Yakında)",
      description: `${dmPartnerDetails?.displayName || 'Kullanıcı'} engelleme özelliği yakında eklenecektir.`,
      variant: "destructive"
    });
  }, [dmPartnerDetails, toast]);


  if (loadingDmPartner || !dmPartnerDetails || isUserLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Sohbet yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9">
            <Link href="/direct-messages">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
            </Link>
            </Button>
            <Link href={`/profile/${dmPartnerDetails.uid}`} className="flex items-center gap-2 min-w-0">
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarImage src={dmPartnerDetails.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar"/>
                    <AvatarFallback>{getAvatarFallbackText(dmPartnerDetails.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-primary-foreground/90 truncate hover:underline" title={dmPartnerDetails.displayName || "Sohbet"}>{dmPartnerDetails.displayName || "Sohbet"}</h2>
                </div>
            </Link>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleVideoCall} className="h-9 w-9 text-muted-foreground hover:text-primary">
            <Video className="h-5 w-5" />
            <span className="sr-only">Görüntülü Ara</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">Daha Fazla Seçenek</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleReportUser}>
                <ShieldAlert className="mr-2 h-4 w-4 text-orange-500" />
                Kullanıcıyı Şikayet Et
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockUser} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Ban className="mr-2 h-4 w-4" />
                Kullanıcıyı Engelle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

    <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}>
            {loadingMessages && (
                <div className="flex flex-1 items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p>
                </div>
            )}
            {!loadingMessages && messages.length === 0 && (
                <div className="text-center text-muted-foreground py-10 px-4">
                    <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-lg font-medium">Henüz hiç mesaj yok.</p>
                    <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p>
                </div>
            )}
            
            {messages.map((msg) => (
              <DirectMessageItem
                key={msg.id}
                msg={msg}
                currentUserPhotoURL={userData?.photoURL || currentUser?.photoURL || undefined}
                currentUserDisplayName={userData?.displayName || currentUser?.displayName || undefined}
                getAvatarFallbackText={getAvatarFallbackText}
              />
            ))}
        </ScrollArea>
    </div>

      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
            <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder="Mesajınızı yazın..."
            value={newMessage}
            onChange={handleNewMessageInputChange}
            className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
            autoComplete="off"
            disabled={isSending || isUserLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
              <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={isSending || !newMessage.trim() || isUserLoading}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
