
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCircle, MessageSquare, Video, MoreVertical, ShieldAlert, Ban, Phone, Star, Flag, Clock, ThumbsUp, ThumbsDown, RefreshCw, MessageSquareHeart, Dot, LogOut, Edit2, X, Check } from "lucide-react"; 
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent, useCallback, ChangeEvent, useLayoutEffect } from "react";
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
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc as deleteFirestoreDoc, 
  FieldValue
} from "firebase/firestore";
import { useAuth, type UserData, checkUserPremium } from "@/contexts/AuthContext"; 
import { useToast } from "@/hooks/use-toast";
import { generateDmChatId, cn } from "@/lib/utils";
import DirectMessageItem from "@/components/dm/DirectMessageItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { isPast, formatDistanceToNowStrict, differenceInMinutes, formatDistanceToNow } from 'date-fns'; 
import { tr } from 'date-fns/locale';

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean;
  senderBubbleStyle?: string;
  senderAvatarFrameStyle?: string;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  editedAt?: Timestamp | null; 
  reactions?: { [key: string]: string[] };
}

interface DmPartnerDetails {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string | null;
  isPremium?: boolean; 
  isBanned?: boolean;
  lastSeen?: Timestamp | null; 
  avatarFrameStyle?: string;
}

interface DmDocumentData {
    participantUids: string[];
    participantInfo: { [key: string]: { displayName: string | null; photoURL: string | null; isPremium?: boolean; } };
    createdAt: Timestamp;
    lastMessageTimestamp: Timestamp | null;
    lastMessageText?: string;
    lastMessageSenderId?: string;
}

const ACTIVE_THRESHOLD_MINUTES_DM = 2; 

const messageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};


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
  const { currentUser, userData, isUserLoading, reportUser, blockUser, unblockUser, checkIfUserBlocked, checkIfCurrentUserIsBlockedBy, isCurrentUserPremium } = useAuth();
  const { toast } = useToast();

  const [isPartnerBlockedByCurrentUser, setIsPartnerBlockedByCurrentUser] = useState(false);
  const [isCurrentUserBlockedByPartner, setIsCurrentUserBlockedByPartner] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const [dmDocData, setDmDocData] = useState<DmDocumentData | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const getAvatarFallbackText = useCallback((name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  }, []);

  const handleStartEdit = useCallback((messageId: string, currentText: string) => {
    setEditingMessage({ id: messageId, text: currentText });
    setNewMessage(currentText);
    messageInputRef.current?.focus();
  }, []);
  
  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setNewMessage("");
  }, []);
  
  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !newMessage.trim() || newMessage.trim() === editingMessage.text) {
      handleCancelEdit();
      return;
    }
    setIsSending(true);
    const messageRef = doc(db, `directMessages/${chatId}/messages`, editingMessage.id);
    try {
      await updateDoc(messageRef, {
        text: newMessage.trim(),
        editedAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: "Mesajınız düzenlendi." });
    } catch (error) {
      toast({ title: "Hata", description: "Mesaj düzenlenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
      handleCancelEdit();
    }
  }, [editingMessage, newMessage, chatId, toast, handleCancelEdit]);

  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;
    setLoadingDmPartner(true);

    const dmDocRef = doc(db, "directMessages", chatId);
    const unsubscribeDmDoc = onSnapshot(dmDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as DmDocumentData;
            setDmDocData(data);
            
            const partnerUid = data.participantUids.find(uid => uid !== currentUser.uid);
            if (!partnerUid) {
                toast({ title: "Hata", description: "Sohbet partneri bulunamadı.", variant: "destructive" });
                router.push("/friends"); return;
            }
            
            try {
                const userDocRef = doc(db, "users", partnerUid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const partnerData = userSnap.data() as UserData;
                    setDmPartnerDetails({
                        uid: partnerUid,
                        displayName: partnerData.displayName,
                        photoURL: partnerData.photoURL,
                        email: partnerData.email,
                        isPremium: checkUserPremium(partnerData),
                        isBanned: partnerData.isBanned || false,
                        lastSeen: partnerData.lastSeen || null,
                        avatarFrameStyle: partnerData.avatarFrameStyle || 'default',
                    });
                    document.title = `${partnerData.displayName || 'Sohbet'} - DM`;
                } else {
                     const partnerInfoFromDM = data.participantInfo?.[partnerUid];
                     setDmPartnerDetails({
                        uid: partnerUid,
                        displayName: partnerInfoFromDM?.displayName || "Bilinmeyen Kullanıcı",
                        photoURL: partnerInfoFromDM?.photoURL || null,
                        lastSeen: null,
                     });
                     document.title = `${partnerInfoFromDM?.displayName || 'Sohbet'} - DM`;
                }
            } catch (error) {
                console.error("Error fetching partner details:", error);
            }

            if (currentUser && partnerUid) {
                checkIfUserBlocked(partnerUid).then(setIsPartnerBlockedByCurrentUser);
                checkIfCurrentUserIsBlockedBy(partnerUid).then(setIsCurrentUserBlockedByPartner);
            }

        } else {
            toast({ title: "Hata", description: "Sohbet bulunamadı.", variant: "destructive" });
            router.push("/direct-messages");
        }
        setLoadingDmPartner(false);
    }, (error) => {
        setLoadingDmPartner(false);
        toast({ title: "Hata", description: "Sohbet bilgileri alınırken bir sorun oluştu.", variant: "destructive"});
    });
    return () => {
        unsubscribeDmDoc();
    };
  }, [chatId, currentUser?.uid, toast, router, checkIfUserBlocked, checkIfCurrentUserIsBlockedBy]);

  const handleMessageDeleted = useCallback((deletedMessageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== deletedMessageId));
  }, []);

  const handleMessageEdited = useCallback((messageId: string, newText: string, editedAt: Timestamp) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, text: newText, editedAt } : msg
      )
    );
  }, []);

  useEffect(() => {
    if(!chatId || !currentUser?.uid) return;
    setLoadingMessages(true);
    const messagesQuery = query(collection(db, `directMessages/${chatId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: DirectMessage[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedMessages.push({
          id: docSnap.id,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          senderIsPremium: data.senderIsPremium || false,
          senderBubbleStyle: data.senderBubbleStyle || 'default',
          senderAvatarFrameStyle: data.senderAvatarFrameStyle || 'default',
          timestamp: data.timestamp,
          editedAt: data.editedAt, 
          reactions: data.reactions,
        });
      });
      setMessages(fetchedMessages.map(msg => ({
        ...msg,
        isOwn: msg.senderId === currentUser?.uid,
        userAiHint: msg.senderId === currentUser?.uid ? "user avatar" : "person talking"
      })));
      setLoadingMessages(false);
    });
    return () => unsubscribeMessages();
  }, [chatId, currentUser?.uid, toast]);


  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!loadingMessages) {
        scrollToBottom();
    }
  }, [messages, loadingMessages, scrollToBottom]);


  const handleNewMessageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value;
    setNewMessage(currentMessage);
  };

  const handleSendMessage = useCallback(async () => {
    if (!currentUser || !newMessage.trim() || !chatId || !userData || !dmPartnerDetails || isUserLoading) return;
    if (isCurrentUserBlockedByPartner) {
        toast({ title: "Engellendiniz", description: "Bu kullanıcı tarafından engellendiğiniz için mesaj gönderemezsiniz.", variant: "destructive"});
        return;
    }
    if (isPartnerBlockedByCurrentUser) {
        toast({ title: "Engellendi", description: "Bu kullanıcıyı engellediğiniz için mesaj gönderemezsiniz. Engeli kaldırmayı deneyin.", variant: "destructive"});
        return;
    }

    if (isSending) return;
    setIsSending(true);
    const tempMessage = newMessage.trim();
    const userIsCurrentlyPremium = isCurrentUserPremium();

    try {
      const dmChatDocRef = doc(db, "directMessages", chatId);
      const messageDataForParentDoc = {
        lastMessageTimestamp: serverTimestamp(),
        lastMessageText: tempMessage.substring(0, 50),
        lastMessageSenderId: currentUser.uid,
      };

      const dmChatDocSnap = await getDoc(dmChatDocRef);
      if (!dmChatDocSnap.exists()) {
         await setDoc(dmChatDocRef, {
          participantUids: [currentUser.uid, dmPartnerDetails.uid].sort(),
          participantInfo: {
            [currentUser.uid]: { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: userIsCurrentlyPremium },
            [dmPartnerDetails.uid]: { displayName: dmPartnerDetails.displayName, photoURL: dmPartnerDetails.photoURL, isPremium: dmPartnerDetails.isPremium }
          },
          createdAt: serverTimestamp(),
          ...messageDataForParentDoc,
          isMatchSession: false,
        });
      } else if (dmChatDocSnap.exists()) {
         await updateDoc(dmChatDocRef, messageDataForParentDoc);
      }
      
      await addDoc(collection(db, `directMessages/${chatId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || "Bilinmeyen",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        senderIsPremium: userIsCurrentlyPremium,
        senderBubbleStyle: userData?.bubbleStyle || 'default',
        senderAvatarFrameStyle: userData?.avatarFrameStyle || 'default',
        timestamp: serverTimestamp(),
        editedAt: null, 
        reactions: {},
      });
      setNewMessage("");
    } catch (error) {
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  },[currentUser, newMessage, chatId, userData, dmPartnerDetails, isUserLoading, isSending, toast, isCurrentUserPremium, isPartnerBlockedByCurrentUser, isCurrentUserBlockedByPartner]);
  
  const handleFormSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (editingMessage) {
        handleSaveEdit();
    } else {
        handleSendMessage();
    }
  }, [editingMessage, handleSaveEdit, handleSendMessage]);

  const handleVoiceCall = useCallback(async () => {
    if (!currentUser || !userData || !dmPartnerDetails) return;
    if (isCurrentUserBlockedByPartner || isPartnerBlockedByCurrentUser) {
      toast({ title: "Engellendi", description: "Engellenmiş bir kullanıcı ile arama başlatamazsınız.", variant: "destructive"});
      return;
    }

    const callId = doc(collection(db, "directCalls")).id;
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    try {
      await setDoc(doc(db, "directCalls", callId), {
        callId: callId,
        callerId: currentUser.uid,
        callerName: userData.displayName,
        callerAvatar: userData.photoURL,
        callerIsPremium: currentUserIsCurrentlyPremium, 
        calleeId: dmPartnerDetails.uid,
        calleeName: dmPartnerDetails.displayName,
        calleeAvatar: dmPartnerDetails.photoURL,
        calleeIsPremium: dmPartnerDetails.isPremium, 
        status: "initiating",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Arama Başlatılıyor...", description: `${dmPartnerDetails.displayName || 'Kullanıcı'} aranıyor.` });
      router.push(`/call/${callId}`);
    } catch (error) {
      toast({ title: "Arama Hatası", description: "Arama başlatılırken bir sorun oluştu.", variant: "destructive" });
    }
  }, [currentUser, userData, dmPartnerDetails, router, toast, isCurrentUserPremium, isPartnerBlockedByCurrentUser, isCurrentUserBlockedByPartner]);

  const handleVideoCall = useCallback(() => {
    toast({
      title: "Görüntülü Arama (Yakında)",
      description: `${dmPartnerDetails?.displayName || 'Kullanıcı'} ile görüntülü arama özelliği yakında eklenecektir.`,
    });
  }, [dmPartnerDetails, toast]);

  const handleReportUserConfirmation = async () => {
    if (!currentUser || !dmPartnerDetails) return;
    setIsReportDialogOpen(false);
    await reportUser(dmPartnerDetails.uid, reportReason.trim() || `DM sohbetinden (${chatId}) şikayet`);
    setReportReason("");
  };

  const handleBlockOrUnblockUser = async () => {
    if (!currentUser || !dmPartnerDetails) return;
    setIsSending(true); 
    if (isPartnerBlockedByCurrentUser) {
        await unblockUser(dmPartnerDetails.uid);
        setIsPartnerBlockedByCurrentUser(false);
    } else {
        await blockUser(dmPartnerDetails.uid, dmPartnerDetails.displayName, dmPartnerDetails.photoURL);
        setIsPartnerBlockedByCurrentUser(true);
    }
    setIsSending(false);
  };

  const formatPartnerLastSeen = (lastSeen: Timestamp | null | undefined): string => {
    if (!lastSeen) return "Son görülme bilinmiyor";
    const lastSeenDate = lastSeen.toDate();
    const now = new Date();
    const diffMins = differenceInMinutes(now, lastSeenDate);

    if (diffMins < ACTIVE_THRESHOLD_MINUTES_DM) return "Aktif";
    return `Son görülme: ${formatDistanceToNow(lastSeenDate, { addSuffix: true, locale: tr })}`;
  };


  if (loadingDmPartner || !dmPartnerDetails || isUserLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Sohbet yükleniyor...</p>
      </div>
    );
  }
  
  if (isCurrentUserBlockedByPartner) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center h-screen bg-card p-6 text-center rounded-xl shadow-lg">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Engellendiniz</h2>
        <p className="text-muted-foreground mb-6">
          {dmPartnerDetails.displayName || "Bu kullanıcı"} tarafından engellendiğiniz için bu sohbeti görüntüleyemezsiniz.
        </p>
        <Button variant="outline" onClick={() => router.push('/direct-messages')} className="rounded-lg">
          <ArrowLeft className="mr-2 h-4 w-4" /> Direkt Mesajlara Dön
        </Button>
      </div>
    );
  }

  const partnerActivityStatus = formatPartnerLastSeen(dmPartnerDetails?.lastSeen);
  const isPartnerCurrentlyActive = partnerActivityStatus === "Aktif";

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push('/direct-messages')} className="flex-shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0 relative group cursor-pointer" onClick={() => router.push(`/profile/${dmPartnerDetails.uid}`)}>
                <div className={cn('relative flex-shrink-0', `avatar-frame-${dmPartnerDetails.avatarFrameStyle || 'default'}`)}>
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-transparent group-hover:border-primary/50 transition-colors duration-200 rounded-full">
                        <AvatarImage src={dmPartnerDetails.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar"/>
                        <AvatarFallback className="rounded-full">{getAvatarFallbackText(dmPartnerDetails.displayName)}</AvatarFallback>
                    </Avatar>
                    {isPartnerCurrentlyActive && <Dot className="absolute -bottom-1 -right-1 h-6 w-6 text-green-500 fill-green-500" />}
                    {dmPartnerDetails.isPremium && <Star className="absolute bottom-0 left-7 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow-md" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-foreground truncate transition-colors group-hover:text-primary" title={dmPartnerDetails.displayName || "Sohbet"}>
                        {dmPartnerDetails.displayName || "Sohbet"}
                    </h2>
                     <p className={cn("text-xs", isPartnerCurrentlyActive ? "text-green-600" : "text-muted-foreground")}>
                        {partnerActivityStatus}
                    </p>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleVoiceCall} className="h-9 w-9 rounded-full text-green-500 hover:text-green-600 hover:bg-green-500/10" disabled={isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || isUserLoading} aria-label="Sesli Ara">
                <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleVideoCall} className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" disabled={isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || isUserLoading} aria-label="Görüntülü Ara (Yakında)">
                <Video className="h-5 w-5" />
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary" disabled={isUserLoading}>
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Daha Fazla Seçenek</span>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-lg shadow-xl border-border/50">
                    <DropdownMenuItem onClick={() => router.push(`/profile/${dmPartnerDetails.uid}`)} className="cursor-pointer">
                        <UserCircle className="mr-2 h-4 w-4"/> Profili Görüntüle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="cursor-pointer text-orange-600 focus:text-orange-700 focus:bg-orange-500/10">
                        <Flag className="mr-2 h-4 w-4" />
                        Kullanıcıyı Şikayet Et
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBlockOrUnblockUser} className={cn("cursor-pointer", isPartnerBlockedByCurrentUser ? "text-green-600 focus:text-green-700 focus:bg-green-500/10" : "text-destructive focus:text-destructive focus:bg-destructive/10")}>
                        <Ban className="mr-2 h-4 w-4" />
                        {isPartnerBlockedByCurrentUser ? "Engeli Kaldır" : "Kullanıcıyı Engelle"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>

    <div className="flex flex-1 overflow-hidden">
      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollAreaRef}>
        <AnimatePresence initial={false}>
            {loadingMessages && messages.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-1 items-center justify-center py-10"
                >
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p>
                </motion.div>
            )}
            {!loadingMessages && messages.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="text-center text-muted-foreground py-10 px-4"
                >
                    <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-lg font-medium">Henüz hiç mesaj yok.</p>
                    <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p>
                </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                variants={messageVariants}
                initial="hidden"
                animate="visible"
              >
                <DirectMessageItem
                  msg={msg}
                  getAvatarFallbackText={getAvatarFallbackText}
                  chatId={chatId}
                  onStartEdit={handleStartEdit}
                  onMessageDeleted={handleMessageDeleted}
                  onMessageEdited={handleMessageEdited}
                />
              </motion.div>
            ))}
        </AnimatePresence>
        </ScrollArea>
    </div>

      <form onSubmit={handleFormSubmit} className="p-2.5 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <AnimatePresence>
          {editingMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: '8px' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="bg-secondary/50 rounded-lg px-3 py-2 border-l-4 border-primary"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-primary">Mesajı Düzenle</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">{editingMessage.text}</p>
                </div>
                <Button variant="ghost" size="icon" type="button" onClick={handleCancelEdit}>
                  <X className="h-4 w-4"/>
                  <span className="sr-only">Düzenlemeyi İptal Et</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner} className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-primary">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            ref={messageInputRef}
            placeholder={isPartnerBlockedByCurrentUser ? "Bu kullanıcıyı engellediniz" : isCurrentUserBlockedByPartner ? "Bu kullanıcı tarafından engellendiniz" : editingMessage ? "Mesajı düzenle..." : "Mesajınızı yazın..."}
            value={newMessage}
            onChange={handleNewMessageInputChange}
            className="flex-1 pr-[calc(2.5rem+0.5rem+2.25rem)] sm:pr-[calc(2.5rem+0.5rem+2.5rem)] rounded-full h-10 sm:h-11 text-sm bg-muted/50 dark:bg-muted/30 focus:bg-background focus-visible:ring-primary/80"
            autoComplete="off"
            disabled={isSending || isUserLoading || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner} className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hidden sm:inline-flex text-muted-foreground hover:text-primary">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9 shadow-md hover:shadow-lg transition-shadow" disabled={isSending || !newMessage.trim() || isUserLoading || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMessage ? <Check className="h-4 w-4"/> : <Send className="h-4 w-4" />}
              <span className="sr-only">{editingMessage ? 'Kaydet' : 'Gönder'}</span>
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Şikayet Et</AlertDialogTitle>
            <AlertDialogDescription>
                {dmPartnerDetails?.displayName || "Bu kullanıcıyı"} şikayet etmek için bir neden belirtebilirsiniz (isteğe bağlı). Şikayetiniz incelenecektir.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Şikayet nedeni (isteğe bağlı)..."
                className="w-full p-2 border rounded-md min-h-[80px] text-sm bg-background"
            />
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason("")} disabled={isUserLoading}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportUserConfirmation} className="bg-destructive hover:bg-destructive/90" disabled={isUserLoading}>Şikayet Et</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
