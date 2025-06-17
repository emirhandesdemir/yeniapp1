
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb, Info, ExternalLink, Mic, MicOff, UserCog, VolumeX, LogOut, Crown } from "lucide-react"; // Crown eklendi
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
  Unsubscribe,
} from "firebase/firestore";
import { useAuth, type UserData, type FriendRequest } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast, addSeconds, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
import VoiceParticipantGrid from '@/components/chat/VoiceParticipantGrid';

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
  voiceParticipantCount?: number;
  currentGameAnswerDeadline?: Timestamp | null;
}

export interface ActiveTextParticipant {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  joinedAt?: Timestamp;
  isTyping?: boolean;
}

export interface ActiveVoiceParticipantData {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  joinedAt?: Timestamp;
  isMuted?: boolean;
  isMutedByAdmin?: boolean;
  isSpeaking?: boolean;
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
const GAME_ANSWER_TIMEOUT_SECONDS = 15;

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
const MAX_VOICE_PARTICIPANTS_CONST = 7;

const MAX_MESSAGES_PER_WINDOW = 3;
const MESSAGE_WINDOW_SECONDS = 5;

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface WebRTCSignal {
  fromUid: string;
  toUid: string;
  type: 'offer' | 'answer' | 'candidate';
  data: any;
  createdAt?: Timestamp;
}

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

  const [activeTextParticipants, setActiveTextParticipants] = useState<ActiveTextParticipant[]>([]);
  const [activeVoiceParticipants, setActiveVoiceParticipants] = useState<ActiveVoiceParticipantData[]>([]);
  const [isCurrentUserInVoiceChat, setIsCurrentUserInVoiceChat] = useState(false);
  const [isProcessingVoiceJoinLeave, setIsProcessingVoiceJoinLeave] = useState(false);
  const [selfMuted, setSelfMuted] = useState(false);

  const [isRoomFullError, setIsRoomFullError] = useState(false);
  const [isProcessingJoinLeave, setIsProcessingJoinLeave] = useState(false);
  const [isCurrentUserParticipant, setIsCurrentUserParticipant] = useState(false);
  const isCurrentUserParticipantRef = useRef(isCurrentUserParticipant);
  const [currentTime, setCurrentTime] = useState(new Date());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [activeGameQuestion, setActiveGameQuestion] = useState<GameQuestion | null>(null);
  const [showGameQuestionCard, setShowGameQuestionCard] = useState(false);
  const gameQuestionIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [availableGameQuestions, setAvailableGameQuestions] = useState<GameQuestion[]>([...HARDCODED_QUESTIONS]);
  const [nextQuestionCountdown, setNextQuestionCountdown] = useState<number | null>(null);
  const countdownDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameAnswerDeadlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [questionAnswerCountdown, setQuestionAnswerCountdown] = useState<number | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [peerId: string]: MediaStream }>({});
  const signalsListenerUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const lastMessageTimesRef = useRef<number[]>([]);
  const isHandlingTimeoutRef = useRef(false);
  const isCurrentUserInVoiceChatRef = useRef(isCurrentUserInVoiceChat);
  
  useEffect(() => { isCurrentUserParticipantRef.current = isCurrentUserParticipant; }, [isCurrentUserParticipant]);
  useEffect(() => { const timerId = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
  useEffect(() => { isCurrentUserInVoiceChatRef.current = isCurrentUserInVoiceChat; }, [isCurrentUserInVoiceChat]);


  const handleGameAnswerTimeout = useCallback(async () => {
    if (!roomId || !roomDetails?.currentGameQuestionId || !activeGameQuestion) return;
    console.log("[GameSystem] Answer timeout for question:", activeGameQuestion.text);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const currentRoomSnap = await getDoc(roomDocRef);
    if (!currentRoomSnap.exists() || currentRoomSnap.data()?.currentGameQuestionId !== roomDetails.currentGameQuestionId) {
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.update(roomDocRef, {
        currentGameQuestionId: null,
        currentGameAnswerDeadline: null,
        nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings?.questionIntervalSeconds ?? 180))
      });
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
        text: `[OYUN] Süre doldu! Kimse "${activeGameQuestion.text}" sorusunu bilemedi. Doğru cevap: ${activeGameQuestion.answer}.`,
        senderId: "system",
        senderName: "Oyun Sistemi",
        timestamp: serverTimestamp(),
        isGameMessage: true
      });
      await batch.commit();
      toast({ title: "Süre Doldu!", description: `Kimse soruyu bilemedi. Cevap: ${activeGameQuestion.answer}`, duration: 7000});
    } catch (error) {
      console.error("[GameSystem] Error handling game answer timeout:", error);
    }
  }, [roomId, roomDetails?.currentGameQuestionId, activeGameQuestion, gameSettings?.questionIntervalSeconds, toast]);

  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const settingsData = docSnap.data() as Partial<GameSettings>;
          setGameSettings({ isGameEnabled: settingsData.isGameEnabled ?? false, questionIntervalSeconds: settingsData.questionIntervalSeconds ?? 180 });
        } else { setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 }); }
      } catch (error) { console.error("[GameSystem] Error fetching game settings:", error); setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 }); }
    };
    fetchGameSettings();
  }, []);

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    const minutes = Math.floor(seconds / 60); const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
    if (roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline) {
      const updateCountdown = () => {
        if (roomDetails?.nextGameQuestionTimestamp) {
          const now = new Date(); const nextTime = roomDetails.nextGameQuestionTimestamp.toDate();
          const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000));
          setNextQuestionCountdown(diffSeconds);
        } else { setNextQuestionCountdown(null); }
      };
      updateCountdown(); countdownDisplayTimerRef.current = setInterval(updateCountdown, 1000);
    } else { setNextQuestionCountdown(null); }
    return () => { if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current); };
  }, [roomDetails?.nextGameQuestionTimestamp, roomDetails?.currentGameQuestionId, roomDetails?.currentGameAnswerDeadline]);


  useEffect(() => {
    if (gameAnswerDeadlineTimerRef.current) clearInterval(gameAnswerDeadlineTimerRef.current);
    if (roomDetails?.currentGameQuestionId && roomDetails.currentGameAnswerDeadline) {
      const updateAnswerCountdown = () => {
        if (roomDetails.currentGameAnswerDeadline) {
          const now = new Date();
          const deadlineTime = roomDetails.currentGameAnswerDeadline.toDate();
          const diffSeconds = Math.max(0, Math.floor((deadlineTime.getTime() - now.getTime()) / 1000));
          setQuestionAnswerCountdown(diffSeconds);
          if (diffSeconds === 0 && !isHandlingTimeoutRef.current) {
            isHandlingTimeoutRef.current = true;
            handleGameAnswerTimeout().finally(() => {
              isHandlingTimeoutRef.current = false;
            });
          }
        } else {
          setQuestionAnswerCountdown(null);
        }
      };
      updateAnswerCountdown();
      gameAnswerDeadlineTimerRef.current = setInterval(updateAnswerCountdown, 1000);
    } else {
      setQuestionAnswerCountdown(null);
    }
    return () => { if (gameAnswerDeadlineTimerRef.current) clearInterval(gameAnswerDeadlineTimerRef.current); };
  }, [roomDetails?.currentGameQuestionId, roomDetails?.currentGameAnswerDeadline, handleGameAnswerTimeout]);


  const attemptToAskNewQuestion = useCallback(async () => {
    if (!isCurrentUserParticipantRef.current || !gameSettings?.isGameEnabled || !roomId || !roomDetails || roomDetails.currentGameQuestionId || availableGameQuestions.length === 0) return;
    try {
      const roomDocRef = doc(db, "chatRooms", roomId); const currentRoomSnap = await getDoc(roomDocRef);
      if (!currentRoomSnap.exists()) return; const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if (currentRoomData.currentGameQuestionId) return;
      const randomIndex = Math.floor(Math.random() * availableGameQuestions.length); const nextQuestion = availableGameQuestions[randomIndex];

      const batch = writeBatch(db);
      batch.update(roomDocRef, {
        currentGameQuestionId: nextQuestion.id,
        nextGameQuestionTimestamp: null,
        currentGameAnswerDeadline: Timestamp.fromDate(addSeconds(new Date(), GAME_ANSWER_TIMEOUT_SECONDS))
      });
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `[OYUN] Yeni bir soru geldi! "${nextQuestion.text}" (Ödül: ${FIXED_GAME_REWARD} Elmas). Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın. (Süre: ${GAME_ANSWER_TIMEOUT_SECONDS}sn)`, senderId: "system", senderName: "Oyun Sistemi", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });
      await batch.commit();
    } catch (error) { console.error("[GameSystem] Error attempting to ask new question:", error); toast({ title: "Oyun Hatası", description: "Yeni soru hazırlanırken bir sorun oluştu.", variant: "destructive" }); }
  }, [gameSettings, roomId, roomDetails, availableGameQuestions, toast]);

  useEffect(() => {
    if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
    if (gameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && roomDetails) {
      gameQuestionIntervalTimerRef.current = setInterval(() => {
        if (roomDetails.nextGameQuestionTimestamp && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline) {
          attemptToAskNewQuestion();
        }
      }, 5000);
    }
    return () => { if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current); };
  }, [gameSettings, roomDetails, attemptToAskNewQuestion]);


  useEffect(() => { if (isCurrentUserParticipantRef.current && gameSettings?.isGameEnabled && roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline && availableGameQuestions.length > 0 && isPast(roomDetails.nextGameQuestionTimestamp.toDate())) { attemptToAskNewQuestion(); } }, [gameSettings, roomDetails, availableGameQuestions, attemptToAskNewQuestion]);
  useEffect(() => { if (roomDetails?.currentGameQuestionId) { const question = HARDCODED_QUESTIONS.find(q => q.id === roomDetails.currentGameQuestionId); setActiveGameQuestion(question || null); setShowGameQuestionCard(!!question); } else { setActiveGameQuestion(null); setShowGameQuestionCard(false); } }, [roomDetails?.currentGameQuestionId]);
  const handleCloseGameQuestionCard = () => setShowGameQuestionCard(false);
  const getAvatarFallbackText = (name?: string | null) => name ? name.substring(0, 2).toUpperCase() : "PN";

  const updateUserTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserParticipantRef.current) return;
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    try { const participantSnap = await getDoc(participantRef); if (participantSnap.exists()) await updateDoc(participantRef, { isTyping }); } catch (error) { /* console.warn("Error updating typing status (minor):", error); */ }
  }, [currentUser, roomId]);

  const handleLeaveRoom = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserParticipantRef.current) return Promise.resolve();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    await updateUserTypingStatus(false);
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    const userDisplayNameForLeave = userData?.displayName || currentUser?.displayName;
    if (userDisplayNameForLeave && !isPageUnload) { try { await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[SİSTEM] ${userDisplayNameForLeave} odadan ayrıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true }); } catch (msgError) { /* console.warn("Error sending leave message (minor):", msgError); */ } }
    try { const batch = writeBatch(db); batch.delete(participantRef); batch.update(roomRef, { participantCount: increment(-1) }); await batch.commit(); setIsCurrentUserParticipant(false); } catch (error) { console.error("Error leaving room:", error); }
  }, [currentUser, roomId, updateUserTypingStatus, userData?.displayName]);

  const handleJoinRoom = useCallback(async () => {
    if (!currentUser || !userData || !roomId || !roomDetails) return;
    setIsProcessingJoinLeave(true);
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    try {
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) { setIsCurrentUserParticipant(true); if (participantSnap.data()?.isTyping) await updateDoc(participantRef, { isTyping: false }); setIsProcessingJoinLeave(false); return; }
      const currentRoomSnap = await getDoc(roomRef); if (!currentRoomSnap.exists()) { toast({ title: "Hata", description: "Oda bulunamadı.", variant: "destructive" }); router.push("/chat"); return; }
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if ((currentRoomData.participantCount ?? 0) >= currentRoomData.maxParticipants) { setIsRoomFullError(true); toast({ title: "Oda Dolu", description: "Bu oda maksimum katılımcı sayısına ulaşmış.", variant: "destructive" }); setIsProcessingJoinLeave(false); return; }
      const batch = writeBatch(db);
      batch.set(participantRef, { joinedAt: serverTimestamp(), displayName: userData.displayName || currentUser.displayName || "Bilinmeyen", photoURL: userData.photoURL || currentUser.photoURL || null, uid: currentUser.uid, isTyping: false });
      batch.update(roomRef, { participantCount: increment(1) });
      if (gameSettings?.isGameEnabled && !currentRoomData.gameInitialized && !currentRoomData.nextGameQuestionTimestamp && !currentRoomData.currentGameQuestionId && !currentRoomData.currentGameAnswerDeadline) { batch.update(roomRef, { gameInitialized: true, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)), currentGameQuestionId: null, currentGameAnswerDeadline: null }); }
      await batch.commit(); setIsCurrentUserParticipant(true); toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });
      const userDisplayNameForJoin = userData.displayName || currentUser.displayName || "Bir kullanıcı";
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[SİSTEM] ${userDisplayNameForJoin} odaya katıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });
      if (gameSettings?.isGameEnabled) {
        let gameInfoMessage = `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `;
        const updatedRoomSnap = await getDoc(roomRef); const updatedRoomData = updatedRoomSnap.data() as ChatRoomDetails;
        if (updatedRoomData?.currentGameQuestionId) { const currentQ = HARDCODED_QUESTIONS.find(q => q.id === updatedRoomData.currentGameQuestionId); if (currentQ) gameInfoMessage += `Aktif bir soru var: "${currentQ.text}". Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`; if (updatedRoomData.currentGameAnswerDeadline) gameInfoMessage += ` (Kalan Süre: ${formatCountdown(Math.max(0, Math.floor((updatedRoomData.currentGameAnswerDeadline.toDate().getTime() - new Date().getTime())/1000)))})` }
        else if (updatedRoomData?.nextGameQuestionTimestamp) { const now = new Date(); const nextTime = updatedRoomData.nextGameQuestionTimestamp.toDate(); const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000)); gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(diffSeconds)} sonra gelecek.`; }
        else if (typeof gameSettings.questionIntervalSeconds === 'number') { gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(gameSettings.questionIntervalSeconds)} sonra gelecek.`; }
        if (gameInfoMessage !== `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `) { await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: gameInfoMessage, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true }); }
      }
    } catch (error) { console.error("Error joining room:", error); toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setIsProcessingJoinLeave(false); }
  }, [currentUser, userData, roomId, roomDetails, toast, router, gameSettings]);

  // WebRTC Helper Functions
  const sendSignalMessage = useCallback(async (toUid: string, type: 'offer' | 'answer' | 'candidate', data: any) => { if (!currentUser || !roomId) return; const signalColRef = collection(db, `chatRooms/${roomId}/webrtcSignals`); await addDoc(signalColRef, { fromUid: currentUser.uid, toUid, type, data, createdAt: serverTimestamp() }); }, [currentUser, roomId]);

  const cleanupPeerConnection = useCallback((peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      peerConnectionsRef.current[peerId].close();
      delete peerConnectionsRef.current[peerId];
      console.log(`[WebRTC] Cleaned up peer connection for ${peerId}`);
    }
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      if (newStreams[peerId]) {
        newStreams[peerId].getTracks().forEach(track => track.stop());
      }
      delete newStreams[peerId];
      return newStreams;
    });
  }, []); // setRemoteStreams is stable

  const resetWebRTCState = useCallback(() => {
    console.log("[WebRTC] Resetting WebRTC state...");
    Object.keys(peerConnectionsRef.current).forEach(peerId => { cleanupPeerConnection(peerId); });
    peerConnectionsRef.current = {};
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        console.log("[WebRTC] Local stream stopped and cleared.");
    }
    setRemoteStreams({});
    console.log("[WebRTC] WebRTC state reset complete.");
  }, [cleanupPeerConnection]);

 const createPeerConnection = useCallback((peerId: string, isInitiator: boolean): RTCPeerConnection | null => {
    if (!currentUser) return null;
    console.log(`[WebRTC] createPeerConnection for ${peerId}. Initiator: ${isInitiator}. localStream available: ${!!localStreamRef.current}`);
    if (!localStreamRef.current) {
        console.error(`[WebRTC] Cannot create peer connection to ${peerId}, localStream is null.`);
        toast({ title: "Ses Hatası", description: "Mikrofon akışı alınamadı, bağlantı kurulamıyor.", variant: "destructive" });
        return null;
    }
    if (peerConnectionsRef.current[peerId]) { console.log(`[WebRTC] Peer connection for ${peerId} already exists or being created.`); return peerConnectionsRef.current[peerId]; }

    console.log(`[WebRTC] Creating new peer connection to ${peerId}. Initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionsRef.current[peerId] = pc;

    localStreamRef.current.getTracks().forEach(track => {
        try {
            pc.addTrack(track, localStreamRef.current!);
            console.log(`[WebRTC] Added local track (${track.kind}) to PC for ${peerId}`);
        } catch (e) { console.error(`[WebRTC] Error adding track to PC for ${peerId}:`, e); }
    });

    pc.onicecandidate = (event) => { if (event.candidate) { sendSignalMessage(peerId, 'candidate', event.candidate.toJSON()); } };

    pc.ontrack = (event) => {
        console.log(`[WebRTC] Remote track received from ${peerId}. Stream ID: ${event.streams[0]?.id}, Track kind: ${event.track?.kind}`);
        setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE connection state change for ${peerId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') { 
            cleanupPeerConnection(peerId);
        }
    };
    return pc;
}, [currentUser, sendSignalMessage, cleanupPeerConnection, toast]); // Added cleanupPeerConnection, toast

  const initiatePeerConnection = useCallback(async (peerId: string, isInitiator: boolean) => { if (!currentUser || !localStreamRef.current || peerId === currentUser.uid) return; console.log(`[WebRTC] Initiating peer connection with ${peerId}. Is initiator: ${isInitiator}`); const pc = createPeerConnection(peerId, isInitiator); if (!pc) return; if (isInitiator) { try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendSignalMessage(peerId, 'offer', offer); console.log(`[WebRTC] Offer sent to ${peerId}`); } catch (error) { console.error(`[WebRTC] Error creating offer for ${peerId}:`, error); } } }, [currentUser, createPeerConnection, sendSignalMessage]);

  const handleIncomingSignal = useCallback(async (signal: WebRTCSignal) => {
    if (!currentUser || !roomId) return;
    const { fromUid, type, data } = signal;
    console.log(`[WebRTC] Received signal from ${fromUid}: type ${type}`);
    let pc = peerConnectionsRef.current[fromUid];

    if (!pc && type === 'offer') {
        console.log(`[WebRTC] PC not found for ${fromUid} on offer, creating...`);
        pc = createPeerConnection(fromUid, false); 
        if (!pc) {
            console.error(`[WebRTC] Failed to create peer connection for incoming offer from ${fromUid}`);
            return;
        }
    }
    
    if (!pc) {
        console.warn(`[WebRTC] No PeerConnection for ${fromUid} to handle ${type}. Signal ignored.`);
        return;
    }

    try {
        if (type === 'offer') {
            if (!localStreamRef.current) { console.warn("[WebRTC] Received offer but localStream is null. Cannot set remote/create answer."); return; }
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalMessage(fromUid, 'answer', answer);
            console.log(`[WebRTC] Answer sent to ${fromUid}`);
        } else if (type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            console.log(`[WebRTC] Remote description (answer) set from ${fromUid}`);
        } else if (type === 'candidate') {
            if (pc.remoteDescription) { 
                await pc.addIceCandidate(new RTCIceCandidate(data));
                console.log(`[WebRTC] ICE candidate added from ${fromUid}`);
            } else {
                console.warn(`[WebRTC] Remote description not set for ${fromUid}, delaying ICE candidate. This might lead to issues if not handled by queueing.`);
            }
        }
    } catch (error) { console.error(`[WebRTC] Error handling signal from ${fromUid} (type: ${type}):`, error); }
}, [currentUser, roomId, createPeerConnection, sendSignalMessage]);


  const handleLeaveVoiceChat = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) return Promise.resolve();
    if (!isPageUnload) setIsProcessingVoiceJoinLeave(true);

    resetWebRTCState(); 

    try {
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const roomRef = doc(db, "chatRooms", roomId);
      const batch = writeBatch(db);
      batch.delete(voiceParticipantRef);
      batch.update(roomRef, { voiceParticipantCount: increment(-1) });
      await batch.commit();

      setIsCurrentUserInVoiceChat(false); // State update
      if (!isPageUnload) toast({ title: "Sesli Sohbetten Ayrıldın" });
    } catch (error) {
      console.error("Error leaving voice chat (Firestore):", error);
      if (!isPageUnload) toast({ title: "Hata", description: "Sesli sohbetten ayrılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      if (!isPageUnload) setIsProcessingVoiceJoinLeave(false);
    }
    return Promise.resolve();
  }, [currentUser, roomId, resetWebRTCState, toast]); // resetWebRTCState, toast dependency

  useEffect(() => {
    if (!roomId) return; setLoadingRoom(true);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedRoomDetails: ChatRoomDetails = { id: docSnap.id, name: data.name, description: data.description, creatorId: data.creatorId, participantCount: data.participantCount || 0, maxParticipants: data.maxParticipants || MAX_VOICE_PARTICIPANTS_CONST, expiresAt: data.expiresAt, currentGameQuestionId: data.currentGameQuestionId, nextGameQuestionTimestamp: data.nextGameQuestionTimestamp, gameInitialized: data.gameInitialized, voiceParticipantCount: data.voiceParticipantCount || 0, currentGameAnswerDeadline: data.currentGameAnswerDeadline };
        setRoomDetails(fetchedRoomDetails); document.title = `${fetchedRoomDetails.name} - HiweWalk`;
      } else { toast({ title: "Hata", description: "Sohbet odası bulunamadı.", variant: "destructive" }); router.push("/chat"); }
      setLoadingRoom(false);
    }, (error) => { console.error("Error fetching room details:", error); toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingRoom(false); });
    return () => unsubscribeRoom();
  }, [roomId, toast, router]);

  useEffect(() => {
    if (!roomId || !currentUser || !userData || !roomDetails) return;
    if (!isCurrentUserParticipantRef.current && !isProcessingJoinLeave && !isRoomFullError) { handleJoinRoom(); }
    const participantsQuery = query(collection(db, `chatRooms/${roomId}/participants`), orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (snapshot) => {
      const fetchedParticipants: ActiveTextParticipant[] = []; let currentUserIsFoundInSnapshot = false;
      snapshot.forEach((doc) => { const participantData = doc.data(); fetchedParticipants.push({ id: doc.id, displayName: participantData.displayName, photoURL: participantData.photoURL, joinedAt: participantData.joinedAt, isTyping: participantData.isTyping } as ActiveTextParticipant); if (doc.id === currentUser.uid) currentUserIsFoundInSnapshot = true; });
      setActiveTextParticipants(fetchedParticipants);
      if (isCurrentUserParticipantRef.current !== currentUserIsFoundInSnapshot) { if (isCurrentUserParticipantRef.current && !currentUserIsFoundInSnapshot && !isProcessingJoinLeave) { toast({ title: "Bilgi", description: "Odadan çıkarıldınız veya bağlantınız kesildi.", variant: "default" }); } setIsCurrentUserParticipant(currentUserIsFoundInSnapshot); }
    });
    return () => unsubscribeParticipants();
  }, [roomId, currentUser, userData, roomDetails, handleJoinRoom, isProcessingJoinLeave, isRoomFullError, toast]);


  // Effect for managing voice participants and WebRTC connections
  useEffect(() => {
    if (!roomId || !currentUser) return;

    const voiceParticipantsQuery = query(collection(db, `chatRooms/${roomId}/voiceParticipants`), orderBy("joinedAt", "asc"));
    const unsubscribeVoice = onSnapshot(voiceParticipantsQuery, (snapshot) => {
      const newVoiceParticipantsData: ActiveVoiceParticipantData[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ActiveVoiceParticipantData));
      
      setActiveVoiceParticipants(newVoiceParticipantsData);

      const selfInFirestore = newVoiceParticipantsData.find(p => p.id === currentUser.uid);

      if (selfInFirestore) {
        // Update local selfMuted state based on Firestore to reflect admin mutes or other changes
        setSelfMuted(selfInFirestore.isMuted || selfInFirestore.isMutedByAdmin || false);
      }

      // If user intended to be in call (local state is true) but not found in Firestore -> force local leave
      if (isCurrentUserInVoiceChatRef.current && !selfInFirestore && !isProcessingVoiceJoinLeave) {
        console.warn("[WebRTC] Current user thought they were in call, but not found in Firestore. Forcing local leave.");
        toast({ title: "Bağlantı Kesildi", description: "Sesli sohbetten çıkarıldınız veya bağlantınızda bir sorun oluştu.", variant: "destructive" });
        handleLeaveVoiceChat(true); // true to avoid sending another leave message from handleLeaveVoiceChat
        return; 
      }

      // Connection management: only if user is locally in voice chat and has a stream
      if (localStreamRef.current && isCurrentUserInVoiceChatRef.current) {
        // Connect to new participants
        newVoiceParticipantsData.forEach(p => {
          if (p.id !== currentUser.uid && !peerConnectionsRef.current[p.id]) {
            console.log(`[WebRTC] New participant ${p.displayName || p.id} detected by ${currentUser.displayName}. Initiating connection.`);
            initiatePeerConnection(p.id, true); 
          }
        });

        // Clean up connections for participants who left
        const currentConnectedPeerIds = Object.keys(peerConnectionsRef.current);
        const newParticipantIdsInCall = newVoiceParticipantsData.map(p => p.id);

        currentConnectedPeerIds.forEach(peerId => {
          if (peerId !== currentUser.uid && !newParticipantIdsInCall.includes(peerId)) {
            console.log(`[WebRTC] Participant ${peerId} detected as left by ${currentUser.displayName}. Cleaning up connection.`);
            cleanupPeerConnection(peerId);
          }
        });
      }
    }, (error) => {
      console.error("Error fetching voice participants:", error);
      toast({ title: "Hata", description: "Sesli sohbet katılımcıları yüklenirken bir sorun oluştu.", variant: "destructive" });
    });

    return () => unsubscribeVoice();
  }, [roomId, currentUser, toast, cleanupPeerConnection, initiatePeerConnection, handleLeaveVoiceChat, isProcessingVoiceJoinLeave]);


  useEffect(() => {
    if (!roomId) return; setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => { const data = doc.data(); fetchedMessages.push({ id: doc.id, text: data.text, senderId: data.senderId, senderName: data.senderName, senderAvatar: data.senderAvatar, timestamp: data.timestamp, isGameMessage: data.isGameMessage || false }); });
      setMessages(fetchedMessages.map(msg => ({ ...msg, isOwn: msg.senderId === currentUser?.uid, userAiHint: msg.senderId === currentUser?.uid ? "user avatar" : "person talking" })));
      setLoadingMessages(false); setTimeout(() => scrollToBottom(), 0);
    }, (error) => { console.error("Error fetching messages:", error); toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingMessages(false); });
    return () => unsubscribeMessages();
  }, [roomId, currentUser?.uid, toast]);


  useEffect(() => {
    const handleBeforeUnloadInternal = () => { handleLeaveRoom(true); if (isCurrentUserInVoiceChatRef.current) handleLeaveVoiceChat(true); };
    window.addEventListener('beforeunload', handleBeforeUnloadInternal);
    const currentTypingTimeout = typingTimeoutRef.current;
    const currentGameQuestionIntervalTimer = gameQuestionIntervalTimerRef.current;
    const currentCountdownDisplayTimer = countdownDisplayTimerRef.current;
    const currentGameAnswerDeadlineTimer = gameAnswerDeadlineTimerRef.current;
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnloadInternal);
      handleLeaveRoom(true); if (isCurrentUserInVoiceChatRef.current) handleLeaveVoiceChat(true);
      if (currentTypingTimeout) clearTimeout(currentTypingTimeout);
      if (currentGameQuestionIntervalTimer) clearInterval(currentGameQuestionIntervalTimer);
      if (currentCountdownDisplayTimer) clearInterval(currentCountdownDisplayTimer);
      if (currentGameAnswerDeadlineTimer) clearInterval(currentGameAnswerDeadlineTimer);
      resetWebRTCState(); if (signalsListenerUnsubscribeRef.current) { signalsListenerUnsubscribeRef.current(); signalsListenerUnsubscribeRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleLeaveRoom, handleLeaveVoiceChat, resetWebRTCState]); // Added missing dependencies based on usage

  const scrollToBottom = () => { if (scrollAreaRef.current) { const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]'); if (viewport) viewport.scrollTop = viewport.scrollHeight; } };
  useEffect(() => { scrollToBottom(); }, [messages]);
  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;
  const canSendMessage = !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current;

  const handleNewMessageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value; setNewMessage(currentMessage);
    if (!isCurrentUserParticipantRef.current || !canSendMessage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else if (currentMessage.trim() !== "") updateUserTypingStatus(true);
    if (currentMessage.trim() === "") { updateUserTypingStatus(false); if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; } }
    else { typingTimeoutRef.current = setTimeout(() => { updateUserTypingStatus(false); typingTimeoutRef.current = null; }, TYPING_DEBOUNCE_DELAY); }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (isSending || isUserLoading || !currentUser || !newMessage.trim() || !roomId || !canSendMessage || !userData) return;

    const now = Date.now();
    lastMessageTimesRef.current = lastMessageTimesRef.current.filter(time => now - time < MESSAGE_WINDOW_SECONDS * 1000);
    if (lastMessageTimesRef.current.length >= MAX_MESSAGES_PER_WINDOW) {
      toast({ title: "Spam Uyarısı", description: `Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz yavaşlayın.`, variant: "destructive" });
      return;
    }

    setIsSending(true); const tempMessage = newMessage.trim();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    updateUserTypingStatus(false); const roomDocRef = doc(db, "chatRooms", roomId);
    if (activeGameQuestion && gameSettings?.isGameEnabled) {
      if (roomDetails?.currentGameAnswerDeadline && isPast(roomDetails.currentGameAnswerDeadline.toDate())) {
        toast({ title: "Süre Doldu!", description: "Bu soru için cevap süresi doldu.", variant: "destructive" });
        setIsSending(false); return;
      }
      if (tempMessage.toLowerCase() === "/hint") {
        if ((userData.diamonds ?? 0) < HINT_COST) { toast({ title: "Yetersiz Elmas", description: `İpucu için ${HINT_COST} elmasa ihtiyacın var.`, variant: "destructive" }); setIsSending(false); return; }
        try { await updateUserDiamonds((userData.diamonds ?? 0) - HINT_COST); toast({ title: "İpucu!", description: (<div className="flex items-start gap-2"><Lightbulb className="h-5 w-5 text-yellow-400 mt-0.5" /><span>{activeGameQuestion.hint} (-{HINT_COST} <Gem className="inline h-3 w-3 mb-px" />)</span></div>), duration: 10000 }); await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[OYUN] ${userData.displayName} bir ipucu kullandı!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true }); } catch (error) { console.error("[GameSystem] Error processing hint:", error); toast({ title: "Hata", description: "İpucu alınırken bir sorun oluştu.", variant: "destructive" }); } finally { setNewMessage(""); setIsSending(false); } return;
      }
      if (tempMessage.toLowerCase().startsWith("/answer ")) {
        const userAnswer = tempMessage.substring(8).trim(); const currentRoomSnap = await getDoc(roomDocRef); const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
        if (currentRoomData?.currentGameQuestionId !== activeGameQuestion.id) { toast({ title: "Geç Kaldın!", description: "Bu soruya zaten cevap verildi veya soru değişti.", variant: "destructive" }); setIsSending(false); return; }
        if (userAnswer.toLowerCase() === activeGameQuestion.answer.toLowerCase()) { const reward = FIXED_GAME_REWARD; await updateUserDiamonds((userData.diamonds || 0) + reward); const batch = writeBatch(db); batch.update(roomDocRef, { currentGameQuestionId: null, currentGameAnswerDeadline: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)) }); batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `[OYUN] Tebrikler ${userData.displayName}! "${activeGameQuestion.text}" sorusuna doğru cevap verdin ve ${reward} elmas kazandın!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true }); await batch.commit(); toast({ title: "Doğru Cevap!", description: `${reward} elmas kazandın!` }); setAvailableGameQuestions(prev => prev.filter(q => q.id !== activeGameQuestion.id)); }
        else { addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[OYUN] ${userData.displayName}, "${userAnswer}" cevabın doğru değil. Tekrar dene!`, senderId: "system", senderName: "Oyun Sistemi", timestamp: serverTimestamp(), isGameMessage: true }); toast({ title: "Yanlış Cevap", description: "Maalesef doğru değil, tekrar deneyebilirsin.", variant: "destructive" }); }
        setNewMessage(""); setIsSending(false); return;
      }
    }
    try { await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: tempMessage, senderId: currentUser.uid, senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı", senderAvatar: userData?.photoURL || currentUser.photoURL, timestamp: serverTimestamp(), isGameMessage: false }); setNewMessage(""); lastMessageTimesRef.current.push(now); } catch (error) { console.error("Error sending message:", error); toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" }); } finally { setIsSending(false); }
  };

  const handleDeleteRoom = async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) { toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" }); return; }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz, tüm mesajlar ve katılımcı bilgileri silinecektir.`)) return;
    try { await deleteChatRoomAndSubcollections(roomId); toast({ title: "Başarılı", description: `"${roomDetails.name}" odası silindi.` }); router.push("/chat"); } catch (error) { console.error("Error deleting room: ", error); toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" }); }
  };

  const handleExtendDuration = async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid || !roomDetails.expiresAt) { toast({ title: "Hata", description: "Süre uzatma işlemi yapılamadı.", variant: "destructive" }); return; }
    if ((userData.diamonds ?? 0) < ROOM_EXTENSION_COST) { toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds ?? 0}`, variant: "destructive" }); return; }
    setIsExtending(true);
    try { const currentExpiresAt = roomDetails.expiresAt.toDate(); const newExpiresAtDate = addMinutes(currentExpiresAt, ROOM_EXTENSION_DURATION_MINUTES); const roomDocRef = doc(db, "chatRooms", roomId); await updateDoc(roomDocRef, { expiresAt: Timestamp.fromDate(newExpiresAtDate) }); await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_EXTENSION_COST); toast({ title: "Başarılı", description: `Oda süresi ${ROOM_EXTENSION_DURATION_MINUTES} dakika uzatıldı. ${ROOM_EXTENSION_COST} elmas harcandı.` }); } catch (error) { console.error("Error extending room duration:", error); toast({ title: "Hata", description: "Süre uzatılırken bir sorun oluştu.", variant: "destructive" }); } finally { setIsExtending(false); }
  };

  const getPreciseExpiryInfo = (): string => {
    if (!roomDetails?.expiresAt) return "Süre bilgisi yok"; const expiryDate = roomDetails.expiresAt.toDate(); const now = currentTime;
    if (isPast(expiryDate)) return "Süresi Doldu"; const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
    if (diffSeconds < 0) return "Süresi Doldu"; const days = Math.floor(diffSeconds / 86400); const hours = Math.floor((diffSeconds % 86400) / 3600); const minutes = Math.floor((diffSeconds % 3600) / 60); const seconds = diffSeconds % 60;
    if (days > 0) { return `${days} gün ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} sonra`; }
    if (hours > 0) { return `Kalan: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
    return `Kalan: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleOpenUserInfoPopover = useCallback(async (senderId: string) => {
    if (!currentUser || senderId === currentUser.uid) return; setPopoverOpenForUserId(senderId); setPopoverLoading(true); setRelevantFriendRequest(null);
    try {
      const userDocRef = doc(db, "users", senderId); const userDocSnap = await getDoc(userDocRef); if (!userDocSnap.exists()) { toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" }); setPopoverOpenForUserId(null); return; }
      const targetUser = { uid: userDocSnap.id, ...userDocSnap.data() } as UserData; setPopoverTargetUser(targetUser);
      const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, senderId); const friendDocSnap = await getDoc(friendDocRef); if (friendDocSnap.exists()) { setFriendshipStatus("friends"); setPopoverLoading(false); return; }
      const outgoingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", senderId), where("status", "==", "pending")); const outgoingReqSnap = await getDocs(outgoingReqQuery); if (!outgoingReqSnap.empty) { setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: outgoingReqSnap.docs[0].id, ...outgoingReqSnap.docs[0].data() } as FriendRequest); setPopoverLoading(false); return; }
      const incomingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", senderId), where("toUserId", "==", currentUser.uid), where("status", "==", "pending")); const incomingReqSnap = await getDocs(incomingReqQuery); if (!incomingReqSnap.empty) { setFriendshipStatus("request_received"); setRelevantFriendRequest({ id: incomingReqSnap.docs[0].id, ...incomingReqSnap.docs[0].data() } as FriendRequest); setPopoverLoading(false); return; }
      setFriendshipStatus("none");
    } catch (error) { console.error("Error fetching user info for popover:", error); toast({ title: "Hata", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, toast]);

  const handleSendFriendRequestPopover = async () => {
    if (!currentUser || !userData || !popoverTargetUser) return; setPopoverLoading(true);
    try { const newRequestRef = await addDoc(collection(db, "friendRequests"), { fromUserId: currentUser.uid, fromUsername: userData.displayName, fromAvatarUrl: userData.photoURL, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName, toAvatarUrl: popoverTargetUser.photoURL, status: "pending", createdAt: serverTimestamp() }); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` }); setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: newRequestRef.id, fromUserId: currentUser.uid, fromUsername: userData.displayName || "", fromAvatarUrl: userData.photoURL || null, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName || "", toAvatarUrl: popoverTargetUser.photoURL || null, status: "pending", createdAt: Timestamp.now() }); }
    catch (error) { console.error("Error sending friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  };

  const handleAcceptFriendRequestPopover = async () => {
    if (!currentUser || !userData || !relevantFriendRequest || !popoverTargetUser) return; setPopoverLoading(true);
    try { const batch = writeBatch(db); const requestRef = doc(db, "friendRequests", relevantFriendRequest.id); batch.update(requestRef, { status: "accepted" }); const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, popoverTargetUser.uid); batch.set(myFriendRef, { displayName: popoverTargetUser.displayName, photoURL: popoverTargetUser.photoURL, addedAt: serverTimestamp() }); const theirFriendRef = doc(db, `users/${popoverTargetUser.uid}/confirmedFriends`, currentUser.uid); batch.set(theirFriendRef, { displayName: userData.displayName, photoURL: userData.photoURL, addedAt: serverTimestamp() }); await batch.commit(); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} ile arkadaş oldunuz.` }); setFriendshipStatus("friends"); setRelevantFriendRequest(null); }
    catch (error) { console.error("Error accepting friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  };

  const handleDmAction = (targetUserId: string | undefined | null) => { if (!currentUser?.uid || !targetUserId) return; const dmId = generateDmChatId(currentUser.uid, targetUserId); router.push(`/dm/${dmId}`); setPopoverOpenForUserId(null); };
  const handleViewProfileAction = (targetUserId: string | undefined | null) => { if (!targetUserId) return; router.push(`/profile/${targetUserId}`); setPopoverOpenForUserId(null); };
  const isCurrentUserRoomCreator = roomDetails?.creatorId === currentUser?.uid;

  useEffect(() => {
    if (!isCurrentUserInVoiceChatRef.current || !currentUser || !roomId) { // Use ref here
        if (signalsListenerUnsubscribeRef.current) {
            signalsListenerUnsubscribeRef.current();
            signalsListenerUnsubscribeRef.current = null;
        }
        return;
    }
    const signalsQuery = query( collection(db, `chatRooms/${roomId}/webrtcSignals`), where("toUid", "==", currentUser.uid), orderBy("createdAt", "asc") ); 
    let lastProcessedTimestamp: Timestamp | null = null; 
    signalsListenerUnsubscribeRef.current = onSnapshot(signalsQuery, (snapshot) => { snapshot.docChanges().forEach((change) => { if (change.type === "added") { const signalData = change.doc.data() as WebRTCSignal; if (!lastProcessedTimestamp || (signalData.createdAt && signalData.createdAt.toMillis() > lastProcessedTimestamp.toMillis())) { handleIncomingSignal(signalData); if (signalData.createdAt) { lastProcessedTimestamp = signalData.createdAt; } } } }); }, (error) => { console.error("[WebRTC] Error listening to signals: ", error); }); 
    console.log("[WebRTC] Started listening for signals.");
    return () => { if (signalsListenerUnsubscribeRef.current) { console.log("[WebRTC] Stopping signals listener."); signalsListenerUnsubscribeRef.current(); signalsListenerUnsubscribeRef.current = null; } };
  }, [isCurrentUserInVoiceChat, currentUser, roomId, handleIncomingSignal]); // isCurrentUserInVoiceChat (state) dependency is correct here to re-trigger listener setup


  const handleJoinVoiceChat = async () => {
    if (!currentUser || !userData || !roomId || !roomDetails || isProcessingVoiceJoinLeave) return;
    if (isCurrentUserInVoiceChat) { toast({ title: "Bilgi", description: "Zaten sesli sohbettesiniz." }); return; }

    const currentVoiceParticipants = roomDetails.voiceParticipantCount ?? 0;
    const maxAllowedParticipants = roomDetails.maxParticipants;

    if (currentVoiceParticipants >= maxAllowedParticipants) {
        toast({ title: "Sesli Sohbet Dolu", description: "Bu odadaki sesli sohbet maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        return;
    }
    setIsProcessingVoiceJoinLeave(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream; 
      
      await setDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid), { uid: currentUser.uid, displayName: userData.displayName || currentUser.displayName || "Bilinmeyen", photoURL: userData.photoURL || currentUser.photoURL || null, joinedAt: serverTimestamp(), isMuted: false, isMutedByAdmin: false, isSpeaking: false, });
      await updateDoc(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(1) });
      
      setIsCurrentUserInVoiceChat(true); // Set state after successful Firestore updates and stream acquisition
      setSelfMuted(false);
      toast({ title: "Sesli Sohbete Katıldın!" });

      const currentVoiceParticipantsQuery = query(collection(db, `chatRooms/${roomId}/voiceParticipants`));
      const currentVoiceParticipantsSnap = await getDocs(currentVoiceParticipantsQuery);
      currentVoiceParticipantsSnap.forEach(doc => {
        if (doc.id !== currentUser.uid && localStreamRef.current) { 
            console.log(`[WebRTC] Joining: Initiating connection to existing participant ${doc.data().displayName}`);
            initiatePeerConnection(doc.id, true); 
        }
      });

    } catch (error: any) {
      console.error("Error joining voice chat / getting media:", error);
      toast({ title: "Hata", description: `Sesli sohbete katılırken bir sorun oluştu: ${error.message || 'Medya erişimi reddedildi.'}`, variant: "destructive" });
      resetWebRTCState(); 
      setIsCurrentUserInVoiceChat(false); // Ensure this is reset on error
      setSelfMuted(false);
      try {
        const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
        const voiceParticipantSnap = await getDoc(voiceParticipantRef);
        if (voiceParticipantSnap.exists()) {
            const batch = writeBatch(db);
            batch.delete(voiceParticipantRef);
            batch.update(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(-1) });
            await batch.commit();
        }
      } catch (cleanupError) {
        console.error("Error cleaning up voice participant on join failure:", cleanupError);
      }
    } finally {
      setIsProcessingVoiceJoinLeave(false);
    }
  };


  const toggleSelfMute = async () => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChat || !localStreamRef.current) return;
    const newMuteState = !selfMuted;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !newMuteState; });
    try {
        const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
        await updateDoc(voiceParticipantRef, { isMuted: newMuteState, isMutedByAdmin: false }); // User unmuting self also clears admin mute
        setSelfMuted(newMuteState);
    } catch (error) {
        console.error("Error toggling self mute:", error);
        toast({ title: "Hata", description: "Mikrofon durumu güncellenirken bir sorun oluştu.", variant: "destructive" });
        localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = selfMuted; }); // Revert on error
    }
  };
  const handleAdminKickFromVoice = async (targetUserId: string) => { if (!currentUser || !roomId || !isCurrentUserRoomCreator || targetUserId === currentUser.uid) return; cleanupPeerConnection(targetUserId); try { const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId); const roomRef = doc(db, "chatRooms", roomId); const batch = writeBatch(db); batch.delete(voiceParticipantRef); batch.update(roomRef, { voiceParticipantCount: increment(-1) }); await batch.commit(); toast({ title: "Başarılı", description: "Kullanıcı sesli sohbetten atıldı." }); } catch (error) { console.error("Error kicking user from voice:", error); toast({ title: "Hata", description: "Kullanıcı sesli sohbetten atılırken bir sorun oluştu.", variant: "destructive" }); } };
  const handleAdminToggleMuteUserVoice = async (targetUserId: string, currentMuteState?: boolean) => { if (!currentUser || !roomId || !isCurrentUserRoomCreator || targetUserId === currentUser.uid) return; try { const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId); await updateDoc(voiceParticipantRef, { isMutedByAdmin: !currentMuteState, isMuted: !currentMuteState }); toast({ title: "Başarılı", description: `Kullanıcının mikrofonu ${!currentMuteState ? "kapatıldı" : "açıldı (isteğe bağlı)"}.` }); } catch (error) { console.error("Error toggling user mute by admin:", error); toast({ title: "Hata", description: "Kullanıcının mikrofon durumu yönetici tarafından güncellenirken bir sorun oluştu.", variant: "destructive" }); } };

  const handleVoiceParticipantSlotClick = useCallback((participantId: string | null) => {
    if (participantId && participantId !== currentUser?.uid) {
      handleOpenUserInfoPopover(participantId);
    }
  }, [currentUser, handleOpenUserInfoPopover]);

  const handleKickParticipantFromTextChat = async (targetUserId: string, targetUsername?: string) => {
    if (!isCurrentUserRoomCreator || !currentUser || targetUserId === currentUser.uid) {
      toast({ title: "Yetki Hatası", description: "Bu kullanıcıyı odadan atma yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (!confirm(`${targetUsername || 'Bu kullanıcıyı'} metin sohbetinden atmak istediğinizden emin misiniz? Bu işlem kullanıcıyı sesli sohbetten de çıkaracaktır.`)) return;

    try {
      const batch = writeBatch(db);
      const participantRef = doc(db, `chatRooms/${roomId}/participants`, targetUserId);
      batch.delete(participantRef);

      const roomRef = doc(db, "chatRooms", roomId);
      batch.update(roomRef, { participantCount: increment(-1) });

      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId);
      const voiceParticipantSnap = await getDoc(voiceParticipantRef);
      if (voiceParticipantSnap.exists()) {
        batch.delete(voiceParticipantRef);
        batch.update(roomRef, { voiceParticipantCount: increment(-1) });
        cleanupPeerConnection(targetUserId);
      }

      const systemMessage = `[SİSTEM] ${targetUsername || 'Bir kullanıcı'} oda sahibi tarafından odadan atıldı.`;
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
        text: systemMessage, senderId: "system", senderName: "Sistem", timestamp: serverTimestamp(), isGameMessage: true
      });

      await batch.commit();
      toast({ title: "Başarılı", description: `${targetUsername || 'Kullanıcı'} odadan atıldı.` });
      setPopoverOpenForUserId(null);
    } catch (error) {
      console.error("Error kicking participant from text chat:", error);
      toast({ title: "Hata", description: "Kullanıcı odadan atılırken bir sorun oluştu.", variant: "destructive" });
    }
  };


  if (loadingRoom || !roomDetails || (isProcessingJoinLeave && !isRoomFullError && !isCurrentUserParticipantRef.current)) {
    return (<div className="flex flex-1 items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2 text-lg">Oda yükleniyor...</p></div>);
  }

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      <div style={{ display: 'none' }}> {Object.entries(remoteStreams).map(([peerId, stream]) => ( <audio key={peerId} autoPlay playsInline ref={audioEl => { if (audioEl) audioEl.srcObject = stream; }} /> ))} </div>
      {showGameQuestionCard && activeGameQuestion && gameSettings?.isGameEnabled && ( <GameQuestionCard question={activeGameQuestion} onClose={handleCloseGameQuestionCard} reward={FIXED_GAME_REWARD} countdown={questionAnswerCountdown} /> )}
      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
           <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9">
            <Link href="/chat">
              <>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
              </>
            </Link>
          </Button>
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"> <AvatarImage src={`https://placehold.co/40x40.png?text=${roomDetails.name.substring(0, 1)}`} data-ai-hint="group chat" /> <AvatarFallback>{getAvatarFallbackText(roomDetails.name)}</AvatarFallback> </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate" title={roomDetails.name}>{roomDetails.name}</h2>
              {isCurrentUserRoomCreator && <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" title="Oda Sahibi" />}
              {roomDetails.description && (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary p-0"><Info className="h-4 w-4" /> <span className="sr-only">Oda Açıklaması</span></Button></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{roomDetails.description}</p></TooltipContent></Tooltip></TooltipProvider>)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground gap-x-2"> {roomDetails.expiresAt && (<div className="flex items-center truncate"> <Clock className="mr-1 h-3 w-3" /> <span className="truncate" title={getPreciseExpiryInfo()}>{getPreciseExpiryInfo()}</span> </div>)} {gameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && nextQuestionCountdown !== null && !activeGameQuestion && formatCountdown(nextQuestionCountdown) && (<div className="flex items-center truncate ml-2 border-l pl-2 border-muted-foreground/30" title={`Sonraki soruya kalan süre: ${formatCountdown(nextQuestionCountdown)}`}><Puzzle className="mr-1 h-3.5 w-3.5 text-primary" /> <span className="text-xs text-muted-foreground font-mono"> {formatCountdown(nextQuestionCountdown)} </span></div>)} {gameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && questionAnswerCountdown !== null && activeGameQuestion && (<div className="flex items-center truncate ml-2 border-l pl-2 border-destructive/70" title={`Soruya cevap vermek için kalan süre: ${formatCountdown(questionAnswerCountdown)}`}><Gamepad2 className="mr-1 h-3.5 w-3.5 text-destructive" /> <span className="text-xs text-destructive font-mono"> {formatCountdown(questionAnswerCountdown)} </span></div>)} </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-9 px-2.5"> <UsersRound className="h-4 w-4" /> <span className="text-xs">{activeTextParticipants.length}/{roomDetails.maxParticipants}</span> </Button></PopoverTrigger>
            <PopoverContent className="w-64 p-0"><div className="p-2 border-b"><h3 className="text-xs font-medium text-center text-muted-foreground"> Metin Sohbeti Katılımcıları ({activeTextParticipants.length}/{roomDetails.maxParticipants}) </h3></div>
              <ScrollArea className="max-h-60"> {activeTextParticipants.length === 0 && !isProcessingJoinLeave && (<div className="text-center text-xs text-muted-foreground py-3 px-2"> <Users className="mx-auto h-6 w-6 mb-1 text-muted-foreground/50" /> Odada kimse yok. </div>)} {isProcessingJoinLeave && activeTextParticipants.length === 0 && (<div className="text-center text-xs text-muted-foreground py-3 px-2"> <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-0.5" /> Yükleniyor... </div>)}
                <ul className="divide-y divide-border">
                  {activeTextParticipants.map(participant => (<li key={participant.id} className="flex items-center gap-2 p-2.5 hover:bg-secondary/30 dark:hover:bg-secondary/20">
                    <div onClick={() => participant.id !== currentUser?.uid && handleOpenUserInfoPopover(participant.id)} className="flex-shrink-0 cursor-pointer"><Avatar className="h-7 w-7"><AvatarImage src={participant.photoURL || "https://placehold.co/40x40.png"} data-ai-hint="active user avatar" /><AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback></Avatar></div>
                    <div className="flex-1 min-w-0"><div onClick={() => participant.id !== currentUser?.uid && handleOpenUserInfoPopover(participant.id)} className="cursor-pointer"><span className="text-xs font-medium truncate text-muted-foreground block hover:underline">{participant.displayName || "Bilinmeyen"}{participant.isTyping && <Pencil className="inline h-3 w-3 ml-1.5 text-primary animate-pulse" />}</span></div><span className="text-[10px] text-muted-foreground/70 block">{participant.joinedAt ? formatDistanceToNow(participant.joinedAt.toDate(), { addSuffix: true, locale: tr, includeSeconds: false }) : 'Yeni katıldı'}</span></div>
                    {isCurrentUserRoomCreator && participant.id !== currentUser?.uid && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => handleKickParticipantFromTextChat(participant.id, participant.displayName || undefined)} title="Odadan At">
                            <LogOut className="h-3.5 w-3.5"/>
                        </Button>
                    )}
                  </li>))}
                </ul>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {currentUser && roomDetails.creatorId === currentUser.uid && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9"><MoreVertical className="h-5 w-5" /><span className="sr-only">Oda Seçenekleri</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{!isRoomExpired && roomDetails.expiresAt && (<DropdownMenuItem onClick={handleExtendDuration} disabled={isExtending || isUserLoading}>{isExtending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Süre Uzat ({ROOM_EXTENSION_COST} <Gem className="inline h-3 w-3 ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)</DropdownMenuItem>)}<DropdownMenuItem onClick={handleDeleteRoom} className="text-destructive focus:text-destructive focus:bg-destructive/10"> <Trash2 className="mr-2 h-4 w-4" /> Odayı Sil </DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}
        </div>
      </header>
      <div className="p-3 border-b bg-background/70 backdrop-blur-sm"> <div className="flex items-center justify-between mb-2"> <h3 className="text-sm font-medium text-primary">Sesli Sohbet ({activeVoiceParticipants.length}/{roomDetails.maxParticipants})</h3> {isCurrentUserInVoiceChat ? (<div className="flex items-center gap-2"> <Button variant={selfMuted ? "destructive" : "outline"} size="sm" onClick={toggleSelfMute} className="h-8 px-2.5" disabled={isProcessingVoiceJoinLeave} title={selfMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}>{selfMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button> <Button variant="outline" size="sm" onClick={() => handleLeaveVoiceChat(false)} disabled={isProcessingVoiceJoinLeave} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Ayrıl</Button> </div>) : (<Button variant="default" size="sm" onClick={handleJoinVoiceChat} disabled={isProcessingVoiceJoinLeave || (roomDetails.voiceParticipantCount ?? 0) >= roomDetails.maxParticipants} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}<Mic className="mr-1.5 h-4 w-4" /> Katıl</Button>)} </div> <VoiceParticipantGrid participants={activeVoiceParticipants} currentUserUid={currentUser?.uid} isCurrentUserRoomCreator={isCurrentUserRoomCreator} roomCreatorId={roomDetails?.creatorId} maxSlots={roomDetails.maxParticipants} onAdminKickUser={handleAdminKickFromVoice} onAdminToggleMuteUser={handleAdminToggleMuteUserVoice} getAvatarFallbackText={getAvatarFallbackText} onSlotClick={handleVoiceParticipantSlotClick} /> </div>
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}> {loadingMessages && (<div className="flex flex-1 items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p> </div>)} {!loadingMessages && messages.length === 0 && !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current && (<div className="text-center text-muted-foreground py-10 px-4"> <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Henüz hiç mesaj yok.</p> <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p> </div>)} {!isCurrentUserParticipantRef.current && !isRoomFullError && !loadingRoom && !isProcessingJoinLeave && (<div className="text-center text-muted-foreground py-10 px-4"> <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Odaya katılmadınız.</p> <p className="text-sm">Mesajları görmek ve göndermek için odaya otomatik olarak katılıyorsunuz. Lütfen bekleyin veya bir sorun varsa sayfayı yenileyin.</p> </div>)} {isRoomFullError && (<div className="text-center text-destructive py-10 px-4"> <ShieldAlert className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odası dolu!</p> <p>Maksimum katılımcı sayısına ulaşıldığı için mesaj gönderemezsiniz.</p> </div>)} {isRoomExpired && !isRoomFullError && (<div className="text-center text-destructive py-10"> <Clock className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p> <p>Yeni mesaj gönderilemez.</p> </div>)}
          {messages.map((msg) => (<ChatMessageItem key={msg.id} msg={msg} currentUserUid={currentUser?.uid} popoverOpenForUserId={popoverOpenForUserId} onOpenUserInfoPopover={handleOpenUserInfoPopover} setPopoverOpenForUserId={setPopoverOpenForUserId} popoverLoading={popoverLoading} popoverTargetUser={popoverTargetUser} friendshipStatus={friendshipStatus} relevantFriendRequest={relevantFriendRequest} onAcceptFriendRequestPopover={handleAcceptFriendRequestPopover} onSendFriendRequestPopover={handleSendFriendRequestPopover} onDmAction={handleDmAction} onViewProfileAction={handleViewProfileAction} getAvatarFallbackText={getAvatarFallbackText} currentUserPhotoURL={userData?.photoURL || currentUser?.photoURL || undefined} currentUserDisplayName={userData?.displayName || currentUser?.displayName || undefined} isCurrentUserRoomCreator={isCurrentUserRoomCreator} onKickParticipantFromTextChat={handleKickParticipantFromTextChat} />))}
        </ScrollArea>
      </div>
      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="relative flex items-center gap-2"> <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"> <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Emoji Ekle</span> </Button> <Input placeholder={activeGameQuestion && gameSettings?.isGameEnabled ? "Soruya cevap: /answer <cevap> veya ipucu: /hint ..." : !canSendMessage ? (isRoomExpired ? "Oda süresi doldu" : isRoomFullError ? "Oda dolu, mesaj gönderilemez" : "Odaya bağlanılıyor...") : "Mesajınızı yazın..."} value={newMessage} onChange={handleNewMessageInputChange} className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80" autoComplete="off" disabled={!canSendMessage || isSending || isUserLoading} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center"> <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex"> <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Dosya Ekle</span> </Button> <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || isUserLoading}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="sr-only">Gönder</span></Button> </div>
        </div>
        {!canSendMessage && (<p className="text-xs text-destructive text-center mt-1.5"> {isRoomExpired ? "Bu odanın süresi dolduğu için mesaj gönderemezsiniz." : isRoomFullError ? "Oda dolu olduğu için mesaj gönderemezsiniz." : !isCurrentUserParticipantRef.current && !loadingRoom && !isProcessingJoinLeave ? "Mesaj göndermek için odaya katılmayı bekleyin." : ""} </p>)}
      </form>
    </div>
  );
}
