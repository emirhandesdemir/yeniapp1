
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCircle, MessageSquare, Video, MoreVertical, ShieldAlert, Ban, Phone, Star, Flag, Clock, ThumbsUp, ThumbsDown, RefreshCw, MessageSquareHeart, Dot, LogOut, Edit2 } from "lucide-react"; 
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
} from "firebase/firestore";
import { useAuth, type UserData, checkUserPremium } from "@/contexts/AuthContext"; 
import { useToast } from "@/hooks/use-toast";
import { generateDmChatId, cn } from "@/lib/utils";
import DirectMessageItem from "@/components/dm/DirectMessageItem";
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
    isMatchSession?: boolean;
    matchSessionExpiresAt?: Timestamp;
    matchSessionUser1Id?: string;
    matchSessionUser2Id?: string;
    matchSessionUser1Decision?: 'pending' | 'yes' | 'no';
    matchSessionUser2Decision?: 'pending' | 'yes' | 'no';
    matchSessionEnded?: boolean;
    matchSessionEndedReason?: string; 
    matchSessionEndedBy?: string; 
}


export default function MatchChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.chatId as string;
  const [dmPartnerDetails, setDmPartnerDetails] = useState<DmPartnerDetails | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, userData, isUserLoading, reportUser, isCurrentUserPremium } = useAuth();
  const { toast } = useToast();

  const [dmDocData, setDmDocData] = useState<DmDocumentData | null>(null);
  const dmDocDataRef = useRef<DmDocumentData | null>(null); 
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const [myDecision, setMyDecision] = useState<'pending' | 'yes' | 'no'>('pending');
  const [partnerDecision, setPartnerDecision] = useState<'pending' | 'yes' | 'no'>('pending');
  const [decisionProcessing, setDecisionProcessing] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getAvatarFallbackText = useCallback((name?: string | null) => name ? name.substring(0, 2).toUpperCase() : "PN", []);
  
  const handleLeaveMatchSession = useCallback(async (reason: 'user_left' | 'user_left_page' = 'user_left') => {
    if (!currentUser || !chatId || !dmDocDataRef.current || !dmDocDataRef.current.isMatchSession || dmDocDataRef.current.matchSessionEnded) return;
    
    const updates: Partial<DmDocumentData> = {
        matchSessionEnded: true,
        matchSessionEndedReason: reason,
        matchSessionEndedBy: currentUser.uid,
    };
    
    const myCurrentDecision = currentUser.uid === dmDocDataRef.current.matchSessionUser1Id ? dmDocDataRef.current.matchSessionUser1Decision : dmDocDataRef.current.matchSessionUser2Decision;
    if (myCurrentDecision === 'pending') {
        if (currentUser.uid === dmDocDataRef.current.matchSessionUser1Id) updates.matchSessionUser1Decision = 'no';
        else updates.matchSessionUser2Decision = 'no';
    }

    try {
        await updateDoc(doc(db, "directMessages", chatId), updates);
        if(reason !== 'user_left_page') { 
            router.push('/match');
            toast({ title: "Eşleşme Sonlandırıldı", description: "Yeni bir eşleşme arayabilirsiniz." });
        }
    } catch (error) {
        console.error("Error ending match session:", error);
    }
  }, [currentUser, chatId, router, toast]);

  useEffect(() => { dmDocDataRef.current = dmDocData; }, [dmDocData]);

  useEffect(() => {
    const currentDmDocData = dmDocDataRef.current;
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (currentDmDocData?.isMatchSession && !currentDmDocData.matchSessionEnded && currentUser) {
        handleLeaveMatchSession('user_left_page');
      }
    };
  }, [currentUser, handleLeaveMatchSession]);

  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;
    setLoading(true);
    const dmDocRef = doc(db, "directMessages", chatId);
    const unsubscribeDmDoc = onSnapshot(dmDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as DmDocumentData;
            if(!data.isMatchSession && !data.matchSessionEnded) {
                router.replace(`/dm/${chatId}`);
                return;
            }
            setDmDocData(data);
            
            const partnerUid = data.participantUids.find(uid => uid !== currentUser.uid);
            if (!partnerUid) {
                toast({ title: "Hata", description: "Sohbet partneri bulunamadı.", variant: "destructive" });
                router.push("/match"); return;
            }

            const userDocRef = doc(db, "users", partnerUid);
            const userSnap = await getDoc(userDocRef);
            if(userSnap.exists()){
                const partnerData = userSnap.data() as UserData;
                setDmPartnerDetails({ uid: partnerUid, ...partnerData });
                document.title = `Eşleşme: ${partnerData.displayName || 'Kullanıcı'}`;
            }

            setMyDecision(currentUser.uid === data.matchSessionUser1Id ? data.matchSessionUser1Decision || 'pending' : data.matchSessionUser2Decision || 'pending');
            setPartnerDecision(partnerUid === data.matchSessionUser1Id ? data.matchSessionUser1Decision || 'pending' : data.matchSessionUser2Decision || 'pending');

            if (data.matchSessionExpiresAt) {
                const now = Timestamp.now().toMillis();
                const expiry = (data.matchSessionExpiresAt as Timestamp).toMillis();
                setSessionTimeLeft(Math.max(0, Math.floor((expiry - now) / 1000)));
            }

            if(data.matchSessionEnded) {
                toast({ title: "Eşleşme Sonlandı", description: "Bu sohbet oturumu sona erdi.", duration: 5000 });
                router.push('/match');
            }

        } else {
            toast({ title: "Hata", description: "Sohbet bulunamadı.", variant: "destructive" });
            router.push("/match");
        }
        setLoading(false);
    }, (error) => {
        setLoading(false);
        toast({ title: "Hata", description: "Sohbet bilgileri alınırken bir sorun oluştu.", variant: "destructive"});
    });

    const messagesQuery = query(collection(db, `directMessages/${chatId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      setMessages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DirectMessage)).map(msg => ({ ...msg, isOwn: msg.senderId === currentUser?.uid })));
    });

    return () => { unsubscribeDmDoc(); unsubscribeMessages(); };
  }, [chatId, currentUser?.uid, toast, router]);

  useEffect(() => {
    if (sessionTimeLeft !== null && sessionTimeLeft > 0 && dmDocData && !dmDocData.matchSessionEnded) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        setSessionTimeLeft(prev => (prev === null || prev <= 1) ? 0 : prev - 1);
      }, 1000);
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [sessionTimeLeft, dmDocData]);

  const processMatchDecisions = useCallback(async (user1Id: string, user2Id: string) => {
    if (decisionProcessing || !currentUser || !userData || !dmPartnerDetails || !dmDocDataRef.current) return;
    setDecisionProcessing(true);
    const dmDocRef = doc(db, "directMessages", chatId);
    try {
        const batch = writeBatch(db);
        const user1DocRef = doc(db, "users", user1Id);
        const user2DocRef = doc(db, "users", user2Id);
        
        batch.set(doc(user1DocRef, "confirmedFriends", user2Id), { displayName: dmPartnerDetails.displayName, photoURL: dmPartnerDetails.photoURL, isPremium: checkUserPremium(dmPartnerDetails), addedAt: serverTimestamp() });
        batch.set(doc(user2DocRef, "confirmedFriends", user1Id), { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: isCurrentUserPremium(), addedAt: serverTimestamp() });
        batch.update(dmDocRef, { isMatchSession: false, matchSessionEnded: true, matchSessionEndedReason: 'both_yes' });
        await batch.commit();
        
        toast({ title: "Arkadaş Oldunuz!", description: `${dmPartnerDetails.displayName} ile artık arkadaşsınız. Sohbete devam edebilirsiniz.` });
        router.replace(`/dm/${chatId}`);
    } catch (error) {
        toast({ title: "Hata", description: "Arkadaş ekleme işlemi sırasında bir hata oluştu.", variant: "destructive" });
    } finally {
        setDecisionProcessing(false);
    }
  }, [chatId, currentUser, userData, dmPartnerDetails, router, toast, decisionProcessing, isCurrentUserPremium]);

  useEffect(() => {
    if (!dmDocData || dmDocData.matchSessionEnded) return;
    const { matchSessionUser1Decision, matchSessionUser2Decision, matchSessionUser1Id, matchSessionUser2Id, matchSessionExpiresAt } = dmDocData;
    const decisionsMade = matchSessionUser1Decision === 'yes' && matchSessionUser2Decision === 'yes';
    if (decisionsMade) {
      processMatchDecisions(matchSessionUser1Id!, matchSessionUser2Id!);
    } else if (sessionTimeLeft === 0) {
      if (myDecision === 'pending') handleLeaveMatchSession();
    }
  }, [dmDocData, sessionTimeLeft, myDecision, processMatchDecisions, handleLeaveMatchSession]);

  const handleDecisionSubmit = async (decision: 'yes' | 'no') => {
    if (!currentUser || !dmDocData || !dmDocData.isMatchSession || dmDocData.matchSessionEnded || decisionProcessing) return;
    setDecisionProcessing(true);
    const myId = currentUser.uid;
    const updateField = myId === dmDocData.matchSessionUser1Id ? 'matchSessionUser1Decision' : 'matchSessionUser2Decision';
    try {
      await updateDoc(doc(db, "directMessages", chatId), { [updateField]: decision });
      setMyDecision(decision);
      if (decision === 'no') handleLeaveMatchSession();
    } catch (error) {
      toast({ title: "Hata", description: "Kararınız kaydedilemedi.", variant: "destructive" });
    } finally {
        setDecisionProcessing(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => { if (!loading) scrollToBottom(); }, [messages, loading, scrollToBottom]);

  const handleSendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !chatId || !userData || isSending || dmDocData?.matchSessionEnded) return;
    setIsSending(true);
    const tempMessage = newMessage.trim();
    try {
      await updateDoc(doc(db, "directMessages", chatId), { lastMessageTimestamp: serverTimestamp(), lastMessageText: tempMessage.substring(0, 50), lastMessageSenderId: currentUser.uid });
      await addDoc(collection(db, `directMessages/${chatId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName,
        senderAvatar: userData?.photoURL,
        senderIsPremium: isCurrentUserPremium(),
        senderBubbleStyle: userData?.bubbleStyle || 'default',
        senderAvatarFrameStyle: userData?.avatarFrameStyle || 'default',
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }, [currentUser, newMessage, chatId, userData, isSending, toast, dmDocData, isCurrentUserPremium]);

  const formatSessionTime = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };

  if (loading || !dmPartnerDetails || isUserLoading) {
    return (
      <div className="flex flex-1 items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg text-muted-foreground">Eşleşme yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => handleLeaveMatchSession()} className="flex-shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-destructive">
                <LogOut className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0 relative group">
                <div className={cn('relative flex-shrink-0', `avatar-frame-${dmPartnerDetails.avatarFrameStyle || 'default'}`)}>
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 rounded-full">
                        <AvatarImage src={dmPartnerDetails.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar"/>
                        <AvatarFallback className="rounded-full">{getAvatarFallbackText(dmPartnerDetails.displayName)}</AvatarFallback>
                    </Avatar>
                    {checkUserPremium(dmPartnerDetails) && <Star className="absolute bottom-0 left-7 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow-md" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-foreground truncate" title={dmPartnerDetails.displayName || "Sohbet"}>{dmPartnerDetails.displayName || "Sohbet"}</h2>
                    <div className="flex items-center text-xs text-destructive animate-pulse">
                        <Clock className="h-3 w-3 mr-1" /> Kalan Süre: {formatSessionTime(sessionTimeLeft)}
                    </div>
                </div>
            </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollAreaRef}>
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }}>
                <DirectMessageItem msg={msg} getAvatarFallbackText={getAvatarFallbackText} chatId={chatId} isMatchSession={true} onStartEdit={() => {}} onMessageDeleted={() => {}} onMessageEdited={() => {}} />
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      </div>
      <div className="p-3 border-t bg-background/90 backdrop-blur-sm sticky bottom-0 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        {myDecision === 'pending' ? (
          <div className="grid grid-cols-2 gap-3 mb-3">
              <Button onClick={() => handleDecisionSubmit('no')} variant="destructive" size="lg" className="h-12" disabled={decisionProcessing}>
                  {decisionProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ThumbsDown className="mr-2 h-5 w-5"/> Hayır</>}
              </Button>
              <Button onClick={() => handleDecisionSubmit('yes')} className="bg-green-500 hover:bg-green-600 h-12" size="lg" disabled={decisionProcessing}>
                   {decisionProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ThumbsUp className="mr-2 h-5 w-5"/> Evet</>}
              </Button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground p-3 bg-muted rounded-md mb-3">
            {partnerDecision === 'pending' ? 'Partnerinin kararı bekleniyor...' : 'Her iki taraf da kararını verdi.'}
          </div>
        )}
        <form onSubmit={handleSendMessage}>
          <div className="relative flex items-center gap-2">
            <Input
              placeholder="Mesajını yaz..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 pr-12 rounded-full h-11 text-sm bg-muted/50 dark:bg-muted/30 focus:bg-background focus-visible:ring-primary/80"
              autoComplete="off"
              disabled={isSending || isUserLoading || myDecision !== 'pending'}
            />
            <Button type="submit" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 w-9 shadow-md" disabled={isSending || !newMessage.trim() || isUserLoading || myDecision !== 'pending'}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
