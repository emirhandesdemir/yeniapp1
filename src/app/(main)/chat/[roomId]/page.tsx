
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb, Info, Mic, MicOff, PhoneOutgoing, PhoneOff } from "lucide-react";
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
  getDocs,
  where,
  writeBatch,
  increment,
  setDoc,
  deleteField,
} from "firebase/firestore";
import { useAuth, type UserData, type FriendRequest } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast, addSeconds } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import GameQuestionCard from "@/components/game/GameQuestionCard";
import { generateDmChatId } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteChatRoomAndSubcollections } from "@/lib/firestoreUtils";
import Image from 'next/image';
import ChatMessageItem from '@/components/chat/ChatMessageItem';


interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  isGameMessage?: boolean;
}

interface ChatRoomDetails {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  participantCount?: number;
  maxParticipants: number;
  expiresAt?: Timestamp;
  currentGameQuestionId?: string | null;
  nextGameQuestionTimestamp?: Timestamp | null;
  gameInitialized?: boolean;
}

interface ActiveParticipant {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  joinedAt?: Timestamp;
  isTyping?: boolean;
}

interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

interface GameQuestion {
  id: string;
  text: string;
  answer: string;
  hint: string;
}

const FIXED_GAME_REWARD = 1;
const HINT_COST = 1;

const HARDCODED_QUESTIONS: GameQuestion[] = [
  { id: "q1", text: "Hangi anahtar kapı açmaz?", answer: "klavye", hint: "Bilgisayarda yazı yazmak için kullanılır." },
  { id: "q2", text: "Hangi ilimizde trafik lambası yoktur?", answer: "sinop", hint: "Karadeniz'de bir yarımada üzerindedir." },
  { id: "q3", text: "Her zaman önünüzde olan ama göremediğiniz şey nedir?", answer: "gelecek", hint: "Henüz yaşanmamış zaman dilimi." },
  { id: "q4", text: "Matematikte asal sayı olmayan tek çift sayı hangisidir?", answer: "2", hint: "En küçük asal sayıdır." },
  { id: "q5", text: "Bir fili buzdolabına nasıl sokarsın?", answer: "sokamazsın", hint: "Bu bir şaşırtmaca sorusu olabilir!" },
  { id: "q6", text: "Geceleri gelir, gündüzleri kaybolur. Nedir bu?", answer: "yıldızlar", hint: "Gökyüzünde parlarlar." },
  { id: "q7", text: "Ne kadar çok olursa o kadar az görürsün. Nedir bu?", answer: "karanlık", hint: "Işığın yokluğudur." },
];


const ROOM_EXTENSION_COST = 2;
const ROOM_EXTENSION_DURATION_MINUTES = 20;
const TYPING_DEBOUNCE_DELAY = 1500;

// WebRTC Configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

  const [popoverOpenForUserId, setPopoverOpenForUserId] = useState<string | null>(null);
  const [popoverTargetUser, setPopoverTargetUser] = useState<UserData | null>(null);
  const [popoverLoading, setPopoverLoading] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<"friends" | "request_sent" | "request_received" | "none">("none");
  const [relevantFriendRequest, setRelevantFriendRequest] = useState<FriendRequest | null>(null);

  const [activeParticipants, setActiveParticipants] = useState<ActiveParticipant[]>([]);
  const [isRoomFullError, setIsRoomFullError] = useState(false);
  const [isProcessingJoinLeave, setIsProcessingJoinLeave] = useState(false);
  const [isCurrentUserParticipant, setIsCurrentUserParticipant] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [activeGameQuestion, setActiveGameQuestion] = useState<GameQuestion | null>(null);
  const [showGameQuestionCard, setShowGameQuestionCard] = useState(false);
  const gameQuestionIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [availableGameQuestions, setAvailableGameQuestions] = useState<GameQuestion[]>([...HARDCODED_QUESTIONS]);
  const [nextQuestionCountdown, setNextQuestionCountdown] = useState<number | null>(null);
  const countdownDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WebRTC State
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const [voiceChatParticipants, setVoiceChatParticipants] = useState<ActiveParticipant[]>([]);
  const remoteAudioRefs = useRef<Record<string, HTMLAudioElement>>({});


  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const settingsData = docSnap.data() as Partial<GameSettings>;
          setGameSettings({
            isGameEnabled: settingsData.isGameEnabled ?? false,
            questionIntervalSeconds: settingsData.questionIntervalSeconds ?? 180
          });
        } else {
          setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        }
      } catch (error) {
        console.error("[GameSystem] Error fetching game settings:", error);
        setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
      }
    };
    fetchGameSettings();
  }, []);

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (countdownDisplayTimerRef.current) {
      clearInterval(countdownDisplayTimerRef.current);
    }
    if (roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId) {
      const updateCountdown = () => {
        if (roomDetails?.nextGameQuestionTimestamp) {
          const now = new Date();
          const nextTime = roomDetails.nextGameQuestionTimestamp.toDate();
          const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000));
          setNextQuestionCountdown(diffSeconds);
        } else {
          setNextQuestionCountdown(null);
        }
      };
      updateCountdown();
      countdownDisplayTimerRef.current = setInterval(updateCountdown, 1000);
    } else {
        setNextQuestionCountdown(null);
    }
    return () => {
      if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
    };
  }, [roomDetails?.nextGameQuestionTimestamp, roomDetails?.currentGameQuestionId]);


const attemptToAskNewQuestion = useCallback(async () => {
    if (
      !isCurrentUserParticipant ||
      !gameSettings?.isGameEnabled ||
      !roomId ||
      !roomDetails ||
      roomDetails.currentGameQuestionId ||
      availableGameQuestions.length === 0
    ) {
      return;
    }

    try {
      const roomDocRef = doc(db, "chatRooms", roomId);
      const currentRoomSnap = await getDoc(roomDocRef);
      if (!currentRoomSnap.exists()) return;
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if (currentRoomData.currentGameQuestionId) return;

      const randomIndex = Math.floor(Math.random() * availableGameQuestions.length);
      const nextQuestion = availableGameQuestions[randomIndex];
      const intervalSeconds = gameSettings?.questionIntervalSeconds ?? 180;
      const newNextGameQuestionTimestamp = Timestamp.fromDate(addSeconds(new Date(), intervalSeconds));

      const batch = writeBatch(db);
      batch.update(roomDocRef, {
        currentGameQuestionId: nextQuestion.id,
        nextGameQuestionTimestamp: newNextGameQuestionTimestamp,
      });
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
          text: `[OYUN] Yeni bir soru geldi! "${nextQuestion.text}" (Ödül: ${FIXED_GAME_REWARD} Elmas). Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`,
          senderId: "system", senderName: "Oyun Sistemi", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true,
      });
      await batch.commit();
    } catch (error) {
      console.error("[GameSystem] Error attempting to ask new question:", error);
      toast({title: "Oyun Hatası", description: "Yeni soru hazırlanırken bir sorun oluştu.", variant: "destructive"});
    }
  }, [isCurrentUserParticipant, gameSettings, roomId, roomDetails, availableGameQuestions, toast]);


  useEffect(() => {
    if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
    if (gameSettings?.isGameEnabled && isCurrentUserParticipant && roomDetails) {
        gameQuestionIntervalTimerRef.current = setInterval(() => {
            if (roomDetails.nextGameQuestionTimestamp && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !roomDetails.currentGameQuestionId) {
                attemptToAskNewQuestion();
            }
        }, 5000);
    }
    return () => { if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current); };
  }, [gameSettings, isCurrentUserParticipant, roomDetails, attemptToAskNewQuestion]);


  useEffect(() => {
    if (isCurrentUserParticipant && gameSettings?.isGameEnabled && roomDetails?.nextGameQuestionTimestamp &&
        !roomDetails.currentGameQuestionId && availableGameQuestions.length > 0 && isPast(roomDetails.nextGameQuestionTimestamp.toDate())) {
      attemptToAskNewQuestion();
    }
  }, [ isCurrentUserParticipant, gameSettings, roomDetails?.nextGameQuestionTimestamp, roomDetails?.currentGameQuestionId, availableGameQuestions, attemptToAskNewQuestion]);


  useEffect(() => {
    if (roomDetails?.currentGameQuestionId) {
      const question = HARDCODED_QUESTIONS.find(q => q.id === roomDetails.currentGameQuestionId);
      setActiveGameQuestion(question || null);
      setShowGameQuestionCard(!!question);
    } else {
      setActiveGameQuestion(null);
      setShowGameQuestionCard(false);
    }
  }, [roomDetails?.currentGameQuestionId]);


  const handleCloseGameQuestionCard = () => setShowGameQuestionCard(false);

  const getAvatarFallbackText = (name?: string | null) => name ? name.substring(0, 2).toUpperCase() : "PN";

  const updateUserTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserParticipant) return;
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    try {
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) await updateDoc(participantRef, { isTyping });
    } catch (error) { /* console.warn("Error updating typing status (minor):", error); */ }
  }, [currentUser, roomId, isCurrentUserParticipant]);

  const handleJoinRoom = useCallback(async () => {
    if (!currentUser || !userData || !roomId || !roomDetails) return;
    setIsProcessingJoinLeave(true);
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);

    try {
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) {
        setIsCurrentUserParticipant(true);
        if (participantSnap.data()?.isTyping) await updateDoc(participantRef, { isTyping: false });
        setIsProcessingJoinLeave(false);
        return;
      }
      const currentRoomSnap = await getDoc(roomRef);
      if (!currentRoomSnap.exists()) {
          toast({ title: "Hata", description: "Oda bulunamadı.", variant: "destructive" });
          router.push("/chat"); return;
      }
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if ((currentRoomData.participantCount ?? 0) >= currentRoomData.maxParticipants) {
        setIsRoomFullError(true);
        toast({ title: "Oda Dolu", description: "Bu oda maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        setIsProcessingJoinLeave(false); return;
      }

      const batch = writeBatch(db);
      batch.set(participantRef, {
        joinedAt: serverTimestamp(), displayName: userData.displayName || currentUser.displayName || "Bilinmeyen",
        photoURL: userData.photoURL || currentUser.photoURL || null, uid: currentUser.uid, isTyping: false,
      });
      batch.update(roomRef, { participantCount: increment(1) });

      if (gameSettings?.isGameEnabled && !currentRoomData.gameInitialized && !currentRoomData.nextGameQuestionTimestamp && !currentRoomData.currentGameQuestionId) {
          batch.update(roomRef, {
              gameInitialized: true, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)), currentGameQuestionId: null,
          });
      }
      await batch.commit();
      setIsCurrentUserParticipant(true);
      toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });
      const userDisplayNameForJoin = userData.displayName || currentUser.displayName || "Bir kullanıcı";
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: `[SİSTEM] ${userDisplayNameForJoin} odaya katıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true,
      });
      if (gameSettings?.isGameEnabled) {
        let gameInfoMessage = `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `;
        const updatedRoomSnap = await getDoc(roomRef); const updatedRoomData = updatedRoomSnap.data() as ChatRoomDetails;
        if (updatedRoomData?.currentGameQuestionId) {
            const currentQ = HARDCODED_QUESTIONS.find(q => q.id === updatedRoomData.currentGameQuestionId);
            if(currentQ) gameInfoMessage += `Aktif bir soru var: "${currentQ.text}". Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`;
        } else if (updatedRoomData?.nextGameQuestionTimestamp) {
            const now = new Date(); const nextTime = updatedRoomData.nextGameQuestionTimestamp.toDate(); const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000));
            gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(diffSeconds)} sonra gelecek.`;
        } else if (typeof gameSettings.questionIntervalSeconds === 'number') {
            gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(gameSettings.questionIntervalSeconds)} sonra gelecek.`;
        }
        if (gameInfoMessage !== `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `) {
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: gameInfoMessage, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });
        }
      }
    } catch (error) {
      console.error("Error joining room:", error);
      toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsProcessingJoinLeave(false);
    }
  }, [currentUser, userData, roomId, roomDetails, toast, router, gameSettings]);

  const handleLeaveRoom = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserParticipant) return Promise.resolve();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    await updateUserTypingStatus(false);
    if (isVoiceChatActive) await handleLeaveVoiceChat(true); // Also leave voice chat

    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    const userDisplayNameForLeave = userData?.displayName || currentUser?.displayName;
    if (userDisplayNameForLeave && !isPageUnload) { // Don't send system message on page unload
        try {
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
                text: `[SİSTEM] ${userDisplayNameForLeave} odadan ayrıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true,
            });
        } catch (msgError) { /* console.warn("Error sending leave message (minor):", msgError); */ }
    }
    try {
      const batch = writeBatch(db); batch.delete(participantRef); batch.update(roomRef, { participantCount: increment(-1) });
      await batch.commit();
      setIsCurrentUserParticipant(false);
    } catch (error) { console.error("Error leaving room:", error); }
  }, [currentUser, roomId, isCurrentUserParticipant, updateUserTypingStatus, userData?.displayName, isVoiceChatActive, handleLeaveVoiceChat]);


  useEffect(() => {
    if (!roomId) return;
    setLoadingRoom(true);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedRoomDetails: ChatRoomDetails = {
          id: docSnap.id, name: data.name, description: data.description, creatorId: data.creatorId,
          participantCount: data.participantCount || 0, maxParticipants: data.maxParticipants || 7, expiresAt: data.expiresAt,
          currentGameQuestionId: data.currentGameQuestionId, nextGameQuestionTimestamp: data.nextGameQuestionTimestamp, gameInitialized: data.gameInitialized,
        };
        setRoomDetails(fetchedRoomDetails);
        document.title = `${fetchedRoomDetails.name} - Sohbet Küresi`;
      } else {
        toast({ title: "Hata", description: "Sohbet odası bulunamadı.", variant: "destructive" });
        router.push("/chat");
      }
      setLoadingRoom(false);
    }, (error) => {
      console.error("Error fetching room details:", error);
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingRoom(false);
    });
    return () => unsubscribeRoom();
  }, [roomId, toast, router]);


  useEffect(() => {
    if (!roomId || !currentUser || !userData || !roomDetails) return;
    if (!isCurrentUserParticipant && !isProcessingJoinLeave && !isRoomFullError) handleJoinRoom();
    const participantsQuery = query(collection(db, `chatRooms/${roomId}/participants`), orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (snapshot) => {
      const fetchedParticipants: ActiveParticipant[] = []; let currentUserIsStillParticipant = false;
      snapshot.forEach((doc) => {
        const participantData = doc.data();
        fetchedParticipants.push({
            id: doc.id, displayName: participantData.displayName, photoURL: participantData.photoURL,
            joinedAt: participantData.joinedAt, isTyping: participantData.isTyping,
        } as ActiveParticipant);
        if (doc.id === currentUser.uid) currentUserIsStillParticipant = true;
      });
      setActiveParticipants(fetchedParticipants);
      if (isCurrentUserParticipant !== currentUserIsStillParticipant) {
        setIsCurrentUserParticipant(currentUserIsStillParticipant);
        if (isCurrentUserParticipant && !currentUserIsStillParticipant && !isProcessingJoinLeave) {
          toast({title: "Bilgi", description: "Odadan çıkarıldınız veya bağlantınız kesildi.", variant: "default"});
        }
      }
    });
    return () => unsubscribeParticipants();
  }, [roomId, currentUser, userData, roomDetails, handleJoinRoom, isCurrentUserParticipant, isProcessingJoinLeave, isRoomFullError, toast]);


  useEffect(() => {
    if(!roomId) return;
    setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id, text: data.text, senderId: data.senderId, senderName: data.senderName,
          senderAvatar: data.senderAvatar, timestamp: data.timestamp, isGameMessage: data.isGameMessage || false,
        });
      });
      setMessages(fetchedMessages.map(msg => ({ ...msg, isOwn: msg.senderId === currentUser?.uid, userAiHint: msg.senderId === currentUser?.uid ? "user avatar" : "person talking" })));
      setLoadingMessages(false);
      setTimeout(() => scrollToBottom(), 0);
    }, (error) => {
      console.error("Error fetching messages:", error); toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingMessages(false);
    });
    return () => unsubscribeMessages();
  }, [roomId, currentUser?.uid, toast]);


  useEffect(() => {
    const handleBeforeUnload = () => { if (isCurrentUserParticipant) handleLeaveRoom(true); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isCurrentUserParticipant) handleLeaveRoom(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
      if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
    };
  }, [isCurrentUserParticipant, handleLeaveRoom]);


  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;
  const canSendMessage = !isRoomExpired && !isRoomFullError && isCurrentUserParticipant;

  const handleNewMessageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value; setNewMessage(currentMessage);
    if (!isCurrentUserParticipant || !canSendMessage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else if (currentMessage.trim() !== "") updateUserTypingStatus(true);
    if (currentMessage.trim() === "") {
        updateUserTypingStatus(false);
        if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    } else {
        typingTimeoutRef.current = setTimeout(() => { updateUserTypingStatus(false); typingTimeoutRef.current = null; }, TYPING_DEBOUNCE_DELAY);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !roomId || !canSendMessage || !userData || isUserLoading || isSending) return;
    
    setIsSending(true);
    const tempMessage = newMessage.trim();
    setNewMessage(""); // Clear input immediately to prevent double send
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    updateUserTypingStatus(false);
    const roomDocRef = doc(db, "chatRooms", roomId);

    if (activeGameQuestion && gameSettings?.isGameEnabled) {
      if (tempMessage.toLowerCase() === "/hint") {
        if ((userData.diamonds ?? 0) < HINT_COST) {
            toast({ title: "Yetersiz Elmas", description: `İpucu için ${HINT_COST} elmasa ihtiyacın var.`, variant: "destructive"}); 
            setIsSending(false); 
            // setNewMessage(tempMessage); // Restore message if failed
            return;
        }
        try {
            await updateUserDiamonds((userData.diamonds ?? 0) - HINT_COST);
            toast({ title: "İpucu!", description: (<div className="flex items-start gap-2"><Lightbulb className="h-5 w-5 text-yellow-400 mt-0.5" /><span>{activeGameQuestion.hint} (-{HINT_COST} <Gem className="inline h-3 w-3 mb-px" />)</span></div>), duration: 10000 });
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[OYUN] ${userData.displayName} bir ipucu kullandı!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true });
        } catch (error) { console.error("[GameSystem] Error processing hint:", error); toast({ title: "Hata", description: "İpucu alınırken bir sorun oluştu.", variant: "destructive"}); // setNewMessage(tempMessage);
        } finally { setIsSending(false); } return;
      }
      if (tempMessage.toLowerCase().startsWith("/answer ")) {
        const userAnswer = tempMessage.substring(8).trim();
        const currentRoomSnap = await getDoc(roomDocRef); const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
        if (currentRoomData?.currentGameQuestionId !== activeGameQuestion.id) {
          toast({ title: "Geç Kaldın!", description: "Bu soruya zaten cevap verildi veya soru değişti.", variant: "destructive" }); 
          setIsSending(false); 
          // setNewMessage(tempMessage);
          return;
        }
        if (userAnswer.toLowerCase() === activeGameQuestion.answer.toLowerCase()) {
          const reward = FIXED_GAME_REWARD; await updateUserDiamonds((userData.diamonds || 0) + reward);
          const batch = writeBatch(db);
          batch.update(roomDocRef, { currentGameQuestionId: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)) });
          batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `[OYUN] Tebrikler ${userData.displayName}! "${activeGameQuestion.text}" sorusuna doğru cevap verdin ve ${reward} elmas kazandın!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true });
          await batch.commit(); toast({ title: "Doğru Cevap!", description: `${reward} elmas kazandın!` });
          setAvailableGameQuestions(prev => prev.filter(q => q.id !== activeGameQuestion.id));
        } else {
          addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[OYUN] ${userData.displayName}, "${userAnswer}" cevabın doğru değil. Tekrar dene!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true });
          toast({ title: "Yanlış Cevap", description: "Maalesef doğru değil, tekrar deneyebilirsin.", variant: "destructive" });
        }
        setIsSending(false); 
        // setNewMessage(tempMessage); // Consider if we want to restore the "/answer" command or clear it
        return;
      }
    }
    
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: tempMessage, senderId: currentUser.uid, senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL, timestamp: serverTimestamp(), isGameMessage: false,
      });
      // setNewMessage(""); // Already cleared at the beginning
    } catch (error) {
      console.error("Error sending message:", error); 
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
      // setNewMessage(tempMessage); // Restore message on error
    } finally { 
        setIsSending(false); 
    }
  };


  const handleDeleteRoom = async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) {
      toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" }); return;
    }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz, tüm mesajlar ve katılımcı bilgileri silinecektir.`)) return;
    try {
      await deleteChatRoomAndSubcollections(roomId);
      toast({ title: "Başarılı", description: `"${roomDetails.name}" odası silindi.` }); router.push("/chat");
    } catch (error) {
      console.error("Error deleting room: ", error); toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const handleExtendDuration = async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid || !roomDetails.expiresAt) {
      toast({ title: "Hata", description: "Süre uzatma işlemi yapılamadı.", variant: "destructive" }); return;
    }
    if ((userData.diamonds ?? 0) < ROOM_EXTENSION_COST) {
      toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds ?? 0}`, variant: "destructive" }); return;
    }
    setIsExtending(true);
    try {
      const currentExpiresAt = roomDetails.expiresAt.toDate(); const newExpiresAtDate = addMinutes(currentExpiresAt, ROOM_EXTENSION_DURATION_MINUTES);
      const roomDocRef = doc(db, "chatRooms", roomId); await updateDoc(roomDocRef, { expiresAt: Timestamp.fromDate(newExpiresAtDate) });
      await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_EXTENSION_COST);
      toast({ title: "Başarılı", description: `Oda süresi ${ROOM_EXTENSION_DURATION_MINUTES} dakika uzatıldı. ${ROOM_EXTENSION_COST} elmas harcandı.` });
    } catch (error) {
      console.error("Error extending room duration:", error); toast({ title: "Hata", description: "Süre uzatılırken bir sorun oluştu.", variant: "destructive" });
    } finally { setIsExtending(false); }
  };

  const getExpiryInfo = (): string => {
    if (!roomDetails?.expiresAt) return "Süre bilgisi yok"; const expiryDate = roomDetails.expiresAt.toDate();
    if (isPast(expiryDate)) return "Süresi Doldu";
    return `${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };

  const handleOpenUserInfoPopover = async (senderId: string) => {
    if (!currentUser || senderId === currentUser.uid) return;
    setPopoverOpenForUserId(senderId); setPopoverLoading(true); setRelevantFriendRequest(null);
    try {
      const userDocRef = doc(db, "users", senderId); const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) { toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" }); setPopoverOpenForUserId(null); return; }
      const targetUser = { uid: userDocSnap.id, ...userDocSnap.data() } as UserData; setPopoverTargetUser(targetUser);
      const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, senderId); const friendDocSnap = await getDoc(friendDocRef);
      if (friendDocSnap.exists()) { setFriendshipStatus("friends"); setPopoverLoading(false); return; }
      const outgoingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", senderId), where("status", "==", "pending"));
      const outgoingReqSnap = await getDocs(outgoingReqQuery);
      if (!outgoingReqSnap.empty) { setFriendshipStatus("request_sent"); setRelevantFriendRequest({id: outgoingReqSnap.docs[0].id, ...outgoingReqSnap.docs[0].data()} as FriendRequest); setPopoverLoading(false); return; }
      const incomingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", senderId), where("toUserId", "==", currentUser.uid), where("status", "==", "pending"));
      const incomingReqSnap = await getDocs(incomingReqQuery);
      if (!incomingReqSnap.empty) { setFriendshipStatus("request_received"); setRelevantFriendRequest({id: incomingReqSnap.docs[0].id, ...incomingReqSnap.docs[0].data()} as FriendRequest); setPopoverLoading(false); return; }
      setFriendshipStatus("none");
    } catch (error) {
      console.error("Error fetching user info for popover:", error); toast({ title: "Hata", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
    } finally { setPopoverLoading(false); }
  };

  const handleSendFriendRequestPopover = async () => {
    if (!currentUser || !userData || !popoverTargetUser) return; setPopoverLoading(true);
    try {
      const newRequestRef = await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid, fromUsername: userData.displayName, fromAvatarUrl: userData.photoURL, toUserId: popoverTargetUser.uid,
        toUsername: popoverTargetUser.displayName, toAvatarUrl: popoverTargetUser.photoURL, status: "pending", createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` });
      setFriendshipStatus("request_sent");
      setRelevantFriendRequest({
        id: newRequestRef.id, fromUserId: currentUser.uid, fromUsername: userData.displayName || "", fromAvatarUrl: userData.photoURL || null,
        toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName || "", toAvatarUrl: popoverTargetUser.photoURL || null,
        status: "pending", createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error("Error sending friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally { setPopoverLoading(false); }
  };

  const handleAcceptFriendRequestPopover = async () => {
    if (!currentUser || !userData || !relevantFriendRequest || !popoverTargetUser) return; setPopoverLoading(true);
    try {
      const batch = writeBatch(db); const requestRef = doc(db, "friendRequests", relevantFriendRequest.id); batch.update(requestRef, { status: "accepted" });
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, popoverTargetUser.uid);
      batch.set(myFriendRef, { displayName: popoverTargetUser.displayName, photoURL: popoverTargetUser.photoURL, addedAt: serverTimestamp() });
      const theirFriendRef = doc(db, `users/${popoverTargetUser.uid}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { displayName: userData.displayName, photoURL: userData.photoURL, addedAt: serverTimestamp() });
      await batch.commit(); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} ile arkadaş oldunuz.` });
      setFriendshipStatus("friends"); setRelevantFriendRequest(null);
    } catch (error) {
      console.error("Error accepting friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally { setPopoverLoading(false); }
  };

  const handleDmAction = (targetUserId: string | undefined | null) => {
    if (!currentUser?.uid || !targetUserId) return; const dmId = generateDmChatId(currentUser.uid, targetUserId);
    router.push(`/dm/${dmId}`); setPopoverOpenForUserId(null);
  };

  // WebRTC Functions
  const createPeerConnection = useCallback((peerUid: string) => {
    if (!currentUser?.uid || !roomId) return null;
    console.log(`[WebRTC] Creating peer connection to ${peerUid}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && currentUser?.uid) {
        console.log(`[WebRTC] Sending ICE candidate to ${peerUid}`);
        addDoc(collection(db, `chatRooms/${roomId}/voiceSignaling`), {
          type: 'candidate',
          fromUid: currentUser.uid,
          toUid: peerUid,
          candidate: event.candidate.toJSON(),
          createdAt: serverTimestamp(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${peerUid}`);
      if (event.streams && event.streams[0]) {
        remoteStreamsRef.current[peerUid] = event.streams[0];
        // Force re-render to attach the stream to an audio element
        setVoiceChatParticipants(prev => [...prev]); 
      }
    };
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
      console.log(`[WebRTC] Added local stream tracks to PC for ${peerUid}`);
    } else {
        console.warn("[WebRTC] Local stream not available when creating peer connection for", peerUid);
    }

    peerConnectionsRef.current[peerUid] = pc;
    return pc;
  }, [currentUser?.uid, roomId]);

  const handleJoinVoiceChat = useCallback(async () => {
    if (!currentUser || !roomId || !userData) return;
    setIsVoiceConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);

      await setDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        joinedAt: serverTimestamp(),
      });
      setIsVoiceChatActive(true);
      toast({ title: "Sesli Sohbettesiniz", description: "Mikrofonunuz açık." });
    } catch (error) {
      console.error("[WebRTC] Error joining voice chat:", error);
      toast({ title: "Ses Hatası", description: "Mikrofon erişimi reddedildi veya bir hata oluştu.", variant: "destructive" });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    } finally {
      setIsVoiceConnecting(false);
    }
  }, [currentUser, roomId, userData, toast, isMuted]);

  const handleLeaveVoiceChat = useCallback(async (isLeavingRoom = false) => {
    setIsVoiceConnecting(true); // Use same loading state for leaving
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    remoteStreamsRef.current = {};
    remoteAudioRefs.current = {}; // Clear audio element refs

    if (currentUser?.uid && roomId) {
      try {
        await deleteDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid));
        // Optionally, delete all signaling messages sent by this user or to this user.
        // This can be complex, consider TTL policies on Firestore for signaling messages if needed.
      } catch (error) {
        console.error("[WebRTC] Error removing user from voice participants:", error);
      }
    }
    setIsVoiceChatActive(false);
    setIsVoiceConnecting(false);
    if (!isLeavingRoom) toast({ title: "Sesli Sohbetten Ayrıldınız" });
  }, [currentUser?.uid, roomId, toast]);

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = isMuted; // if isMuted is true, enable it (unmute)
        setIsMuted(!isMuted);
        toast({ title: !isMuted ? "Sessize Alındı" : "Ses Açıldı" });
      }
    }
  };

  useEffect(() => { // Cleanup on component unmount or roomId/currentUser change
    return () => {
      if (isVoiceChatActive) {
        handleLeaveVoiceChat(true);
      }
    };
  }, [isVoiceChatActive, handleLeaveVoiceChat, roomId, currentUser?.uid]);

  // Listen for other voice participants
  useEffect(() => {
    if (!roomId || !currentUser?.uid || !isVoiceChatActive) return;

    const unsubscribe = onSnapshot(collection(db, `chatRooms/${roomId}/voiceParticipants`), (snapshot) => {
      const currentVoiceUsers: ActiveParticipant[] = [];
      snapshot.forEach(docSnap => {
        if (docSnap.id !== currentUser.uid) { // Don't connect to self
          currentVoiceUsers.push({ id: docSnap.id, ...docSnap.data() } as ActiveParticipant);
          if (!peerConnectionsRef.current[docSnap.id]) {
            console.log(`[WebRTC] New voice participant ${docSnap.id} detected. Initiating connection.`);
            const pc = createPeerConnection(docSnap.id);
            if (pc) {
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  console.log(`[WebRTC] Sending offer to ${docSnap.id}`);
                  addDoc(collection(db, `chatRooms/${roomId}/voiceSignaling`), {
                    type: 'offer',
                    fromUid: currentUser.uid,
                    toUid: docSnap.id,
                    data: pc.localDescription?.toJSON(),
                    createdAt: serverTimestamp(),
                  });
                })
                .catch(e => console.error(`[WebRTC] Error creating offer for ${docSnap.id}:`, e));
            }
          }
        }
      });
      setVoiceChatParticipants(currentVoiceUsers);

      // Clean up connections for users who left
      Object.keys(peerConnectionsRef.current).forEach(peerUid => {
        if (!currentVoiceUsers.find(p => p.id === peerUid)) {
          console.log(`[WebRTC] Voice participant ${peerUid} left. Closing connection.`);
          peerConnectionsRef.current[peerUid]?.close();
          delete peerConnectionsRef.current[peerUid];
          delete remoteStreamsRef.current[peerUid];
          delete remoteAudioRefs.current[peerUid];
        }
      });
       // Force re-render to update remote audio elements
      setVoiceChatParticipants(prev => [...prev.filter(p => currentVoiceUsers.some(cp => cp.id === p.id))]);
    });
    return unsubscribe;
  }, [roomId, currentUser?.uid, isVoiceChatActive, createPeerConnection]);

  // Listen for signaling messages
  useEffect(() => {
    if (!roomId || !currentUser?.uid || !isVoiceChatActive) return;

    const qSignals = query(
        collection(db, `chatRooms/${roomId}/voiceSignaling`),
        where("toUid", "==", currentUser.uid),
        where("createdAt", ">", Timestamp.fromDate(new Date(Date.now() - 60000))) // Only process recent signals
    );

    const unsubscribe = onSnapshot(qSignals, async (snapshot) => {
      for (const docChange of snapshot.docChanges()) {
        if (docChange.type === 'added') {
          const signal = docChange.data();
          const fromUid = signal.fromUid;
          console.log(`[WebRTC] Received signal type ${signal.type} from ${fromUid}`);

          let pc = peerConnectionsRef.current[fromUid];
          if (!pc && (signal.type === 'offer' || signal.type === 'candidate')) {
            console.log(`[WebRTC] Peer connection for ${fromUid} not found, creating one.`);
            pc = createPeerConnection(fromUid)!; // Assert pc will be created
             if (!pc) {
                console.error(`[WebRTC] Failed to create PC for incoming signal from ${fromUid}`);
                continue;
            }
          }
          if (!pc) {
            console.warn(`[WebRTC] No peer connection for ${fromUid} to handle signal type ${signal.type}`);
            continue;
          }

          try {
            if (signal.type === 'offer' && signal.data) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log(`[WebRTC] Sending answer to ${fromUid}`);
              await addDoc(collection(db, `chatRooms/${roomId}/voiceSignaling`), {
                type: 'answer',
                fromUid: currentUser.uid,
                toUid: fromUid,
                data: pc.localDescription?.toJSON(),
                createdAt: serverTimestamp(),
              });
            } else if (signal.type === 'answer' && signal.data) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
            } else if (signal.type === 'candidate' && signal.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          } catch (error) {
            console.error(`[WebRTC] Error processing signal from ${fromUid}:`, error, signal);
          }
          // Delete the processed signal? Or use TTL. For now, let createdAt filter handle it.
          // await deleteDoc(docChange.doc.ref);
        }
      }
    });
    return unsubscribe;
  }, [roomId, currentUser?.uid, isVoiceChatActive, createPeerConnection]);

  useEffect(() => {
    Object.entries(remoteStreamsRef.current).forEach(([peerUid, stream]) => {
        if (stream && remoteAudioRefs.current[peerUid]) {
            if(remoteAudioRefs.current[peerUid].srcObject !== stream) {
                console.log(`[WebRTC] Attaching remote stream from ${peerUid} to audio element`);
                remoteAudioRefs.current[peerUid].srcObject = stream;
            }
        }
    });
  }, [voiceChatParticipants]); // Re-run when voiceChatParticipants change to ensure new audio elements get streams


  if (loadingRoom || !roomDetails || (isProcessingJoinLeave && !isRoomFullError && !isCurrentUserParticipant)) {
    return (
      <div className="flex flex-1 items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Oda yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      {showGameQuestionCard && activeGameQuestion && gameSettings?.isGameEnabled && (
        <GameQuestionCard question={activeGameQuestion} onClose={handleCloseGameQuestionCard} reward={FIXED_GAME_REWARD} />
      )}

      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9">
            <Link href="/chat"> <ArrowLeft className="h-5 w-5" /> <span className="sr-only">Geri</span> </Link>
            </Button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={`https://placehold.co/40x40.png?text=${roomDetails.name.substring(0,1)}`} data-ai-hint="group chat"/>
                <AvatarFallback>{getAvatarFallbackText(roomDetails.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate" title={roomDetails.name}>{roomDetails.name}</h2>
                    {roomDetails.description && (
                        <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary p-0">
                                    <Info className="h-4 w-4"/> <span className="sr-only">Oda Açıklaması</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{roomDetails.description}</p></TooltipContent>
                        </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-x-2">
                    {roomDetails.expiresAt && (
                        <div className="flex items-center truncate"> <Clock className="mr-1 h-3 w-3" /> <span className="truncate" title={getExpiryInfo()}>{getExpiryInfo()}</span> </div>
                    )}
                    {gameSettings?.isGameEnabled && isCurrentUserParticipant && nextQuestionCountdown !== null && !activeGameQuestion && formatCountdown(nextQuestionCountdown) && (
                      <div className="flex items-center truncate ml-2 border-l pl-2 border-muted-foreground/30" title={`Sonraki soruya kalan süre: ${formatCountdown(nextQuestionCountdown)}`}>
                        <Puzzle className="mr-1 h-3.5 w-3.5 text-primary" /> <span className="text-xs text-muted-foreground font-mono"> {formatCountdown(nextQuestionCountdown)} </span>
                      </div>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
             {/* Voice Chat Controls */}
            {isCurrentUserParticipant && (
              <>
                {!isVoiceChatActive ? (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 border-green-500/70 text-green-500 hover:bg-green-500/10 hover:text-green-600" onClick={handleJoinVoiceChat} disabled={isVoiceConnecting}>
                          {isVoiceConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom"><p>Sesli Sohbete Katıl</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className={`h-9 w-9 ${isMuted ? 'border-red-500/70 text-red-500 hover:bg-red-500/10 hover:text-red-600' : 'border-gray-500/70 text-gray-500 hover:bg-gray-500/10 hover:text-gray-600'}`} onClick={handleToggleMute}>
                            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>{isMuted ? 'Sesi Aç' : 'Sessize Al'}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleLeaveVoiceChat(false)} disabled={isVoiceConnecting}>
                             {isVoiceConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
                           </Button>
                        </TooltipTrigger>
                         <TooltipContent side="bottom"><p>Sesli Sohbetten Ayrıl</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </>
            )}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-9 px-2.5"> <UsersRound className="h-4 w-4" /> <span className="text-xs">{activeParticipants.length}/{roomDetails.maxParticipants}</span> </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                    <div className="p-2 border-b"><h3 className="text-xs font-medium text-center text-muted-foreground"> Aktif Katılımcılar ({activeParticipants.length}/{roomDetails.maxParticipants}) </h3></div>
                    <ScrollArea className="max-h-60">
                        {activeParticipants.length === 0 && !isProcessingJoinLeave && (<div className="text-center text-xs text-muted-foreground py-3 px-2"> <Users className="mx-auto h-6 w-6 mb-1 text-muted-foreground/50" /> Odada kimse yok. </div>)}
                        {isProcessingJoinLeave && activeParticipants.length === 0 && (<div className="text-center text-xs text-muted-foreground py-3 px-2"> <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-0.5" /> Yükleniyor... </div>)}
                        <ul className="divide-y divide-border">
                            {activeParticipants.map(participant => (
                            <li key={participant.id} className="flex items-center gap-2 p-2.5 hover:bg-secondary/30 dark:hover:bg-secondary/20">
                                <Avatar className="h-7 w-7">
                                    <AvatarImage src={participant.photoURL || "https://placehold.co/40x40.png"} data-ai-hint="active user avatar"/>
                                    <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium truncate text-muted-foreground block">
                                      {participant.displayName || "Bilinmeyen"}
                                      {voiceChatParticipants.find(vp => vp.id === participant.id) && <Mic className="inline h-3 w-3 ml-1.5 text-green-500" />}
                                      {participant.isTyping && <Pencil className="inline h-3 w-3 ml-1.5 text-primary animate-pulse" />}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/70 block">
                                      {participant.joinedAt ? formatDistanceToNow(participant.joinedAt.toDate(), { addSuffix: true, locale: tr, includeSeconds: false }) : 'Yeni katıldı'}
                                    </span>
                                </div>
                            </li>
                            ))}
                        </ul>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
            {currentUser && roomDetails.creatorId === currentUser.uid && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild> <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9"> <MoreVertical className="h-5 w-5" /> <span className="sr-only">Oda Seçenekleri</span> </Button> </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!isRoomExpired && roomDetails.expiresAt && (
                            <DropdownMenuItem onClick={handleExtendDuration} disabled={isExtending || isUserLoading}>
                                {isExtending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Süre Uzat ({ROOM_EXTENSION_COST} <Gem className="inline h-3 w-3 ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={handleDeleteRoom} className="text-destructive focus:text-destructive focus:bg-destructive/10"> <Trash2 className="mr-2 h-4 w-4" /> Odayı Sil </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
      </header>

    <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}>
            {loadingMessages && ( <div className="flex flex-1 items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p> </div> )}
            {!loadingMessages && messages.length === 0 && !isRoomExpired && !isRoomFullError && isCurrentUserParticipant && (
                <div className="text-center text-muted-foreground py-10 px-4"> <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Henüz hiç mesaj yok.</p> <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p> </div>
            )}
             {!isCurrentUserParticipant && !isRoomFullError && !loadingRoom && !isProcessingJoinLeave && (
                <div className="text-center text-muted-foreground py-10 px-4"> <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Odaya katılmadınız.</p> <p className="text-sm">Mesajları görmek ve göndermek için odaya otomatik olarak katılıyorsunuz. Lütfen bekleyin veya bir sorun varsa sayfayı yenileyin.</p> </div>
            )}
            {isRoomFullError && ( <div className="text-center text-destructive py-10 px-4"> <ShieldAlert className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odası dolu!</p> <p>Maksimum katılımcı sayısına ulaşıldığı için mesaj gönderemezsiniz.</p> </div> )}
            {isRoomExpired && !isRoomFullError && ( <div className="text-center text-destructive py-10"> <Clock className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p> <p>Yeni mesaj gönderilemez.</p> </div> )}
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id} msg={msg} currentUserUid={currentUser?.uid} popoverOpenForUserId={popoverOpenForUserId}
                onOpenUserInfoPopover={handleOpenUserInfoPopover} setPopoverOpenForUserId={setPopoverOpenForUserId}
                popoverLoading={popoverLoading} popoverTargetUser={popoverTargetUser} friendshipStatus={friendshipStatus}
                relevantFriendRequest={relevantFriendRequest} onAcceptFriendRequestPopover={handleAcceptFriendRequestPopover}
                onSendFriendRequestPopover={handleSendFriendRequestPopover} onDmAction={handleDmAction}
                getAvatarFallbackText={getAvatarFallbackText} currentUserPhotoURL={userData?.photoURL || currentUser?.photoURL || undefined}
                currentUserDisplayName={userData?.displayName || currentUser?.displayName || undefined}
              />
            ))}
             {/* Hidden audio elements for remote streams */}
            {Object.entries(remoteStreamsRef.current).map(([peerUid, stream]) => (
                stream && <audio key={peerUid} autoPlay ref={el => { if (el) remoteAudioRefs.current[peerUid] = el; }} />
            ))}
        </ScrollArea>
    </div>

      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"> <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Emoji Ekle</span> </Button>
          <Input
            placeholder={ activeGameQuestion && gameSettings?.isGameEnabled ? "Soruya cevap: /answer <cevap> veya ipucu: /hint ..." : !canSendMessage ? (isRoomExpired ? "Oda süresi doldu" : isRoomFullError ? "Oda dolu, mesaj gönderilemez" : "Odaya bağlanılıyor...") : "Mesajınızı yazın..." }
            value={newMessage} onChange={handleNewMessageInputChange}
            className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
            autoComplete="off" disabled={!canSendMessage || isSending || isUserLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex"> <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Dosya Ekle</span> </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || isUserLoading}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
        {!canSendMessage && ( <p className="text-xs text-destructive text-center mt-1.5"> {isRoomExpired ? "Bu odanın süresi dolduğu için mesaj gönderemezsiniz." : isRoomFullError ? "Oda dolu olduğu için mesaj gönderemezsiniz." : !isCurrentUserParticipant && !loadingRoom && !isProcessingJoinLeave ? "Mesaj göndermek için odaya katılmayı bekleyin." : ""} </p> )}
      </form>
    </div>
  );
}

    
