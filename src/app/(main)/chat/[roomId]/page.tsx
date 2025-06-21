
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb, Info, ExternalLink, Mic, MicOff, UserCog, VolumeX, LogOut, Crown, UserPlus, Star, Settings as SettingsIcon, Dot, Gift, Check } from "lucide-react";
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
  deleteDoc,
  Timestamp,
  updateDoc,
  getDocs,
  where,
  writeBatch,
  increment,
  setDoc,
  Unsubscribe,
  runTransaction,
} from "firebase/firestore";
import { useAuth, type UserData, type FriendRequest, checkUserPremium } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast, addSeconds, format, differenceInMinutes, formatDistanceToNowStrict, differenceInSeconds } from 'date-fns';
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
import EditChatRoomDialog from '@/components/chat/EditChatRoomDialog';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import CreateChestDialog from "@/components/chat/CreateChestDialog";
import ActiveChestDisplay from "@/components/chat/ActiveChestDisplay";
import { useMinimizedChat } from '@/contexts/MinimizedChatContext';


export interface ActiveChest {
  id: string;
  creatorId: string;
  creatorName: string;
  totalDiamonds: number;
  remainingDiamonds: number;
  maxWinners: number;
  winners: { [key: string]: number }; // userId: amountWon
  createdAt: Timestamp;
  expiresAt: Timestamp;
}


interface Message {
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
  isGameMessage?: boolean;
  isChestMessage?: boolean;
  mentionedUserIds?: string[];
  editedAt?: Timestamp | null;
  reactions?: { [key: string]: string[] };
  systemMessageType?: 'premium_join' | 'normal_join';
}

interface ChatRoomDetails {
  id:string;
  name: string;
  description?: string;
  creatorId: string;
  creatorIsPremium?: boolean;
  isPremiumRoom?: boolean;
  participantCount?: number;
  maxParticipants: number;
  expiresAt?: Timestamp;
  isGameEnabledInRoom?: boolean;
  currentGameQuestionId?: string | null;
  nextGameQuestionTimestamp?: Timestamp | null;
  gameInitialized?: boolean;
  voiceParticipantCount?: number;
  currentGameAnswerDeadline?: Timestamp | null;
  image?: string;
  imageAiHint?: string;
  isActive?: boolean;
  lastMessageAt?: Timestamp;
  activeChestId?: string | null;
}

export interface ActiveTextParticipant {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  isPremium?: boolean;
  joinedAt?: Timestamp;
  isTyping?: boolean;
  lastSeen?: Timestamp | null;
  avatarFrameStyle?: string;
}

export interface ActiveVoiceParticipantData {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  isPremium?: boolean;
  joinedAt?: Timestamp;
  isMuted?: boolean;
  isMutedByAdmin?: boolean;
  isSpeaking?: boolean;
  avatarFrameStyle?: string;
}

interface WebRTCSignal {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  signalTimestamp?: Timestamp;
  from?: string;
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

const STUN_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};


const FIXED_GAME_REWARD = 1;
const HINT_COST = 1;
const GAME_ANSWER_TIMEOUT_SECONDS = 15;

const ROOM_EXTENSION_COST = 2;
const ROOM_EXTENSION_DURATION_MINUTES = 20;
const TYPING_DEBOUNCE_DELAY = 1500;

const MAX_MESSAGES_PER_WINDOW = 3;
const MESSAGE_WINDOW_SECONDS = 5;

const CAPACITY_INCREASE_COST = 5;
const CAPACITY_INCREASE_SLOTS = 1;
const PREMIUM_USER_ROOM_CAPACITY = 50;

const SPEAKING_THRESHOLD = 5;
const SILENCE_DELAY_MS = 1000;
const ACTIVE_IN_ROOM_THRESHOLD_MINUTES = 2;


export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { minimizedRoom, minimizeRoom, closeMinimizedRoom } = useMinimizedChat();

  const [roomDetails, setRoomDetails] = useState<ChatRoomDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, userData, updateUserDiamonds, isUserLoading, isCurrentUserPremium } = useAuth();
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

  const [globalGameSettings, setGlobalGameSettings] = useState<GameSettings | null>(null);
  const [activeGameQuestion, setActiveGameQuestion] = useState<GameQuestion | null>(null);
  const [showGameQuestionCard, setShowGameQuestionCard] = useState(false);
  const gameQuestionIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [availableGameQuestions, setAvailableGameQuestions] = useState<GameQuestion[]>([]);
  const [nextQuestionCountdown, setNextQuestionCountdown] = useState<number | null>(null);
  const countdownDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [questionAnswerCountdown, setQuestionAnswerCountdown] = useState<number | null>(null);
  const [loadingGameAssets, setLoadingGameAssets] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const remoteStreamsRef = useRef<{ [key: string]: MediaStream }>({});
  const [activeRemoteStreams, setActiveRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const lastProcessedSignalTimestampRef = useRef<Timestamp | null>(null);
  const negotiatingRef = useRef<{ [key: string]: boolean }>({});

  const lastMessageTimesRef = useRef<number[]>([]);

  const isHandlingTimeoutRef = useRef(false);
  const gameAnswerDeadlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentUserInVoiceChatRef = useRef(isCurrentUserInVoiceChat);

  const [isIncreasingCapacity, setIsIncreasingCapacity] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const speakingDetectionFrameIdRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const localIsSpeakingRef = useRef(localIsSpeaking);

  const [isEditRoomModalOpen, setIsEditRoomModalOpen] = useState(false);
  
  const [isChestCreateOpen, setIsChestCreateOpen] = useState(false);
  const [activeChest, setActiveChest] = useState<ActiveChest | null>(null);
  const [isOpeningChest, setIsOpeningChest] = useState(false);
  
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const roomDetailsRef = useRef(roomDetails);
  useEffect(() => { roomDetailsRef.current = roomDetails }, [roomDetails]);

  useEffect(() => { isCurrentUserParticipantRef.current = isCurrentUserParticipant; }, [isCurrentUserParticipant]);
  useEffect(() => { const timerId = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
  useEffect(() => { isCurrentUserInVoiceChatRef.current = isCurrentUserInVoiceChat; }, [isCurrentUserInVoiceChat]);
  useEffect(() => { localIsSpeakingRef.current = localIsSpeaking; }, [localIsSpeaking]);

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
    const messageRef = doc(db, `chatRooms/${roomId}/messages`, editingMessage.id);
    try {
      await updateDoc(messageRef, {
        text: newMessage.trim(),
        editedAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: "Mesajınız düzenlendi." });
    } catch (error) {
      console.error("Error saving edited message:", error);
      toast({ title: "Hata", description: "Mesaj düzenlenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSending(false);
      handleCancelEdit();
    }
  }, [editingMessage, newMessage, roomId, toast, handleCancelEdit]);


  const sendSignalMessage = useCallback(async (toUid: string, signal: WebRTCSignal) => {
    if (!currentUser || !roomId) return;
    try {
      const signalWithTimestampAndSender: WebRTCSignal = {
        ...signal,
        from: currentUser.uid,
        signalTimestamp: serverTimestamp() as Timestamp,
      };
      await addDoc(collection(db, `chatRooms/${roomId}/webrtcSignals/${toUid}/signals`), signalWithTimestampAndSender);
    } catch (error) {
      console.error(`[WebRTC] Error sending signal to ${toUid}:`, error);
      toast({ title: "Sinyal Hatası", description: "Sinyal gönderilemedi.", variant: "destructive" });
    }
  }, [currentUser, roomId, toast]);

  const cleanupPeerConnection = useCallback((targetUid: string) => {
    const pc = peerConnectionsRef.current[targetUid];
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onicegatheringstatechange = null;

      pc.getSenders().forEach(sender => {
        if (sender.track) {
          try {
            pc.removeTrack(sender);
          } catch (e) {
            console.warn(`[WebRTC] Error removing track/sender for ${targetUid} during cleanup:`, e);
          }
        }
      });
      pc.close();
      delete peerConnectionsRef.current[targetUid];
    }
    if (remoteStreamsRef.current[targetUid]) {
      remoteStreamsRef.current[targetUid].getTracks().forEach(track => track.stop());
      delete remoteStreamsRef.current[targetUid];
    }
    setActiveRemoteStreams(prev => {
      const newStreams = { ...prev };
      if (newStreams[targetUid]) {
        delete newStreams[targetUid];
      }
      return newStreams;
    });
    delete negotiatingRef.current[targetUid];
  }, []);

  const createPeerConnection = useCallback((targetUid: string): RTCPeerConnection | null => {
    if (peerConnectionsRef.current[targetUid]) {
      return peerConnectionsRef.current[targetUid];
    }

    if (!localStreamRef.current || !localStreamRef.current.active || localStreamRef.current.getAudioTracks().length === 0) {
      toast({title: "Lokal Akış Hatası", description: "Peer bağlantısı oluşturulamadı: Mikrofon akışınız aktif değil.", variant: "destructive"});
      return null;
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionsRef.current[targetUid] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalMessage(targetUid, { type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        if (remoteStream.active && remoteStream.getAudioTracks().length > 0) {
          setActiveRemoteStreams(prev => ({ ...prev, [targetUid]: remoteStream }));
          remoteStreamsRef.current[targetUid] = remoteStream;
        } else {
          setActiveRemoteStreams(prev => {
            const newStreams = { ...prev };
            if (newStreams[targetUid]) delete newStreams[targetUid];
            return newStreams;
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        cleanupPeerConnection(targetUid);
      }
    };
    
    pc.onnegotiationneeded = async () => {
      if (negotiatingRef.current[targetUid]) return;
      try {
        if (pc.signalingState === 'stable') {
          negotiatingRef.current[targetUid] = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignalMessage(targetUid, { type: 'offer', sdp: pc.localDescription!.sdp });
        }
      } catch (error) {
        console.error(`[WebRTC] Error in onnegotiationneeded for ${targetUid}:`, error);
      } finally {
        negotiatingRef.current[targetUid] = false;
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
            const sender = pc.getSenders().find(s => s.track === track);
            if (!sender) pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
            console.error(`[WebRTC] Error adding local track ${track.kind} to PC for ${targetUid}:`, e);
        }
      });
    }

    return pc;
  }, [sendSignalMessage, toast, cleanupPeerConnection]);


  const handleIncomingSignal = useCallback(async (signal: WebRTCSignal, fromUid: string) => {
    let pc = peerConnectionsRef.current[fromUid];

    if (!pc && signal.type === 'offer') {
        pc = createPeerConnection(fromUid)!;
        if (!pc) {
          return;
        }
    } else if (!pc) {
        return;
    }

    try {
        if (signal.type === 'offer' && signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalMessage(fromUid, { type: 'answer', sdp: pc.localDescription!.sdp });
        } else if (signal.type === 'answer' && signal.sdp) {
            if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            }
        } else if (signal.type === 'candidate' && signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    } catch (error: any) {
        console.error(`[WebRTC] Error handling signal from ${fromUid} (type: ${signal.type}):`, error);
        toast({ title: "WebRTC Sinyal İşleme Hatası", description: `Sinyal işlenirken hata oluştu.`, variant: "destructive" });
    }
  }, [createPeerConnection, sendSignalMessage, toast]);

  useEffect(() => {
    if (!currentUser || !roomId) return;
    let unsubscribeSignals: Unsubscribe | null = null;
    const setupSignalListener = () => {
        if (unsubscribeSignals) unsubscribeSignals();
        let q = query(collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`), orderBy("signalTimestamp", "asc"));
        if (lastProcessedSignalTimestampRef.current) {
          q = query(q, where("signalTimestamp", ">", lastProcessedSignalTimestampRef.current));
        }
        unsubscribeSignals = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const signalData = change.doc.data() as WebRTCSignal;
              if (signalData.from && signalData.from !== currentUser.uid && isCurrentUserInVoiceChatRef.current) {
                  handleIncomingSignal(signalData, signalData.from);
              }
              if (signalData.signalTimestamp) {
                  lastProcessedSignalTimestampRef.current = signalData.signalTimestamp;
              }
            }
          });
        }, (error) => {
          console.error("[WebRTC] Error in signal listener:", error);
        });
    };
    if (isCurrentUserInVoiceChat) {
        setupSignalListener();
    } else {
        if (unsubscribeSignals) unsubscribeSignals();
    }
    return () => {
      if (unsubscribeSignals) unsubscribeSignals();
    };
  }, [currentUser, roomId, handleIncomingSignal, toast, isCurrentUserInVoiceChat]);


  const updateSpeakingStatusInFirestore = useCallback(async (isSpeaking: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) return;
    try {
      const participantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      await updateDoc(participantRef, { isSpeaking });
    } catch (error) { }
  }, [currentUser, roomId]);

  const detectSpeaking = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current || !dataArrayRef.current) {
      if(isCurrentUserInVoiceChatRef.current) speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking);
      return;
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      sum += dataArrayRef.current[i];
    }
    const average = sum / dataArrayRef.current.length;

    if (average > SPEAKING_THRESHOLD) {
      if (!localIsSpeakingRef.current) {
        setLocalIsSpeaking(true);
        updateSpeakingStatusInFirestore(true);
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (localIsSpeakingRef.current) {
          setLocalIsSpeaking(false);
          updateSpeakingStatusInFirestore(false);
        }
      }, SILENCE_DELAY_MS);
    }
    if(isCurrentUserInVoiceChatRef.current) speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking);
  }, [updateSpeakingStatusInFirestore]);

  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current || !localStreamRef.current.active || localStreamRef.current.getAudioTracks().length === 0) return;
    try {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume().catch(e => console.error("Error resuming AudioContext:", e));
        if (!analyserRef.current && audioContextRef.current) {
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
            const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
            source.connect(analyserRef.current);
        }
        if (speakingDetectionFrameIdRef.current) cancelAnimationFrame(speakingDetectionFrameIdRef.current);
        speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking);
    } catch (e) {
        console.error("[WebRTC Speaking] Error starting speaking detection:", e);
    }
  }, [detectSpeaking]);

  const stopSpeakingDetection = useCallback(() => {
    if (speakingDetectionFrameIdRef.current) cancelAnimationFrame(speakingDetectionFrameIdRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    analyserRef.current = null;
    dataArrayRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => audioContextRef.current = null).catch(e => audioContextRef.current = null);
    } else if (audioContextRef.current?.state === 'closed') {
        audioContextRef.current = null;
    }
    if (localIsSpeakingRef.current) {
      setLocalIsSpeaking(false);
      updateSpeakingStatusInFirestore(false);
    }
  }, [updateSpeakingStatusInFirestore]);


  const handleJoinVoiceChat = useCallback(async () => {
    if (!currentUser || !userData || !roomId || !roomDetails || isProcessingVoiceJoinLeave) return;
    if (isCurrentUserInVoiceChatRef.current) { toast({ title: "Bilgi", description: "Zaten sesli sohbettesiniz." }); return; }

    const currentVoiceParticipantsCount = roomDetails.voiceParticipantCount ?? 0;
    if (currentVoiceParticipantsCount >= roomDetails.maxParticipants) {
        toast({ title: "Sesli Sohbet Dolu", description: "Bu odadaki sesli sohbet maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        return;
    }
    setIsProcessingVoiceJoinLeave(true);
    const userIsCurrentlyPremium = isCurrentUserPremium();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!stream.active || stream.getTracks().length === 0) throw new Error("No active tracks in media stream");
      
      localStreamRef.current = stream;

      const selfVoiceDocRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const selfVoiceDocSnap = await getDoc(selfVoiceDocRef);
      const selfIsAdminMuted = selfVoiceDocSnap.exists() && selfVoiceDocSnap.data()?.isMutedByAdmin === true;

      if (selfIsAdminMuted) {
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        setSelfMuted(true);
      } else {
        setSelfMuted(false);
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      }
      startSpeakingDetection();

      await setDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        isPremium: userIsCurrentlyPremium,
        avatarFrameStyle: userData.avatarFrameStyle,
        joinedAt: serverTimestamp(),
        isMuted: selfIsAdminMuted,
        isMutedByAdmin: selfIsAdminMuted,
        isSpeaking: false,
      });
      await updateDoc(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(1) });

      setIsCurrentUserInVoiceChat(true);
      toast({ title: "Sesli Sohbete Katıldın!" });

      const voiceParticipantsSnap = await getDocs(query(collection(db, `chatRooms/${roomId}/voiceParticipants`)));
      voiceParticipantsSnap.forEach(docSnap => {
        if (docSnap.id !== currentUser.uid) createPeerConnection(docSnap.id);
      });

    } catch (error: any) {
      toast({ title: "Hata", description: `Sesli sohbete katılırken bir sorun oluştu: ${error.message || 'Medya erişimi reddedildi.'}`, variant: "destructive" });
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      stopSpeakingDetection();
      setIsCurrentUserInVoiceChat(false);
      try {
        const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
        if ((await getDoc(voiceParticipantRef)).exists()) {
            const batch = writeBatch(db);
            batch.delete(voiceParticipantRef);
            batch.update(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(-1) });
            await batch.commit();
        }
      } catch (cleanupError) { }
    } finally {
      setIsProcessingVoiceJoinLeave(false);
    }
  }, [currentUser, userData, roomId, roomDetails, toast, createPeerConnection, isCurrentUserPremium, startSpeakingDetection, stopSpeakingDetection]);

  const handleLeaveVoiceChat = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) return Promise.resolve();
    if (!isPageUnload) setIsProcessingVoiceJoinLeave(true);

    stopSpeakingDetection();
    Object.keys(peerConnectionsRef.current).forEach(peerUid => cleanupPeerConnection(peerUid));
    peerConnectionsRef.current = {};
    setActiveRemoteStreams({});
    lastProcessedSignalTimestampRef.current = null;

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    setIsCurrentUserInVoiceChat(false);

    try {
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const roomRef = doc(db, "chatRooms", roomId);
      const signalsSnap = await getDocs(collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`));
      const batch = writeBatch(db);
      if ((await getDoc(voiceParticipantRef)).exists()) {
        batch.delete(voiceParticipantRef);
        if ((await getDoc(roomRef)).data()?.voiceParticipantCount > 0) batch.update(roomRef, { voiceParticipantCount: increment(-1) });
      }
      signalsSnap.forEach(signalDoc => batch.delete(signalDoc.ref));
      await batch.commit();
      if (!isPageUnload) toast({ title: "Sesli Sohbetten Ayrıldın" });
    } catch (error) {
      if (!isPageUnload) toast({ title: "Hata", description: "Sesli sohbetten ayrılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      if (!isPageUnload) setIsProcessingVoiceJoinLeave(false);
    }
    return Promise.resolve();
  }, [currentUser, roomId, cleanupPeerConnection, toast, stopSpeakingDetection]);


  useEffect(() => {
    if (!currentUser || !roomId) return;
    let unsubscribeVoiceParticipants: Unsubscribe | null = null;
    const setupVoiceParticipantsListener = () => {
      if (unsubscribeVoiceParticipants) unsubscribeVoiceParticipants();
      const q = query(collection(db, `chatRooms/${roomId}/voiceParticipants`), orderBy("joinedAt", "asc"));
      unsubscribeVoiceParticipants = onSnapshot(q, (snapshot) => {
          let newVoiceParticipants: ActiveVoiceParticipantData[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ActiveVoiceParticipantData));
          const selfInFirestore = newVoiceParticipants.find(p => p.id === currentUser.uid);
          
          if (isCurrentUserInVoiceChatRef.current) {
            newVoiceParticipants = newVoiceParticipants.map(p => p.id === currentUser.uid ? { ...p, isSpeaking: (selfInFirestore?.isMutedByAdmin || selfMuted) ? false : localIsSpeakingRef.current } : p);
          }

          setActiveVoiceParticipants(newVoiceParticipants);

          if (isCurrentUserInVoiceChatRef.current && !selfInFirestore && !isProcessingVoiceJoinLeave) {
              handleLeaveVoiceChat(true);
              return;
          }

          if (selfInFirestore && localStreamRef.current) {
            const isAdminMuted = selfInFirestore.isMutedByAdmin === true;
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !isAdminMuted && !selfMuted);
            if (isAdminMuted && !selfMuted) setSelfMuted(true);
          }

          if (isCurrentUserInVoiceChatRef.current && localStreamRef.current?.active) {
              newVoiceParticipants.forEach(p => {
                  if (p.id !== currentUser.uid && !peerConnectionsRef.current[p.id]) createPeerConnection(p.id);
              });
              Object.keys(peerConnectionsRef.current).forEach(existingPeerId => {
                  if (!newVoiceParticipants.find(p => p.id === existingPeerId)) cleanupPeerConnection(existingPeerId);
              });
          }
      }, (error) => {
        toast({ title: "Sesli Katılımcı Hatası", description: "Sesli sohbet katılımcıları alınırken hata.", variant: "destructive" });
      });
    };
    setupVoiceParticipantsListener();
    return () => { if (unsubscribeVoiceParticipants) unsubscribeVoiceParticipants(); };
  }, [roomId, currentUser, toast, cleanupPeerConnection, createPeerConnection, handleLeaveVoiceChat, isProcessingVoiceJoinLeave, selfMuted]);

  useEffect(() => {
    const fetchGameAssets = async () => {
      setLoadingGameAssets(true);
      try {
        const settingsSnap = await getDoc(doc(db, "appSettings", "gameConfig"));
        setGlobalGameSettings(settingsSnap.exists() ? settingsSnap.data() as GameSettings : { isGameEnabled: false, questionIntervalSeconds: 180 });

        const questionsSnap = await getDocs(query(collection(db, "gameQuestions"), orderBy("createdAt", "desc")));
        setAvailableGameQuestions(questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameQuestion)));

      } catch (error) {
        setGlobalGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        setAvailableGameQuestions([]);
        toast({ title: "Oyun Hatası", description: "Oyun verileri yüklenemedi.", variant: "destructive" });
      } finally {
        setLoadingGameAssets(false);
      }
    };
    fetchGameAssets();
  }, [toast]);


  const handleGameAnswerTimeout = useCallback(async () => {
    if (!roomId || !roomDetails?.currentGameQuestionId || !activeGameQuestion) {
        if (roomId && roomDetails?.currentGameQuestionId) {
            try {
                await updateDoc(doc(db, "chatRooms", roomId), {
                    currentGameQuestionId: null, currentGameAnswerDeadline: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings?.questionIntervalSeconds ?? 180))
                });
                await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `Süre doldu! Ancak aktif soruyla ilgili bir sorun oluştu, bu yüzden cevap gösterilemiyor.`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true });
                toast({ title: "Oyun Hatası", description: "Soru süresi doldu ancak cevap bilgisi alınamadı.", variant: "destructive" });
            } catch (errorResetting) {}
        }
        return;
    }
    if (typeof activeGameQuestion.text !== 'string' || typeof activeGameQuestion.answer !== 'string') {
        try {
            const batchError = writeBatch(db);
            batchError.update(doc(db, "chatRooms", roomId), { currentGameQuestionId: null, currentGameAnswerDeadline: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings?.questionIntervalSeconds ?? 180)) });
            batchError.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `Süre doldu! Soruyla ilgili bir sorun oluştuğu için cevap gösterilemiyor.`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true });
            await batchError.commit();
            toast({ title: "Süre Doldu!", description: "Soruyla ilgili bir sorun oluştu, cevap gösterilemiyor.", variant: "destructive" });
        } catch (errorResetting) {}
        return;
    }

    const { text: questionText, answer: correctAnswer } = activeGameQuestion;
    const roomDocRef = doc(db, "chatRooms", roomId);
    if (!(await getDoc(roomDocRef)).exists() || (await getDoc(roomDocRef)).data()?.currentGameQuestionId !== roomDetails.currentGameQuestionId) return;

    try {
      const batch = writeBatch(db);
      batch.update(roomDocRef, { currentGameQuestionId: null, currentGameAnswerDeadline: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings?.questionIntervalSeconds ?? 180)) });
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `Süre doldu! Kimse "${questionText}" sorusunu bilemedi. Doğru cevap: ${correctAnswer}.`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true });
      await batch.commit();
      toast({ title: "Süre Doldu!", description: `Kimse soruyu bilemedi. Cevap: ${correctAnswer}`, duration: 7000});
    } catch (error) { }
  }, [roomId, roomDetails?.currentGameQuestionId, activeGameQuestion, globalGameSettings?.questionIntervalSeconds, toast]);

  useEffect(() => {
    if (gameAnswerDeadlineTimerRef.current) clearInterval(gameAnswerDeadlineTimerRef.current);
    if (roomDetails?.isGameEnabledInRoom && roomDetails?.currentGameQuestionId && roomDetails.currentGameAnswerDeadline) {
      const updateAnswerCountdown = () => {
        if (roomDetails.currentGameAnswerDeadline) {
          const diffSeconds = Math.max(0, differenceInSeconds(roomDetails.currentGameAnswerDeadline.toDate(), new Date()));
          setQuestionAnswerCountdown(diffSeconds);
          if (diffSeconds === 0 && !isHandlingTimeoutRef.current) {
            isHandlingTimeoutRef.current = true;
            handleGameAnswerTimeout().finally(() => { isHandlingTimeoutRef.current = false; });
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
  }, [roomDetails?.isGameEnabledInRoom, roomDetails?.currentGameQuestionId, roomDetails?.currentGameAnswerDeadline, handleGameAnswerTimeout]);

  useEffect(() => {
    if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
    if (roomDetails?.isGameEnabledInRoom && roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline) {
      const updateCountdown = () => {
        if (roomDetails?.nextGameQuestionTimestamp) {
          setNextQuestionCountdown(Math.max(0, differenceInSeconds(roomDetails.nextGameQuestionTimestamp.toDate(), new Date())));
        } else { setNextQuestionCountdown(null); }
      };
      updateCountdown(); countdownDisplayTimerRef.current = setInterval(updateCountdown, 1000);
    } else { setNextQuestionCountdown(null); }
    return () => { if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current); };
  }, [roomDetails?.isGameEnabledInRoom, roomDetails?.nextGameQuestionTimestamp, roomDetails?.currentGameQuestionId, roomDetails?.currentGameAnswerDeadline]);


  const attemptToAskNewQuestion = useCallback(async () => {
    if (!isCurrentUserParticipantRef.current || !globalGameSettings?.isGameEnabled || !roomDetails?.isGameEnabledInRoom || !roomId || !roomDetails || roomDetails.currentGameQuestionId || availableGameQuestions.length === 0) return;
    try {
      const roomDocRef = doc(db, "chatRooms", roomId); const currentRoomSnap = await getDoc(roomDocRef);
      if (!currentRoomSnap.exists() || currentRoomSnap.data()?.currentGameQuestionId) return;
      const nextQuestion = availableGameQuestions[Math.floor(Math.random() * availableGameQuestions.length)];
        if (!nextQuestion) {
            if (globalGameSettings?.questionIntervalSeconds) await updateDoc(roomDocRef, { nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings.questionIntervalSeconds)) });
            return;
        }
      const batch = writeBatch(db);
      batch.update(roomDocRef, { currentGameQuestionId: nextQuestion.id, nextGameQuestionTimestamp: null, currentGameAnswerDeadline: Timestamp.fromDate(addSeconds(new Date(), GAME_ANSWER_TIMEOUT_SECONDS)) });
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `Yeni bir soru geldi! "${nextQuestion.text}" (Ödül: ${FIXED_GAME_REWARD} Elmas). Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın. (Süre: ${GAME_ANSWER_TIMEOUT_SECONDS}sn)`, senderId: "system", senderName: "Oyun Ustası", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });
      await batch.commit();
    } catch (error) { toast({ title: "Oyun Hatası", description: "Yeni soru hazırlanırken bir sorun oluştu.", variant: "destructive" }); }
  }, [globalGameSettings, roomDetails, roomId, availableGameQuestions, toast]);

  useEffect(() => {
    if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
    if (globalGameSettings?.isGameEnabled && roomDetails?.isGameEnabledInRoom && isCurrentUserParticipantRef.current && roomDetails && !loadingGameAssets) {
      gameQuestionIntervalTimerRef.current = setInterval(() => {
        if (roomDetails.nextGameQuestionTimestamp && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline) {
          attemptToAskNewQuestion();
        }
      }, 5000);
    }
    return () => { if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current); };
  }, [globalGameSettings, roomDetails, attemptToAskNewQuestion, loadingGameAssets]);


  useEffect(() => { if (isCurrentUserParticipantRef.current && globalGameSettings?.isGameEnabled && roomDetails?.isGameEnabledInRoom && roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline && availableGameQuestions.length > 0 && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !loadingGameAssets) { attemptToAskNewQuestion(); } }, [globalGameSettings, roomDetails, availableGameQuestions, attemptToAskNewQuestion, loadingGameAssets]);

  useEffect(() => {
    if (roomDetails?.isGameEnabledInRoom && roomDetails?.currentGameQuestionId && availableGameQuestions.length > 0) {
      const question = availableGameQuestions.find(q => q.id === roomDetails.currentGameQuestionId);
      setActiveGameQuestion(question || null); setShowGameQuestionCard(!!question);
    } else {
      setActiveGameQuestion(null); setShowGameQuestionCard(false);
    }
  }, [roomDetails?.isGameEnabledInRoom, roomDetails?.currentGameQuestionId, availableGameQuestions]);

  const handleCloseGameQuestionCard = useCallback(() => setShowGameQuestionCard(false), []);
  const getAvatarFallbackText = useCallback((name?: string | null) => name ? name.substring(0, 2).toUpperCase() : "PN", []);

  const updateUserTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserParticipantRef.current) return;
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    try { const participantSnap = await getDoc(participantRef); if (participantSnap.exists()) await updateDoc(participantRef, { isTyping }); } catch (error) { }
  }, [currentUser, roomId]);

  const handleLeaveRoom = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserParticipantRef.current) return Promise.resolve();
    
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    await updateUserTypingStatus(false);
    
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    const userDisplayNameForLeave = userData?.displayName || currentUser?.displayName;
    
    if (userDisplayNameForLeave && !isPageUnload) {
      try { 
        await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[SİSTEM] ${userDisplayNameForLeave} odadan ayrıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true }); 
      } catch (msgError) { }
    }
    
    try {
        const batch = writeBatch(db);
        batch.delete(participantRef);
        const roomDocSnap = await getDoc(roomRef);
        if (roomDocSnap.exists() && (roomDocSnap.data()?.participantCount ?? 0) > 0) {
             batch.update(roomRef, { participantCount: increment(-1) });
        }
        await batch.commit();
        setIsCurrentUserParticipant(false);
    } catch (error) { }
  }, [currentUser, roomId, updateUserTypingStatus, userData?.displayName]);

  const handleJoinRoom = useCallback(async () => {
    if (!currentUser || !userData || !roomId || !roomDetails || loadingGameAssets) return;
    setIsProcessingJoinLeave(true);
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    const userIsCurrentlyPremium = isCurrentUserPremium();
    try {
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) { setIsCurrentUserParticipant(true); if (participantSnap.data()?.isTyping) await updateDoc(participantRef, { isTyping: false }); setIsProcessingJoinLeave(false); return; }
      const currentRoomSnap = await getDoc(roomRef); if (!currentRoomSnap.exists()) { toast({ title: "Hata", description: "Oda bulunamadı.", variant: "destructive" }); router.push("/chat"); return; }
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if ((currentRoomData.participantCount ?? 0) >= currentRoomData.maxParticipants) { setIsRoomFullError(true); toast({ title: "Oda Dolu", description: "Bu oda maksimum katılımcı sayısına ulaşmış.", variant: "destructive" }); setIsProcessingJoinLeave(false); return; }

      if (currentRoomData.isActive && currentRoomData.lastMessageAt && differenceInMinutes(new Date(), currentRoomData.lastMessageAt.toDate()) > 3) {
          await updateDoc(roomRef, { isActive: false, activeSince: null });
      }

      const batch = writeBatch(db);
      batch.set(participantRef, { joinedAt: serverTimestamp(), displayName: userData.displayName, photoURL: userData.photoURL, uid: currentUser.uid, isTyping: false, isPremium: userIsCurrentlyPremium, lastSeen: serverTimestamp(), avatarFrameStyle: userData.avatarFrameStyle || 'default' });
      batch.update(roomRef, { participantCount: increment(1) });

      if (globalGameSettings?.isGameEnabled && currentRoomData.isGameEnabledInRoom && !currentRoomData.gameInitialized && !currentRoomData.nextGameQuestionTimestamp && !currentRoomData.currentGameQuestionId && !currentRoomData.currentGameAnswerDeadline) {
        batch.update(roomRef, { gameInitialized: true, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings.questionIntervalSeconds)), currentGameQuestionId: null, currentGameAnswerDeadline: null });
      }

      await batch.commit();
      setIsCurrentUserParticipant(true);
      toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });
      const userDisplayNameForJoin = userData.displayName || "Bir kullanıcı";
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[SİSTEM] ${userDisplayNameForJoin} odaya katıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true, systemMessageType: userIsCurrentlyPremium ? 'premium_join' : 'normal_join', });

      if (globalGameSettings?.isGameEnabled && currentRoomData.isGameEnabledInRoom) {
        let gameInfoMessage = `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `;
        const updatedRoomSnap = await getDoc(roomRef); const updatedRoomData = updatedRoomSnap.data() as ChatRoomDetails;
        if (updatedRoomData?.currentGameQuestionId && availableGameQuestions.length > 0) {
            const currentQ = availableGameQuestions.find(q => q.id === updatedRoomData.currentGameQuestionId);
            if (currentQ) gameInfoMessage += `Aktif bir soru var: "${currentQ.text}". Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`;
            if (updatedRoomData.currentGameAnswerDeadline) gameInfoMessage += ` (Kalan Süre: ${formatCountdown(differenceInSeconds(updatedRoomData.currentGameAnswerDeadline.toDate(), new Date()))})`
        }
        else if (updatedRoomData?.nextGameQuestionTimestamp) gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(differenceInSeconds(updatedRoomData.nextGameQuestionTimestamp.toDate(), new Date()))} sonra gelecek.`; 
        else if (typeof globalGameSettings.questionIntervalSeconds === 'number') gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(globalGameSettings.questionIntervalSeconds)} sonra gelecek.`;
        if (gameInfoMessage !== `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `) await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: gameInfoMessage, senderId: "system", senderName: "Oyun Ustası", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });
      }
    } catch (error) { toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setIsProcessingJoinLeave(false); }
  }, [currentUser, userData, roomId, roomDetails, toast, router, globalGameSettings, loadingGameAssets, availableGameQuestions, isCurrentUserPremium]);

  const formatCountdown = useCallback((seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  },[]);

  useEffect(() => {
    if (!roomId) return; setLoadingRoom(true);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomDetails({
            id: docSnap.id, name: data.name, description: data.description, creatorId: data.creatorId, creatorIsPremium: data.creatorIsPremium, isPremiumRoom: data.isPremiumRoom, participantCount: data.participantCount, maxParticipants: data.maxParticipants || PREMIUM_USER_ROOM_CAPACITY, expiresAt: data.expiresAt, isGameEnabledInRoom: data.isGameEnabledInRoom ?? (globalGameSettings?.isGameEnabled ?? false), currentGameQuestionId: data.currentGameQuestionId, nextGameQuestionTimestamp: data.nextGameQuestionTimestamp, gameInitialized: data.gameInitialized, voiceParticipantCount: data.voiceParticipantCount, currentGameAnswerDeadline: data.currentGameAnswerDeadline, image: data.image, imageAiHint: data.imageAiHint, isActive: data.isActive, lastMessageAt: data.lastMessageAt, activeChestId: data.activeChestId,
        }); document.title = `${data.name} - HiweWalk`;
      } else { toast({ title: "Hata", description: "Sohbet odası bulunamadı.", variant: "destructive" }); router.push("/chat"); }
      setLoadingRoom(false);
    }, (error) => { toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingRoom(false); });
    return () => unsubscribeRoom();
  }, [roomId, toast, router, globalGameSettings]);

  useEffect(() => {
    if (!roomId || !currentUser || !userData || !roomDetails || loadingGameAssets) return;
    if (!isCurrentUserParticipantRef.current && !isProcessingJoinLeave && !isRoomFullError) { handleJoinRoom(); }
    const q = query(collection(db, `chatRooms/${roomId}/participants`), orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(q, (snapshot) => {
      let foundCurrentUser = false;
      setActiveTextParticipants(snapshot.docs.map(doc => {
        if (doc.id === currentUser.uid) foundCurrentUser = true;
        return { id: doc.id, ...doc.data() } as ActiveTextParticipant;
      }));
      if (isCurrentUserParticipantRef.current !== foundCurrentUser && !isProcessingJoinLeave) setIsCurrentUserParticipant(foundCurrentUser);
    });
    return () => unsubscribeParticipants();
  }, [roomId, currentUser, userData, roomDetails, handleJoinRoom, isProcessingJoinLeave, isRoomFullError, loadingGameAssets]);

  useEffect(() => {
    if (!roomId) return; setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      setMessages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isOwn: doc.data().senderId === currentUser?.uid, userAiHint: doc.data().senderId === currentUser?.uid ? "user avatar" : "person talking" } as Message)));
      setLoadingMessages(false);
    }, (error) => { toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingMessages(false); });
    return () => unsubscribeMessages();
  }, [roomId, currentUser?.uid, toast]);
  
  const leaveRoomFully = useCallback(async (isPageUnload = false) => {
    if (!isCurrentUserParticipantRef.current) return;
    setIsCurrentUserParticipant(false); 
    const leaveVoicePromise = handleLeaveVoiceChat(isPageUnload);
    const leaveTextPromise = handleLeaveRoom(isPageUnload);
    await Promise.all([leaveVoicePromise, leaveTextPromise]);
    closeMinimizedRoom();
  }, [handleLeaveVoiceChat, handleLeaveRoom, closeMinimizedRoom]);
  
  const leaveRoomFullyRef = useRef(leaveRoomFully);
  useEffect(() => { leaveRoomFullyRef.current = leaveRoomFully }, [leaveRoomFully]);
  
  useEffect(() => {
    if (minimizedRoom?.id === roomId) closeMinimizedRoom();
    const handleBeforeUnload = () => { if (isCurrentUserParticipantRef.current) leaveRoomFullyRef.current(true); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isCurrentUserParticipantRef.current && roomDetailsRef.current) {
        minimizeRoom({ id: roomId, name: roomDetailsRef.current.name, image: roomDetailsRef.current.image, imageAiHint: roomDetailsRef.current.imageAiHint, leaveRoom: () => leaveRoomFullyRef.current(false) });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
      if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
      if (gameAnswerDeadlineTimerRef.current) clearInterval(gameAnswerDeadlineTimerRef.current);
    };
  }, [roomId, minimizeRoom, closeMinimizedRoom, minimizedRoom]);


  const scrollToBottom = useCallback(() => { if (scrollAreaRef.current) { const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]'); if (viewport) viewport.scrollTop = viewport.scrollHeight; } }, []);
  useLayoutEffect(() => {
    if (!loadingMessages) scrollToBottom();
  }, [messages, loadingMessages, scrollToBottom]);

  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;
  const canSendMessage = !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current && !editingMessage;

  const handleNewMessageInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value; setNewMessage(currentMessage);
    if (!isCurrentUserParticipantRef.current || !canSendMessage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else if (currentMessage.trim() !== "") updateUserTypingStatus(true);
    if (currentMessage.trim() === "") { updateUserTypingStatus(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }
    else { typingTimeoutRef.current = setTimeout(() => { updateUserTypingStatus(false); }, TYPING_DEBOUNCE_DELAY); }
  }, [canSendMessage, updateUserTypingStatus]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if(editingMessage) handleSaveEdit();
    else handleSendMessage();
  }

  const handleSendMessage = useCallback(async () => {
    if (isSending || isUserLoading || !currentUser || !newMessage.trim() || !roomId || !canSendMessage || !userData || loadingGameAssets) return;
    
    lastMessageTimesRef.current = lastMessageTimesRef.current.filter(time => Date.now() - time < MESSAGE_WINDOW_SECONDS * 1000);
    if (lastMessageTimesRef.current.length >= MAX_MESSAGES_PER_WINDOW) {
      toast({ title: "Spam Uyarısı", description: `Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz yavaşlayın.`, variant: "destructive" });
      return;
    }

    setIsSending(true);
    const tempMessage = newMessage.trim();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); }
    updateUserTypingStatus(false);
    const userIsCurrentlyPremium = isCurrentUserPremium();

    const mentionedUserIds: string[] = [];
    const mentionRegex = /@([\w.-]+)/g;
    let match;

    const participantNameMap = new Map(activeTextParticipants.map(p => p.displayName ? [p.displayName.toLowerCase().replace(/\s+/g, '_'), p.id] : []));
    while ((match = mentionRegex.exec(tempMessage)) !== null) {
      const mentionedUid = participantNameMap.get(match[1].toLowerCase().replace(/\s+/g, '_'));
      if (mentionedUid && !mentionedUserIds.includes(mentionedUid)) mentionedUserIds.push(mentionedUid);
    }

    if (activeGameQuestion && globalGameSettings?.isGameEnabled && roomDetails?.isGameEnabledInRoom) {
      if (roomDetails?.currentGameAnswerDeadline && isPast(roomDetails.currentGameAnswerDeadline.toDate())) {
        toast({ title: "Süre Doldu!", description: "Bu soru için cevap süresi doldu.", variant: "destructive" });
        setIsSending(false); return;
      }
      const roomDocRef = doc(db, "chatRooms", roomId);
      if (tempMessage.toLowerCase() === "/hint") {
        if ((userData.diamonds ?? 0) < HINT_COST) { toast({ title: "Yetersiz Elmas", description: `İpucu için ${HINT_COST} elmasa ihtiyacın var.`, variant: "destructive" }); setIsSending(false); return; }
        try { await updateUserDiamonds((userData.diamonds ?? 0) - HINT_COST); toast({ title: "İpucu!", description: (<div className="flex items-start gap-2"><Lightbulb className="h-5 w-5 text-yellow-400 mt-0.5" /><span>{activeGameQuestion.hint} (-{HINT_COST} <Gem className="inline h-3 w-3 mb-px" />)</span></div>), duration: 10000 }); await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[OYUN] ${userData.displayName} bir ipucu kullandı!`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true }); } catch (error) { toast({ title: "Hata", description: "İpucu alınırken bir sorun oluştu.", variant: "destructive" }); } finally { setNewMessage(""); setIsSending(false); } return;
      }
      if (tempMessage.toLowerCase().startsWith("/answer ")) {
        const userAnswer = tempMessage.substring(8).trim(); const currentRoomSnap = await getDoc(roomDocRef); const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
        if (currentRoomData?.currentGameQuestionId !== activeGameQuestion.id) { toast({ title: "Geç Kaldın!", description: "Bu soruya zaten cevap verildi veya soru değişti.", variant: "destructive" }); setIsSending(false); return; }
        if (userAnswer.toLowerCase() === activeGameQuestion.answer.toLowerCase()) { const reward = FIXED_GAME_REWARD; await updateUserDiamonds((userData.diamonds || 0) + reward); const batch = writeBatch(db); batch.update(roomDocRef, { currentGameQuestionId: null, currentGameAnswerDeadline: null, nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), globalGameSettings.questionIntervalSeconds)) }); batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `Tebrikler ${userData.displayName}! "${activeGameQuestion.text}" sorusuna doğru cevap verdin ve ${reward} elmas kazandın!`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true }); await batch.commit(); toast({ title: "Doğru Cevap!", description: `${reward} elmas kazandın!` }); setAvailableGameQuestions(prev => prev.filter(q => q.id !== activeGameQuestion.id)); }
        else { addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `${userData.displayName}, "${userAnswer}" cevabın doğru değil. Tekrar dene!`, senderId: "system", senderName: "Oyun Ustası", timestamp: serverTimestamp(), isGameMessage: true }); toast({ title: "Yanlış Cevap", description: "Maalesef doğru değil, tekrar deneyebilirsin.", variant: "destructive" }); }
        setNewMessage(""); setIsSending(false); return;
      }
    }
    try {
        const batch = writeBatch(db);
        const roomRef = doc(db, "chatRooms", roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            const roomData = roomSnap.data();
            const updates: {[key: string]: any} = { lastMessageAt: serverTimestamp() };
            if (!roomData.isActive && (roomData.participantCount ?? 0) >= 5) { updates.isActive = true; updates.activeSince = serverTimestamp(); }
            batch.update(roomRef, updates);
        }
        batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
            text: tempMessage, senderId: currentUser.uid, senderName: userData?.displayName, senderAvatar: userData?.photoURL, senderIsPremium: userIsCurrentlyPremium, senderBubbleStyle: userData?.bubbleStyle, senderAvatarFrameStyle: userData?.avatarFrameStyle, timestamp: serverTimestamp(), isGameMessage: false, isChestMessage: false, mentionedUserIds: mentionedUserIds, editedAt: null, reactions: {},
        });
        await batch.commit();
        setNewMessage("");
        lastMessageTimesRef.current.push(Date.now());
    } catch (error) { toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" }); }
    finally { setIsSending(false); }
  },[isSending, isUserLoading, currentUser, newMessage, roomId, canSendMessage, userData, loadingGameAssets, activeGameQuestion, globalGameSettings, roomDetails, toast, updateUserDiamonds, activeTextParticipants, updateUserTypingStatus, isCurrentUserPremium]);

  const handleDeleteRoom = useCallback(async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) { toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" }); return; }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz, tüm mesajlar ve katılımcı bilgileri silinecektir.`)) return;
    try { await deleteChatRoomAndSubcollections(roomId); toast({ title: "Başarılı", description: `"${roomDetails.name}" odası silindi.` }); router.push("/chat"); } catch (error) { toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" }); }
  },[roomDetails, currentUser, roomId, router, toast]);

  const handleExtendDuration = useCallback(async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid || !roomDetails.expiresAt) { toast({ title: "Hata", description: "Süre uzatma işlemi yapılamadı.", variant: "destructive" }); return; }
    if ((userData.diamonds ?? 0) < ROOM_EXTENSION_COST) { toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var.`, variant: "destructive" }); return; }
    setIsExtending(true);
    try {
      await updateDoc(doc(db, "chatRooms", roomId), { expiresAt: Timestamp.fromDate(addMinutes(roomDetails.expiresAt.toDate(), ROOM_EXTENSION_DURATION_MINUTES)) });
      await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_EXTENSION_COST);
      toast({ title: "Başarılı", description: `Oda süresi ${ROOM_EXTENSION_DURATION_MINUTES} dakika uzatıldı.` });
    } catch (error) { toast({ title: "Hata", description: "Süre uzatılırken bir sorun oluştu.", variant: "destructive" }); } finally { setIsExtending(false); }
  },[roomDetails, currentUser, userData, roomId, toast, updateUserDiamonds]);

  const handleIncreaseCapacity = useCallback(async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid) { toast({ title: "Hata", description: "Kapasite artırma işlemi yapılamadı.", variant: "destructive" }); return; }
    if ((userData.diamonds ?? 0) < CAPACITY_INCREASE_COST) { toast({ title: "Yetersiz Elmas", description: `Kapasite artırmak için ${CAPACITY_INCREASE_COST} elmasa ihtiyacınız var.`, variant: "destructive" }); return; }
    if (roomDetails.maxParticipants >= PREMIUM_USER_ROOM_CAPACITY) { toast({ title: "Limit Dolu", description: "Oda zaten maksimum premium kapasitesine ulaşmış.", variant: "default" }); return; }
    setIsIncreasingCapacity(true);
    try {
      await updateDoc(doc(db, "chatRooms", roomId), { maxParticipants: increment(CAPACITY_INCREASE_SLOTS) });
      await updateUserDiamonds((userData.diamonds ?? 0) - CAPACITY_INCREASE_COST);
      toast({ title: "Başarılı", description: `Oda kapasitesi ${CAPACITY_INCREASE_SLOTS} artırıldı.` });
    } catch (error) { toast({ title: "Hata", description: "Kapasite artırılırken bir sorun oluştu.", variant: "destructive" }); } finally { setIsIncreasingCapacity(false); }
  }, [roomDetails, currentUser, userData, roomId, toast, updateUserDiamonds]);


  const getPreciseExpiryInfo = useCallback((): string => {
    if (!roomDetails?.expiresAt) return "Süre bilgisi yok"; const expiryDate = roomDetails.expiresAt.toDate(); const now = currentTime;
    if (isPast(expiryDate)) return "Süresi Doldu"; const diffSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
    if (diffSeconds < 0) return "Süresi Doldu"; const days = Math.floor(diffSeconds / 86400); const hours = Math.floor((diffSeconds % 86400) / 3600); const minutes = Math.floor((diffSeconds % 3600) / 60); const seconds = diffSeconds % 60;
    if (days > 0) { return `${days} gün ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} sonra`; }
    if (hours > 0) { return `Kalan: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }
    return `Kalan: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [roomDetails?.expiresAt, currentTime]);

  const handleOpenUserInfoPopover = useCallback(async (senderId: string) => {
    if (!currentUser || senderId === currentUser.uid) return; setPopoverOpenForUserId(senderId); setPopoverLoading(true); setRelevantFriendRequest(null);
    try {
      const userDocSnap = await getDoc(doc(db, "users", senderId)); if (!userDocSnap.exists()) { toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" }); setPopoverOpenForUserId(null); return; }
      const targetUser = { uid: userDocSnap.id, ...userDocSnap.data() } as UserData;
      targetUser.isPremium = checkUserPremium(targetUser);
      setPopoverTargetUser(targetUser);
      if ((await getDoc(doc(db, `users/${currentUser.uid}/confirmedFriends`, senderId))).exists()) { setFriendshipStatus("friends"); }
      else if (!(await getDocs(query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", senderId), where("status", "==", "pending")))).empty) { const reqSnap = await getDocs(query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", senderId), where("status", "==", "pending"))); setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: reqSnap.docs[0].id, ...reqSnap.docs[0].data() } as FriendRequest); }
      else if (!(await getDocs(query(collection(db, "friendRequests"), where("fromUserId", "==", senderId), where("toUserId", "==", currentUser.uid), where("status", "==", "pending")))).empty) { const reqSnap = await getDocs(query(collection(db, "friendRequests"), where("fromUserId", "==", senderId), where("toUserId", "==", currentUser.uid), where("status", "==", "pending"))); setFriendshipStatus("request_received"); setRelevantFriendRequest({ id: reqSnap.docs[0].id, ...reqSnap.docs[0].data() } as FriendRequest); }
      else setFriendshipStatus("none");
    } catch (error) { toast({ title: "Hata", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, toast]);

  const handleSendFriendRequestPopover = useCallback(async () => {
    if (!currentUser || !userData || !popoverTargetUser) return; setPopoverLoading(true);
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    try { const newRequestRef = await addDoc(collection(db, "friendRequests"), { fromUserId: currentUser.uid, fromUsername: userData.displayName, fromAvatarUrl: userData.photoURL, fromUserIsPremium: currentUserIsCurrentlyPremium, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName, toAvatarUrl: popoverTargetUser.photoURL, status: "pending", createdAt: serverTimestamp() }); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` }); setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: newRequestRef.id, fromUserId: currentUser.uid, fromUsername: userData.displayName || "", fromAvatarUrl: userData.photoURL || null, fromUserIsPremium: currentUserIsCurrentlyPremium, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName || "", toAvatarUrl: popoverTargetUser.photoURL || null, status: "pending", createdAt: Timestamp.now() }); }
    catch (error) { toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, userData, popoverTargetUser, toast, isCurrentUserPremium]);

  const handleAcceptFriendRequestPopover = useCallback(async () => {
    if (!currentUser || !userData || !relevantFriendRequest || !popoverTargetUser) return; setPopoverLoading(true);
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    const targetUserIsCurrentlyPremium = popoverTargetUser.isPremium || false;
    try { const batch = writeBatch(db); batch.update(doc(db, "friendRequests", relevantFriendRequest.id), { status: "accepted" }); batch.set(doc(db, `users/${currentUser.uid}/confirmedFriends`, popoverTargetUser.uid), { displayName: popoverTargetUser.displayName, photoURL: popoverTargetUser.photoURL, isPremium: targetUserIsCurrentlyPremium, addedAt: serverTimestamp() }); batch.set(doc(db, `users/${popoverTargetUser.uid}/confirmedFriends`, currentUser.uid), { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: currentUserIsCurrentlyPremium, addedAt: serverTimestamp() }); await batch.commit(); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} ile arkadaş oldunuz.` }); setFriendshipStatus("friends"); setRelevantFriendRequest(null); }
    catch (error) { toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, userData, relevantFriendRequest, popoverTargetUser, toast, isCurrentUserPremium]);

  const handleDmAction = useCallback((targetUserId: string | undefined | null) => { if (!currentUser?.uid || !targetUserId) return; const dmId = generateDmChatId(currentUser.uid, targetUserId); router.push(`/dm/${dmId}`); setPopoverOpenForUserId(null); }, [currentUser?.uid, router]);
  const handleViewProfileAction = useCallback((targetUserId: string | undefined | null) => { if (!targetUserId) return; router.push(`/profile/${targetUserId}`); setPopoverOpenForUserId(null); }, [router]);
  const isCurrentUserRoomCreator = roomDetails?.creatorId === currentUser?.uid;

  const userIsCurrentlyPremium = isCurrentUserPremium();

  const toggleSelfMute = useCallback(async () => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current || !localStreamRef.current) return;
    const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
    const voiceParticipantSnap = await getDoc(voiceParticipantRef);
    if (voiceParticipantSnap.exists() && voiceParticipantSnap.data()?.isMutedByAdmin) {
      toast({ title: "Sessize Alındınız", description: "Oda yöneticisi tarafından sessize alındığınız için mikrofonunuzu açamazsınız.", variant: "destructive" });
      return;
    }
    const newMuteState = !selfMuted;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !newMuteState; });
    try {
        await updateDoc(voiceParticipantRef, { isMuted: newMuteState });
        setSelfMuted(newMuteState);
        if (newMuteState) updateSpeakingStatusInFirestore(false);
    } catch (error) {
        localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = selfMuted; });
    }
  }, [currentUser, roomId, selfMuted, toast, updateSpeakingStatusInFirestore]);

  const handleAdminToggleMuteUserVoice = useCallback(async (targetUserId: string, currentAdminMuteState?: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserRoomCreator || targetUserId === currentUser.uid) return;
    const newAdminMuteState = !currentAdminMuteState;
    try {
      await updateDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId), { isMutedByAdmin: newAdminMuteState, isMuted: newAdminMuteState });
      toast({ title: "Başarılı", description: `Kullanıcının mikrofonu ${newAdminMuteState ? "kapatıldı" : "açıldı"}.` });
    } catch (error) { }
  }, [currentUser, roomId, isCurrentUserRoomCreator, toast]);


  const handleKickParticipantFromTextChat = useCallback(async (targetUserId: string, targetUsername?: string) => {
    if (!isCurrentUserRoomCreator || !currentUser || targetUserId === currentUser?.uid) return;
    if (!confirm(`${targetUsername || 'Bu kullanıcıyı'} odadan atmak istediğinizden emin misiniz?`)) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `chatRooms/${roomId}/participants`, targetUserId));
      batch.update(doc(db, "chatRooms", roomId), { participantCount: increment(-1) });
      
      const voiceParticipantSnap = await getDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId));
      if (voiceParticipantSnap.exists()) {
        cleanupPeerConnection(targetUserId);
        batch.delete(voiceParticipantSnap.ref);
        batch.update(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(-1) });
      }
      batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), { text: `[SİSTEM] ${targetUsername || 'Bir kullanıcı'} oda sahibi tarafından atıldı.`, senderId: "system", senderName: "Sistem", timestamp: serverTimestamp(), isGameMessage: true });
      await batch.commit();
      toast({ title: "Başarılı", description: `${targetUsername || 'Kullanıcı'} odadan atıldı.` });
      setPopoverOpenForUserId(null);
    } catch (error) {}
  }, [isCurrentUserRoomCreator, currentUser, roomId, cleanupPeerConnection, toast]);

  const handleVoiceParticipantSlotClick = useCallback((participantId: string | null) => {
    if (participantId && participantId !== currentUser?.uid) handleOpenUserInfoPopover(participantId);
  }, [currentUser?.uid, handleOpenUserInfoPopover]);

  const gameStatusText = roomDetails?.isGameEnabledInRoom ? "Oyun Aktif" : "Oyun Kapalı";
  const getParticipantActivityStatus = useCallback((participant: ActiveTextParticipant): string => {
    if (!participant.lastSeen) return "Bilinmiyor";
    const diffMins = differenceInMinutes(new Date(), participant.lastSeen.toDate());
    if (diffMins < ACTIVE_IN_ROOM_THRESHOLD_MINUTES) return "Aktif";
    return formatDistanceToNowStrict(participant.lastSeen.toDate(), { addSuffix: true, locale: tr });
  }, []);
  
  useEffect(() => {
    if (!roomId) return;
    const chestRef = doc(db, `chatRooms/${roomId}/activeChest/current`);
    const unsubscribe = onSnapshot(chestRef, (docSnap) => {
      if (docSnap.exists()) {
        const chestData = { id: docSnap.id, ...docSnap.data() } as ActiveChest;
        if (isPast(chestData.expiresAt.toDate())) {
            setActiveChest(null);
            deleteDoc(chestRef).catch(e => console.warn("Could not delete expired chest", e));
        } else {
            setActiveChest(chestData);
        }
      } else {
        setActiveChest(null);
      }
    });
    return () => unsubscribe();
  }, [roomId]);
  
  const handleOpenChest = useCallback(async () => {
    if (!currentUser || !userData || !activeChest || isOpeningChest) return;
    setIsOpeningChest(true);
    const chestRef = doc(db, "chatRooms", roomId, "activeChest", "current");
    try {
      await runTransaction(db, async (transaction) => {
        const chestDoc = await transaction.get(chestRef);
        if (!chestDoc.exists()) throw new Error("Sandık artık mevcut değil.");
        const chestData = chestDoc.data() as ActiveChest;
        if (chestData.winners[currentUser.uid]) throw new Error("Bu sandıktan zaten ödül aldınız!");
        if (chestData.remainingDiamonds <= 0 || Object.keys(chestData.winners).length >= chestData.maxWinners) throw new Error("Sandıktaki tüm ödüller dağıtıldı.");
        
        const remainingWinners = chestData.maxWinners - Object.keys(chestData.winners).length;
        const avgAmount = Math.max(1, Math.floor(chestData.remainingDiamonds / remainingWinners));
        const amountWon = Math.min(chestData.remainingDiamonds, Math.floor(Math.random() * (avgAmount * 1.5)) + 1);

        const newRemainingDiamonds = chestData.remainingDiamonds - amountWon;
        const newWinners = { ...chestData.winners, [currentUser.uid]: amountWon };

        transaction.update(chestRef, { remainingDiamonds: newRemainingDiamonds, winners: newWinners });
        transaction.update(doc(db, 'users', currentUser.uid), { diamonds: increment(amountWon) });
        transaction.set(doc(collection(db, 'chatRooms', roomId, 'messages')), { text: `${userData.displayName} sandıktan ${amountWon} elmas kazandı! 💎`, senderId: "system", senderName: "Hazine Avcısı", timestamp: serverTimestamp(), isChestMessage: true });
        
        if (newRemainingDiamonds <= 0 || Object.keys(newWinners).length >= chestData.maxWinners) {
            transaction.delete(chestRef);
            transaction.update(doc(db, "chatRooms", roomId), { activeChestId: null });
            transaction.set(doc(collection(db, 'chatRooms', roomId, 'messages')), { text: `${chestData.creatorName} tarafından oluşturulan hazine sandığı tükendi!`, senderId: "system", senderName: "Hazine Avcısı", timestamp: serverTimestamp(), isChestMessage: true });
        }
      });
      toast({ title: "Tebrikler!", description: `Sandıktan elmas kazandınız! Detaylar için sohbeti kontrol edin.`, className: 'bg-yellow-500 text-black dark:bg-yellow-400 dark:text-black'});
    } catch (error: any) {
        toast({ title: "Sandık Hatası", description: error.message, variant: "destructive" });
    } finally {
        setIsOpeningChest(false);
    }
  }, [currentUser, userData, activeChest, roomId, toast, isOpeningChest]);


  if (loadingRoom || !roomDetails || (isProcessingJoinLeave && !isRoomFullError && !isCurrentUserParticipantRef.current) || loadingGameAssets) {
    return (<div className="flex flex-1 items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2 text-lg">Oda yükleniyor...</p></div>);
  }

  return (
    <div className="relative h-screen">
      {activeChest && roomDetails?.expiresAt && (
            <ActiveChestDisplay
                chest={activeChest}
                roomExpiresAt={roomDetails.expiresAt}
                onOpenChest={handleOpenChest}
                isOpening={isOpeningChest}
            />
      )}
      <div className="flex flex-col h-full bg-card rounded-xl shadow-lg overflow-hidden relative">
        {Object.entries(activeRemoteStreams).map(([uid, stream]) => (
            <audio
                key={uid}
                autoPlay
                playsInline
                controls={process.env.NODE_ENV === 'development'}
                ref={audioEl => { if (audioEl && audioEl.srcObject !== stream) audioEl.srcObject = stream; }}
            />
        ))}

        {showGameQuestionCard && activeGameQuestion && roomDetails.isGameEnabledInRoom && globalGameSettings?.isGameEnabled && ( <GameQuestionCard question={activeGameQuestion} onClose={handleCloseGameQuestionCard} reward={FIXED_GAME_REWARD} countdown={questionAnswerCountdown} /> )}
        <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-20">
            <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9">
                <Link href="/chat"><ArrowLeft className="h-5 w-5" /><span className="sr-only">Geri</span></Link>
            </Button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={roomDetails.image || `https://placehold.co/40x40.png?text=${roomDetails.name.substring(0, 1)}`} data-ai-hint={roomDetails.imageAiHint || "group chat"} />
                <AvatarFallback>{getAvatarFallbackText(roomDetails.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-foreground truncate" title={roomDetails.name}>{roomDetails.name}</h2>
                {isCurrentUserRoomCreator && <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" title="Oda Sahibi" />}
                {roomDetails.creatorIsPremium && <Star className="h-4 w-4 text-yellow-400 flex-shrink-0" title="Premium Oda Sahibi" />}
                {roomDetails.description && (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary p-0"><Info className="h-4 w-4" /> <span className="sr-only">Oda Açıklaması</span></Button></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{roomDetails.description}</p></TooltipContent></Tooltip></TooltipProvider>)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground gap-x-2 flex-wrap">
                    {roomDetails.expiresAt && (<div className="flex items-center truncate"> <Clock className="mr-1 h-3 w-3" /> <span className="truncate" title={getPreciseExpiryInfo()}>{getPreciseExpiryInfo()}</span> </div>)}
                    {globalGameSettings?.isGameEnabled && (<Badge variant="outline" className={cn("flex items-center gap-1 border-none px-1 py-0.5", roomDetails.isGameEnabledInRoom ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10')}><Gamepad2 className="h-3 w-3" />{roomDetails.isGameEnabledInRoom ? 'Oyun Aktif' : 'Oyun Kapalı'}</Badge>)}
                    {roomDetails.isGameEnabledInRoom && globalGameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && nextQuestionCountdown !== null && !activeGameQuestion && (<div className="flex items-center truncate ml-2 border-l pl-2 border-muted-foreground/30" title={`Sonraki soru: ${formatCountdown(nextQuestionCountdown)}`}><Puzzle className="mr-1 h-3.5 w-3.5 text-primary" /> <span className="text-xs text-muted-foreground font-mono"> {formatCountdown(nextQuestionCountdown)} </span></div>)}
                    {roomDetails.isGameEnabledInRoom && globalGameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && questionAnswerCountdown !== null && activeGameQuestion && (<div className="flex items-center truncate ml-2 border-l pl-2 border-destructive/70" title={`Cevap süresi: ${formatCountdown(questionAnswerCountdown)}`}><Gamepad2 className="mr-1 h-3.5 w-3.5 text-destructive" /> <span className="text-xs text-destructive font-mono"> {formatCountdown(questionAnswerCountdown)} </span></div>)}
                </div>
            </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
            <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-9 px-2.5"> <UsersRound className="h-4 w-4" /> <span className="text-xs">{activeTextParticipants.length}/{roomDetails.maxParticipants}</span> </Button></PopoverTrigger>
                <PopoverContent className="w-72 p-0"><div className="p-2.5 border-b"><h3 className="text-xs font-medium text-center text-muted-foreground"> Metin Sohbeti Katılımcıları ({activeTextParticipants.length}/{roomDetails.maxParticipants}) </h3></div>
                <ScrollArea className="max-h-60"> {activeTextParticipants.length === 0 ? (<div className="text-center text-xs text-muted-foreground py-3 px-2"> <Users className="mx-auto h-6 w-6 mb-1 text-muted-foreground/50" /> Odada kimse yok. </div>) :
                    <ul className="divide-y divide-border">{activeTextParticipants.map(p => (<li key={p.id} className="flex items-center gap-2 p-2.5 hover:bg-secondary/30 dark:hover:bg-secondary/20"><div onClick={() => p.id !== currentUser?.uid && handleOpenUserInfoPopover(p.id)} className={cn('relative flex-shrink-0 cursor-pointer', `avatar-frame-${p.avatarFrameStyle || 'default'}`)}><Avatar className="h-7 w-7"><AvatarImage src={p.photoURL || "https://placehold.co/40x40.png"} /><AvatarFallback>{getAvatarFallbackText(p.displayName)}</AvatarFallback></Avatar>{getParticipantActivityStatus(p) === "Aktif" && <Dot className="absolute -bottom-1 -right-1 h-5 w-5 text-green-500 fill-green-500" />}{p.isPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}</div><div className="flex-1 min-w-0"><div onClick={() => p.id !== currentUser?.uid && handleOpenUserInfoPopover(p.id)} className="cursor-pointer"><span className="text-xs font-medium truncate text-muted-foreground block hover:underline">{p.displayName || "Bilinmeyen"}{p.isTyping && <Pencil className="inline h-3 w-3 ml-1.5 text-primary animate-pulse" />}</span></div><span className="text-[10px] text-muted-foreground/70 block">{getParticipantActivityStatus(p) === "Aktif" ? <span className="text-green-600 dark:text-green-400 font-medium">Odada Aktif</span> : getParticipantActivityStatus(p)}</span></div>{isCurrentUserRoomCreator && p.id !== currentUser?.uid && (<Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => handleKickParticipantFromTextChat(p.id, p.displayName || undefined)} title="Odadan At"><LogOut className="h-3.5 w-3.5"/></Button>)}</li>))}</ul>
                }</ScrollArea>
                </PopoverContent>
            </Popover>
            {currentUser && roomDetails.creatorId === currentUser.uid && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9"><MoreVertical className="h-5 w-5" /><span className="sr-only">Oda Seçenekleri</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setIsEditRoomModalOpen(true)}><SettingsIcon className="mr-2 h-4 w-4" /> Oda Ayarları</DropdownMenuItem>{!isRoomExpired && roomDetails.expiresAt && (<DropdownMenuItem onClick={handleExtendDuration} disabled={isExtending || isUserLoading || isIncreasingCapacity}>{isExtending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Süre Uzat</DropdownMenuItem>)}{!userIsCurrentlyPremium && roomDetails.maxParticipants < PREMIUM_USER_ROOM_CAPACITY && (<DropdownMenuItem onClick={handleIncreaseCapacity} disabled={isIncreasingCapacity || isUserLoading || isExtending}>{isIncreasingCapacity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Katılımcı Artır</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem onClick={handleDeleteRoom} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Odayı Sil</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}
            </div>
        </header>
        <div className="p-3 border-b bg-background/70 backdrop-blur-sm"> <div className="flex items-center justify-between mb-2"> <h3 className="text-sm font-medium text-primary">Sesli Sohbet ({activeVoiceParticipants.length}/{roomDetails.maxParticipants})</h3> {isCurrentUserInVoiceChat ? (<div className="flex items-center gap-2"> <Button variant={selfMuted ? "destructive" : "outline"} size="sm" onClick={toggleSelfMute} className="h-8 px-2.5" disabled={isProcessingVoiceJoinLeave} title={selfMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}>{selfMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button> <Button variant="outline" size="sm" onClick={() => leaveRoomFully(false)} disabled={isProcessingVoiceJoinLeave} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Ayrıl</Button> </div>) : (<Button variant="default" size="sm" onClick={handleJoinVoiceChat} disabled={isProcessingVoiceJoinLeave || (roomDetails.voiceParticipantCount ?? 0) >= roomDetails.maxParticipants} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}<Mic className="mr-1.5 h-4 w-4" /> Katıl</Button>)} </div> <VoiceParticipantGrid participants={activeVoiceParticipants} currentUserUid={currentUser?.uid} isCurrentUserRoomCreator={isCurrentUserRoomCreator} roomCreatorId={roomDetails?.creatorId} maxSlots={roomDetails.maxParticipants} onAdminKickUser={() => { }} onAdminToggleMuteUser={handleAdminToggleMuteUserVoice} getAvatarFallbackText={getAvatarFallbackText} onSlotClick={handleVoiceParticipantSlotClick} /> </div>
        <div className="flex flex-1 overflow-hidden">
            <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}> {loadingMessages && (<div className="flex flex-1 items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p> </div>)} {!loadingMessages && messages.length === 0 && !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current && (<div className="text-center text-muted-foreground py-10 px-4"> <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Henüz hiç mesaj yok.</p> <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p> </div>)} {!isCurrentUserParticipantRef.current && !isRoomFullError && !loadingRoom && !isProcessingJoinLeave && (<div className="text-center text-muted-foreground py-10 px-4"> <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Odaya katılmadınız.</p> <p className="text-sm">Mesajları görmek ve göndermek için odaya otomatik olarak katılıyorsunuz.</p> </div>)} {isRoomFullError && (<div className="text-center text-destructive py-10 px-4"> <ShieldAlert className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odası dolu!</p> <p>Mesaj gönderemezsiniz.</p> </div>)} {isRoomExpired && !isRoomFullError && (<div className="text-center text-destructive py-10"> <Clock className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p> <p>Yeni mesaj gönderilemez.</p> </div>)}
            {messages.map((msg) => (<ChatMessageItem key={msg.id} msg={msg} currentUserUid={currentUser?.uid} popoverOpenForUserId={popoverOpenForUserId} onOpenUserInfoPopover={handleOpenUserInfoPopover} setPopoverOpenForUserId={setPopoverOpenForUserId} popoverLoading={popoverLoading} popoverTargetUser={popoverTargetUser} friendshipStatus={friendshipStatus} relevantFriendRequest={relevantFriendRequest} onAcceptFriendRequestPopover={handleAcceptFriendRequestPopover} onSendFriendRequestPopover={handleSendFriendRequestPopover} onDmAction={handleDmAction} onViewProfileAction={handleViewProfileAction} getAvatarFallbackText={getAvatarFallbackText} isCurrentUserRoomCreator={isCurrentUserRoomCreator} onKickParticipantFromTextChat={handleKickParticipantFromTextChat} roomId={roomId} isActiveParticipant={activeTextParticipants.some(p => p.id === msg.senderId && differenceInMinutes(new Date(), p.lastSeen?.toDate() || 0) < ACTIVE_IN_ROOM_THRESHOLD_MINUTES) || activeVoiceParticipants.some(p => p.id === msg.senderId)} onStartEdit={handleStartEdit} />))}
            </ScrollArea>
        </div>
        <form onSubmit={handleFormSubmit} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
            {editingMessage && (<div className="bg-secondary/50 rounded-lg px-3 py-2 mb-2 border-l-4 border-primary"><div className="flex justify-between items-center"><p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">Mesaj düzenleniyor: "{editingMessage.text}"</p><Button variant="ghost" size="icon" type="button" onClick={handleCancelEdit}><X className="h-4 w-4"/><span className="sr-only">Düzenlemeyi İptal Et</span></Button></div></div>)}
            <div className="relative flex items-center gap-2"> <Button variant="ghost" size="icon" type="button" onClick={() => setIsChestCreateOpen(true)} disabled={!canSendMessage || isUserLoading || isSending || !!activeChest} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 text-yellow-500 hover:text-yellow-400"><Gift className="h-5 w-5" /><span className="sr-only">Hediye Sandığı Gönder</span></Button><Input ref={messageInputRef} placeholder={activeGameQuestion ? "Cevap: /answer <cevap> | İpucu: /hint" : !canSendMessage ? (isRoomExpired ? "Süre doldu" : isRoomFullError ? "Oda dolu" : "Bağlanılıyor...") : "Mesaj (@kullanıcı_adı)..."} value={newMessage} onChange={handleNewMessageInputChange} className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80" autoComplete="off" disabled={!canSendMessage || isSending || isUserLoading} /><div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center"> <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isSending} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex"> <Paperclip className="h-5 w-5 text-muted-foreground" /> <span className="sr-only">Dosya Ekle</span> </Button> <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim()}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMessage ? <Check className="h-4 w-4"/> : <Send className="h-4 w-4" />} <span className="sr-only">Gönder</span></Button> </div></div>
            {!canSendMessage && (<p className="text-xs text-destructive text-center mt-1.5"> {isRoomExpired ? "Bu odanın süresi dolduğu için mesaj gönderemezsiniz." : isRoomFullError ? "Oda dolu olduğu için mesaj gönderemezsiniz." : !isCurrentUserParticipantRef.current && !loadingRoom && !isProcessingJoinLeave ? "Mesaj göndermek için odaya katılmayı bekleyin." : ""} </p>)}
        </form>
      </div>
      {isEditRoomModalOpen && roomDetails && (<EditChatRoomDialog isOpen={isEditRoomModalOpen} onClose={() => setIsEditRoomModalOpen(false)} roomId={roomDetails.id} initialName={roomDetails.name} initialDescription={roomDetails.description || ""} initialImage={roomDetails.image} initialIsGameEnabledInRoom={roomDetails.isGameEnabledInRoom} />)}
      {roomDetails && userData && (<CreateChestDialog isOpen={isChestCreateOpen} onClose={() => setIsChestCreateOpen(false)} roomId={roomId} roomExpiresAt={roomDetails.expiresAt} userDiamonds={userData.diamonds} />)}
    </div>
  );
}

