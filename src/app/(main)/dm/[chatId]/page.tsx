
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, UserCircle, MessageSquare, Video, MoreVertical, ShieldAlert, Ban, Phone, Star, Flag, Clock, ThumbsUp, ThumbsDown, RefreshCw, MessageSquareHeart } from "lucide-react"; 
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
  setDoc,
  updateDoc, // Eklendi
  writeBatch, // Eklendi
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
import { isPast } from 'date-fns';

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean; 
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
}

interface DmPartnerDetails {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string | null;
  isPremium?: boolean; 
  isBanned?: boolean;
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
}

const TYPING_DEBOUNCE_DELAY = 1500;
const MATCH_SESSION_DURATION_SECONDS = 4 * 60; // 4 dakika

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

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPartnerBlockedByCurrentUser, setIsPartnerBlockedByCurrentUser] = useState(false);
  const [isCurrentUserBlockedByPartner, setIsCurrentUserBlockedByPartner] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  // Match session states
  const [dmDocData, setDmDocData] = useState<DmDocumentData | null>(null);
  const [isMatchSessionChat, setIsMatchSessionChat] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [myDecision, setMyDecision] = useState<'pending' | 'yes' | 'no'>('pending');
  const [partnerDecision, setPartnerDecision] = useState<'pending' | 'yes' | 'no'>('pending');
  const [decisionProcessing, setDecisionProcessing] = useState(false);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getAvatarFallbackText = useCallback((name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  }, []);

  // Firestore listener for DM document (including match session fields)
  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;
    setLoadingDmPartner(true);

    const dmDocRef = doc(db, "directMessages", chatId);
    const unsubscribeDmDoc = onSnapshot(dmDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as DmDocumentData;
            setDmDocData(data);
            setIsMatchSessionChat(data.isMatchSession || false);

            const partnerUid = data.participantUids.find(uid => uid !== currentUser.uid);
            if (!partnerUid) {
                toast({ title: "Hata", description: "Sohbet partneri bulunamadı.", variant: "destructive" });
                router.push("/friends"); return;
            }

            if (data.participantInfo && data.participantInfo[partnerUid]) {
                 setDmPartnerDetails({
                    uid: partnerUid,
                    displayName: data.participantInfo[partnerUid].displayName,
                    photoURL: data.participantInfo[partnerUid].photoURL,
                    isPremium: data.participantInfo[partnerUid].isPremium || false,
                 });
            } else {
                // Fetch partner details if not in participantInfo (shouldn't happen often with new logic)
                const userDocRef = doc(db, "users", partnerUid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    const partnerData = userSnap.data() as UserData;
                    setDmPartnerDetails({
                        uid: partnerUid, displayName: partnerData.displayName, photoURL: partnerData.photoURL, email: partnerData.email,
                        isPremium: checkUserPremium(partnerData), isBanned: partnerData.isBanned || false,
                    });
                }
            }
            document.title = `${dmPartnerDetails?.displayName || 'Sohbet'} - DM`;

            if (currentUser && partnerUid) {
                checkIfUserBlocked(partnerUid).then(setIsPartnerBlockedByCurrentUser);
                checkIfCurrentUserIsBlockedBy(partnerUid).then(setIsCurrentUserBlockedByPartner);
            }

            if (data.isMatchSession) {
                const myId = currentUser.uid;
                const otherId = partnerUid;
                setMyDecision(myId === data.matchSessionUser1Id ? data.matchSessionUser1Decision || 'pending' : data.matchSessionUser2Decision || 'pending');
                setPartnerDecision(otherId === data.matchSessionUser1Id ? data.matchSessionUser1Decision || 'pending' : data.matchSessionUser2Decision || 'pending');

                if (data.matchSessionEnded) {
                    setShowDecisionModal(false);
                    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
                    setSessionTimeLeft(0);
                } else if (data.matchSessionExpiresAt) {
                    const now = Timestamp.now().toMillis();
                    const expiry = (data.matchSessionExpiresAt as Timestamp).toMillis();
                    const timeLeft = Math.max(0, Math.floor((expiry - now) / 1000));
                    setSessionTimeLeft(timeLeft);
                    if (timeLeft === 0 && (myDecision === 'pending' || partnerDecision === 'pending')) {
                         setShowDecisionModal(true);
                    }
                }

                // Process decisions if both are made
                if ((data.matchSessionUser1Decision !== 'pending' && data.matchSessionUser2Decision !== 'pending') && !data.matchSessionEnded) {
                   await processMatchDecisions(data.matchSessionUser1Decision!, data.matchSessionUser2Decision!, data.matchSessionUser1Id!, data.matchSessionUser2Id!);
                }
            }

        } else {
            toast({ title: "Hata", description: "Sohbet bulunamadı.", variant: "destructive" });
            router.push("/direct-messages");
        }
        setLoadingDmPartner(false);
    }, (error) => {
        console.error("Error fetching DM document:", error);
        toast({ title: "Hata", description: "Sohbet bilgileri alınırken bir sorun oluştu.", variant: "destructive"});
        setLoadingDmPartner(false);
    });
    return () => unsubscribeDmDoc();

  }, [chatId, currentUser?.uid, toast, router, checkIfUserBlocked, checkIfCurrentUserIsBlockedBy, dmPartnerDetails?.displayName]);


  // Match session timer logic
  useEffect(() => {
    if (isMatchSessionChat && sessionTimeLeft !== null && sessionTimeLeft > 0 && dmDocData && !dmDocData.matchSessionEnded) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        setSessionTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(sessionTimerRef.current!);
            if(myDecision === 'pending' || partnerDecision === 'pending') {
                setShowDecisionModal(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (sessionTimeLeft === 0 && isMatchSessionChat && dmDocData && !dmDocData.matchSessionEnded) {
        if(myDecision === 'pending' || partnerDecision === 'pending') {
             setShowDecisionModal(true);
        }
    }
    return () => {
        if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [isMatchSessionChat, sessionTimeLeft, dmDocData, myDecision, partnerDecision]);


  const processMatchDecisions = useCallback(async (
    decision1: 'yes' | 'no',
    decision2: 'yes' | 'no',
    user1Id: string,
    user2Id: string
  ) => {
    if (decisionProcessing || !currentUser || !userData || !dmPartnerDetails) return;
    setDecisionProcessing(true);
    const dmDocRef = doc(db, "directMessages", chatId);

    if (decision1 === 'yes' && decision2 === 'yes') {
        // Add friends
        try {
            const batch = writeBatch(db);
            const user1DocRef = doc(db, "users", user1Id);
            const user2DocRef = doc(db, "users", user2Id);
            
            const user1DataSnap = await getDoc(user1DocRef);
            const user2DataSnap = await getDoc(user2DocRef);

            if(user1DataSnap.exists() && user2DataSnap.exists()){
                const user1Data = user1DataSnap.data() as UserData;
                const user2Data = user2DataSnap.data() as UserData;

                batch.set(doc(user1DocRef, "confirmedFriends", user2Id), { 
                    displayName: user2Data.displayName, photoURL: user2Data.photoURL, 
                    isPremium: checkUserPremium(user2Data), addedAt: serverTimestamp() 
                });
                batch.set(doc(user2DocRef, "confirmedFriends", user1Id), { 
                    displayName: user1Data.displayName, photoURL: user1Data.photoURL, 
                    isPremium: checkUserPremium(user1Data), addedAt: serverTimestamp() 
                });
            }

            batch.update(dmDocRef, {
                isMatchSession: false,
                matchSessionEnded: true,
                // Optionally clear other matchSession fields
                matchSessionExpiresAt: null,
                matchSessionUser1Decision: null,
                matchSessionUser2Decision: null,
            });
            await batch.commit();
            toast({ title: "Arkadaş Oldunuz!", description: `${dmPartnerDetails.displayName} ile artık arkadaşsınız. Sohbete devam edebilirsiniz.` });
            setShowDecisionModal(false);
        } catch (error) {
            console.error("Error adding friends or updating DM doc:", error);
            toast({ title: "Hata", description: "Arkadaş ekleme işlemi sırasında bir hata oluştu.", variant: "destructive" });
        }
    } else {
        // One or both said no
        try {
            await updateDoc(dmDocRef, {
                matchSessionEnded: true,
                matchSessionExpiresAt: null, // Oturumu sonlandır
            });
            toast({ title: "Eşleşme Sonlandı", description: "Sohbet devam etmeyecek.", variant: "default" });
            setShowDecisionModal(false);
            router.push('/match'); // Redirect to match page for new search
        } catch (error) {
            console.error("Error ending match session:", error);
        }
    }
    setDecisionProcessing(false);
  }, [chatId, currentUser, userData, dmPartnerDetails, router, toast, decisionProcessing]);

  // Listen for both decisions to be made, or timer to end.
  useEffect(() => {
    if (!dmDocData || dmDocData.matchSessionEnded || !isMatchSessionChat) return;

    const { matchSessionUser1Decision, matchSessionUser2Decision, matchSessionUser1Id, matchSessionUser2Id, matchSessionExpiresAt } = dmDocData;
    
    const decisionsMade = matchSessionUser1Decision !== 'pending' && matchSessionUser2Decision !== 'pending';
    const timerExpired = matchSessionExpiresAt && isPast(matchSessionExpiresAt.toDate());

    if (decisionsMade) {
      processMatchDecisions(matchSessionUser1Decision!, matchSessionUser2Decision!, matchSessionUser1Id!, matchSessionUser2Id!);
    } else if (timerExpired && (matchSessionUser1Decision === 'pending' || matchSessionUser2Decision === 'pending')) {
      // If timer expired and one user hasn't decided, treat their decision as 'no'
      const finalUser1Decision = matchSessionUser1Decision === 'pending' ? 'no' : matchSessionUser1Decision!;
      const finalUser2Decision = matchSessionUser2Decision === 'pending' ? 'no' : matchSessionUser2Decision!;
      processMatchDecisions(finalUser1Decision, finalUser2Decision, matchSessionUser1Id!, matchSessionUser2Id!);
    }
  }, [dmDocData, isMatchSessionChat, processMatchDecisions]);


  const handleDecisionSubmit = async (decision: 'yes' | 'no') => {
    if (!currentUser || !dmDocData || !dmDocData.isMatchSession || dmDocData.matchSessionEnded || decisionProcessing) return;
    setDecisionProcessing(true);
    
    const myId = currentUser.uid;
    const updateField = myId === dmDocData.matchSessionUser1Id ? 'matchSessionUser1Decision' : 'matchSessionUser2Decision';
    
    try {
      await updateDoc(doc(db, "directMessages", chatId), {
        [updateField]: decision
      });
      setMyDecision(decision); // Optimistic update for UI
      // Listener will pick up the change and trigger processMatchDecisions if partner also decided
    } catch (error) {
      console.error("Error submitting decision:", error);
      toast({ title: "Hata", description: "Kararınız kaydedilemedi.", variant: "destructive" });
    } finally {
        setDecisionProcessing(false);
    }
  };


  useEffect(() => {
    if(!chatId || !currentUser?.uid) return;
    setLoadingMessages(true);
    const messagesQuery = query(collection(db, `directMessages/${chatId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: DirectMessage[] = [];
      querySnapshot.forEach((docSnap) => { // doc -> docSnap olarak değiştirildi
        const data = docSnap.data();
        fetchedMessages.push({
          id: docSnap.id,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          senderIsPremium: data.senderIsPremium || false, 
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
       if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
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

  const handleSendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !chatId || !userData || !dmPartnerDetails || isUserLoading) {
        return;
    }
    if (isCurrentUserBlockedByPartner) {
        toast({ title: "Engellendiniz", description: "Bu kullanıcı tarafından engellendiğiniz için mesaj gönderemezsiniz.", variant: "destructive"});
        return;
    }
    if (isPartnerBlockedByCurrentUser) {
        toast({ title: "Engellendi", description: "Bu kullanıcıyı engellediğiniz için mesaj gönderemezsiniz. Engeli kaldırmayı deneyin.", variant: "destructive"});
        return;
    }
    if (isMatchSessionChat && dmDocData?.matchSessionEnded) {
        toast({ title: "Eşleşme Sonlandı", description: "Bu geçici sohbet sona erdiği için mesaj gönderemezsiniz.", variant: "default" });
        return;
    }


    if (isSending) return;

    setIsSending(true);
    const tempMessage = newMessage.trim();
    const userIsCurrentlyPremium = isCurrentUserPremium();

    try {
      const dmChatDocRef = doc(db, "directMessages", chatId);
      // Parent DM doc update is handled by onSnapshot listener to avoid race conditions if it doesn't exist
      // Here we just add the message.
      
      const messageDataForParentDoc = {
        lastMessageTimestamp: serverTimestamp(),
        lastMessageText: tempMessage.substring(0, 50),
        lastMessageSenderId: currentUser.uid,
      };

      const dmChatDocSnap = await getDoc(dmChatDocRef);
      if (!dmChatDocSnap.exists() && !isMatchSessionChat) { // Only create if not a match session that should pre-exist
         await setDoc(dmChatDocRef, {
          participantUids: [currentUser.uid, dmPartnerDetails.uid].sort(),
          participantInfo: {
            [currentUser.uid]: { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: userIsCurrentlyPremium },
            [dmPartnerDetails.uid]: { displayName: dmPartnerDetails.displayName, photoURL: dmPartnerDetails.photoURL, isPremium: dmPartnerDetails.isPremium }
          },
          createdAt: serverTimestamp(),
          ...messageDataForParentDoc,
          isMatchSession: false, // Ensure it's marked as not a match session
        });
      } else if (dmChatDocSnap.exists()) {
         await updateDoc(dmChatDocRef, messageDataForParentDoc);
      }


      await addDoc(collection(db, `directMessages/${chatId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        senderIsPremium: userIsCurrentlyPremium, 
        timestamp: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending DM:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  },[currentUser, newMessage, chatId, userData, dmPartnerDetails, isUserLoading, isSending, toast, isCurrentUserPremium, isPartnerBlockedByCurrentUser, isCurrentUserBlockedByPartner, isMatchSessionChat, dmDocData]);

  const handleVoiceCall = useCallback(async () => {
    if (!currentUser || !userData || !dmPartnerDetails) {
      toast({ title: "Hata", description: "Arama başlatılamadı. Kullanıcı bilgileri eksik.", variant: "destructive" });
      return;
    }
    if (isCurrentUserBlockedByPartner || isPartnerBlockedByCurrentUser) {
      toast({ title: "Engellendi", description: "Engellenmiş bir kullanıcı ile arama başlatamazsınız.", variant: "destructive"});
      return;
    }
    if (isMatchSessionChat && !dmDocData?.matchSessionEnded) {
        toast({ title: "Geçici Sohbet", description: "Bu geçici sohbette arama yapılamaz. Arkadaş olarak ekledikten sonra arayabilirsiniz.", variant: "default" });
        return;
    }


    const callId = doc(collection(db, "directCalls")).id;
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    try {
      const callDocRef = doc(db, "directCalls", callId);
      await setDoc(callDocRef, {
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
      console.error("Error initiating call from DM header:", error);
      toast({ title: "Arama Hatası", description: "Arama başlatılırken bir sorun oluştu.", variant: "destructive" });
    }
  }, [currentUser, userData, dmPartnerDetails, router, toast, isCurrentUserPremium, isPartnerBlockedByCurrentUser, isCurrentUserBlockedByPartner, isMatchSessionChat, dmDocData]);

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
    // setIsUserLoading(true); // Use isUserLoading for consistency, or a new state if needed
    if (isPartnerBlockedByCurrentUser) {
        await unblockUser(dmPartnerDetails.uid);
        setIsPartnerBlockedByCurrentUser(false);
    } else {
        await blockUser(dmPartnerDetails.uid, dmPartnerDetails.displayName, dmPartnerDetails.photoURL);
        setIsPartnerBlockedByCurrentUser(true);
    }
    // setIsUserLoading(false);
  };

  const formatSessionTime = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
            <Link href="/direct-messages" aria-label="Direkt Mesajlara Dön">
                <ArrowLeft className="h-5 w-5" />
            </Link>
            </Button>
            <Link href={`/profile/${dmPartnerDetails.uid}`} className="flex items-center gap-2 min-w-0 relative group">
                <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 border-2 border-transparent group-hover:border-primary/50 transition-colors duration-200 rounded-full">
                    <AvatarImage src={dmPartnerDetails.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar"/>
                    <AvatarFallback className="rounded-full">{getAvatarFallbackText(dmPartnerDetails.displayName)}</AvatarFallback>
                </Avatar>
                {dmPartnerDetails.isPremium && <Star className="absolute bottom-0 left-7 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow-md" />}
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate" title={dmPartnerDetails.displayName || "Sohbet"}>{dmPartnerDetails.displayName || "Sohbet"}</h2>
                    {isMatchSessionChat && sessionTimeLeft !== null && sessionTimeLeft > 0 && !dmDocData?.matchSessionEnded && (
                        <div className="flex items-center text-xs text-destructive animate-pulse">
                            <Clock className="h-3 w-3 mr-1" /> Kalan Süre: {formatSessionTime(sessionTimeLeft)}
                        </div>
                    )}
                     {isMatchSessionChat && dmDocData?.matchSessionEnded && (
                        <p className="text-xs text-muted-foreground">Eşleşme sohbeti sonlandı.</p>
                    )}
                </div>
            </Link>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleVoiceCall} className="h-9 w-9 rounded-full text-green-500 hover:text-green-600 hover:bg-green-500/10" disabled={isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || isUserLoading || (isMatchSessionChat && !dmDocData?.matchSessionEnded)} aria-label="Sesli Ara">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleVideoCall} className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" disabled={isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || isUserLoading || (isMatchSessionChat && !dmDocData?.matchSessionEnded)} aria-label="Görüntülü Ara (Yakında)">
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
              {!isMatchSessionChat && ( // Sadece kalıcı DM'lerde göster
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="cursor-pointer text-orange-600 focus:text-orange-700 focus:bg-orange-500/10">
                    <Flag className="mr-2 h-4 w-4" />
                    Kullanıcıyı Şikayet Et
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBlockOrUnblockUser} className={cn("cursor-pointer", isPartnerBlockedByCurrentUser ? "text-green-600 focus:text-green-700 focus:bg-green-500/10" : "text-destructive focus:text-destructive focus:bg-destructive/10")}>
                    <Ban className="mr-2 h-4 w-4" />
                    {isPartnerBlockedByCurrentUser ? "Engeli Kaldır" : "Kullanıcıyı Engelle"}
                  </DropdownMenuItem>
                </>
              )}
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
                />
              </motion.div>
            ))}
        </AnimatePresence>
        </ScrollArea>
    </div>

      <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0 shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || (isMatchSessionChat && dmDocData?.matchSessionEnded)} className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-primary">
            <Smile className="h-5 w-5" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder={isPartnerBlockedByCurrentUser ? "Bu kullanıcıyı engellediniz" : isCurrentUserBlockedByPartner ? "Bu kullanıcı tarafından engellendiniz" : (isMatchSessionChat && dmDocData?.matchSessionEnded) ? "Eşleşme sohbeti sonlandı" : "Mesajınızı yazın..."}
            value={newMessage}
            onChange={handleNewMessageInputChange}
            className="flex-1 pr-[calc(2.5rem+0.5rem+2.25rem)] sm:pr-[calc(2.5rem+0.5rem+2.5rem)] rounded-full h-10 sm:h-11 text-sm bg-muted/50 dark:bg-muted/30 focus:bg-background focus-visible:ring-primary/80"
            autoComplete="off"
            disabled={isSending || isUserLoading || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || (isMatchSessionChat && dmDocData?.matchSessionEnded)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button variant="ghost" size="icon" type="button" disabled={isUserLoading || isSending || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || (isMatchSessionChat && dmDocData?.matchSessionEnded)} className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hidden sm:inline-flex text-muted-foreground hover:text-primary">
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9 shadow-md hover:shadow-lg transition-shadow" disabled={isSending || !newMessage.trim() || isUserLoading || isPartnerBlockedByCurrentUser || isCurrentUserBlockedByPartner || (isMatchSessionChat && dmDocData?.matchSessionEnded)}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Gönder</span>
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

      {/* Match Decision Modal */}
      <AlertDialog open={showDecisionModal && isMatchSessionChat && !dmDocData?.matchSessionEnded && myDecision === 'pending'} onOpenChange={(open) => { if(!open) setShowDecisionModal(false); }}>
        <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
                <div className="flex justify-center mb-3">
                    <MessageSquareHeart className="h-12 w-12 text-primary"/>
                </div>
                <AlertDialogTitle className="text-center text-xl">Sohbete Devam Etmek İster Misin?</AlertDialogTitle>
                <AlertDialogDescription className="text-center text-sm">
                    {dmPartnerDetails?.displayName || "Partnerin"} ile sohbete devam etmek ve arkadaş olmak için "Evet"e tıkla.
                    İstemiyorsan "Hayır" diyerek yeni bir eşleşme arayabilirsin.
                </AlertDialogDescription>
                 {sessionTimeLeft !== null && sessionTimeLeft > 0 && (
                    <p className="text-center text-xs text-muted-foreground pt-1">Kalan Süre: {formatSessionTime(sessionTimeLeft)}</p>
                )}
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2 pt-3">
                <Button onClick={() => handleDecisionSubmit('yes')} className="w-full bg-green-500 hover:bg-green-600 text-white" disabled={decisionProcessing}>
                    {decisionProcessing && myDecision === 'yes' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsUp className="mr-2 h-4 w-4"/>} Evet, Devam Et & Arkadaş Ol
                </Button>
                <Button onClick={() => handleDecisionSubmit('no')} className="w-full" variant="destructive" disabled={decisionProcessing}>
                     {decisionProcessing && myDecision === 'no' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>} Hayır, Yeni Eşleşme Ara
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


    