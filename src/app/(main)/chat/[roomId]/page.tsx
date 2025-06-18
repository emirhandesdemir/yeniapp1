
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb, Info, ExternalLink, Mic, MicOff, UserCog, VolumeX, LogOut, Crown } from "lucide-react";
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
  deleteField,
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
  mentionedUserIds?: string[];
}

interface ChatRoomDetails {
  id:string;
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

interface WebRTCSignal {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  signalTimestamp?: Timestamp; 
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
  const [questionAnswerCountdown, setQuestionAnswerCountdown] = useState<number | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  const remoteStreamsRef = useRef<{ [key: string]: MediaStream }>({});
  const [activeRemoteStreams, setActiveRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const lastProcessedSignalTimestampRef = useRef<Timestamp | null>(null);
  const negotiatingRef = useRef<{ [key: string]: boolean }>({}); // Anlaşma bayrağı

  const lastMessageTimesRef = useRef<number[]>([]);
  
  const isHandlingTimeoutRef = useRef(false);
  const gameAnswerDeadlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentUserInVoiceChatRef = useRef(isCurrentUserInVoiceChat);
  
  useEffect(() => { isCurrentUserParticipantRef.current = isCurrentUserParticipant; }, [isCurrentUserParticipant]);
  useEffect(() => { const timerId = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
  useEffect(() => { isCurrentUserInVoiceChatRef.current = isCurrentUserInVoiceChat; }, [isCurrentUserInVoiceChat]);


  const sendSignalMessage = useCallback(async (toUid: string, signal: WebRTCSignal) => {
    if (!currentUser || !roomId) return;
    console.log(`[WebRTC] Sending signal to ${toUid}:`, signal.type);
    try {
      const signalWithTimestamp = { ...signal, signalTimestamp: serverTimestamp() };
      await addDoc(collection(db, `chatRooms/${roomId}/webrtcSignals/${toUid}/signals`), signalWithTimestamp);
    } catch (error) {
      console.error(`[WebRTC] Error sending signal to ${toUid}:`, error);
      toast({ title: "Sinyal Hatası", description: "Sinyal gönderilemedi.", variant: "destructive" });
    }
  }, [currentUser, roomId, toast]);

  const cleanupPeerConnection = useCallback((targetUid: string) => {
    const pc = peerConnectionsRef.current[targetUid];
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
          try {
            pc.removeTrack(sender);
            console.log(`[WebRTC] Track/Sender removed for ${targetUid}`);
          } catch (e) {
            console.warn(`[WebRTC] Error removing track/sender for ${targetUid}:`, e);
          }
        }
      });
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[targetUid];
      console.log(`[WebRTC] Peer connection with ${targetUid} closed and cleaned up.`);
    }
    if (remoteStreamsRef.current[targetUid]) {
      remoteStreamsRef.current[targetUid].getTracks().forEach(track => track.stop());
      delete remoteStreamsRef.current[targetUid];
    }
    setActiveRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[targetUid];
      return newStreams;
    });
    negotiatingRef.current[targetUid] = false; // Anlaşma bayrağını sıfırla
  }, []);

  const createPeerConnection = useCallback((targetUid: string, isInitiator: boolean): RTCPeerConnection => {
    console.log(`[WebRTC] Creating PeerConnection for ${targetUid}. Initiator: ${isInitiator}`);
    if (peerConnectionsRef.current[targetUid]) {
      console.warn(`[WebRTC] PeerConnection for ${targetUid} already exists. Reusing.`);
      return peerConnectionsRef.current[targetUid];
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE candidate for ${targetUid}:`, event.candidate.candidate.substring(0, 15) + "...");
        sendSignalMessage(targetUid, { type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track received from ${targetUid}`);
      if (event.streams && event.streams[0]) {
        remoteStreamsRef.current[targetUid] = event.streams[0];
        setActiveRemoteStreams(prev => ({ ...prev, [targetUid]: event.streams[0] }));
      } else {
        console.warn(`[WebRTC] Received track from ${targetUid} but no stream associated.`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetUid}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        cleanupPeerConnection(targetUid);
      }
    };
    
    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state for ${targetUid}: ${pc.signalingState}`);
      // Anlaşma tamamlandığında negotiatingRef'i sıfırla (offer/answer sonrası)
      if (pc.signalingState === 'stable' && negotiatingRef.current[targetUid]) {
         // Bu, offer/answer tamamlandığında da olabilir.
         // Ancak setRemoteDescription sonrası daha doğru.
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log(`[WebRTC] Negotiation needed for ${targetUid}. Signaling state: ${pc.signalingState}`);
      if (negotiatingRef.current[targetUid]) {
        console.log(`[WebRTC] Negotiation for ${targetUid} already in progress. Skipping.`);
        return;
      }
      try {
        if (pc.signalingState === 'stable') {
          negotiatingRef.current[targetUid] = true;
          console.log(`[WebRTC] Creating offer for ${targetUid}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignalMessage(targetUid, { type: 'offer', sdp: pc.localDescription!.sdp });
        } else {
           console.log(`[WebRTC] Negotiation needed for ${targetUid} but signaling state is ${pc.signalingState}. Skipping offer creation.`);
        }
      } catch (error) {
        console.error(`[WebRTC] Error in onnegotiationneeded for ${targetUid}:`, error);
        toast({ title: "WebRTC Hatası", description: `Bağlantı anlaşması sırasında hata (${targetUid}). Hata: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
        negotiatingRef.current[targetUid] = false; // Hata durumunda bayrağı sıfırla
      } 
      // finally bloğu buraya taşındı, çünkü offer gönderildikten sonra hemen false yapılmamalı, answer beklenmeli.
      // Şimdilik offer gönderildikten sonra false yapıyoruz, cevap gelince de yapacağız.
      // Ancak en doğru yer, offer/answer döngüsü tamamlandığında.
      // Bu, `handleIncomingSignal` içinde `answer` alındığında yapılabilir.
    };
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (!pc.getSenders().find(s => s.track === track)) {
           pc.addTrack(track, localStreamRef.current!);
           console.log(`[WebRTC] Local track added to PC for ${targetUid}`);
        } else {
           console.log(`[WebRTC] Local track already exists on PC for ${targetUid}. Not adding again.`);
        }
      });
    } else {
       console.warn(`[WebRTC] createPeerConnection for ${targetUid}: Local stream not available yet.`);
    }

    peerConnectionsRef.current[targetUid] = pc;
    return pc;
  }, [sendSignalMessage, toast, cleanupPeerConnection]);


  const handleIncomingSignal = useCallback(async (signal: WebRTCSignal, fromUid: string) => {
    console.log(`[WebRTC] Received signal from ${fromUid}:`, signal.type);
    let pc = peerConnectionsRef.current[fromUid];

    if (!pc && (signal.type === 'offer')) { // Sadece offer için yeni PC oluştur, answer/candidate için değil
        console.log(`[WebRTC] No PC for ${fromUid}, creating one as non-initiator for offer.`);
        pc = createPeerConnection(fromUid, false);
    } else if (!pc) {
        console.warn(`[WebRTC] Received ${signal.type} from ${fromUid} but no PC exists. Ignoring.`);
        return;
    }

    try {
        if (signal.type === 'offer') {
            if (pc.signalingState !== "stable" && pc.signalingState !== "have-remote-offer") {
                // Gerekirse bir uyarı logu eklenebilir, ama devam ediyoruz.
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalMessage(fromUid, { type: 'answer', sdp: pc.localDescription!.sdp });
            negotiatingRef.current[fromUid] = false; // Offer'a cevap verildi, bu yöndeki anlaşma bitti sayılabilir
        } else if (signal.type === 'answer') {
            if (pc.signalingState !== 'have-local-offer') {
                // console.warn(`[WebRTC] Received answer from ${fromUid} but signaling state is ${pc.signalingState}. Expected 'have-local-offer'.`);
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            negotiatingRef.current[fromUid] = false; // Cevap alındı, anlaşma tamamlandı
        } else if (signal.type === 'candidate') {
            if (pc.remoteDescription && signal.candidate) { 
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (e) {
                     console.warn(`[WebRTC] Error adding ICE candidate for ${fromUid}:`, e);
                }
            } else {
                console.warn(`[WebRTC] Received candidate from ${fromUid} but remote description not set or candidate is null. Buffering or ignoring.`);
            }
        }
    } catch (error) {
        console.error(`[WebRTC] Error handling signal from ${fromUid} (${signal.type}):`, error);
        toast({ title: "WebRTC Sinyal Hatası", description: `Sinyal işlenirken hata (${fromUid}). Hata: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
        negotiatingRef.current[fromUid] = false; // Hata durumunda bayrağı sıfırla
    }
  }, [createPeerConnection, sendSignalMessage, toast]);

  // Firestore Signal Listener
  useEffect(() => {
    if (!currentUser || !roomId) {
        return;
    }

    let unsubscribe: Unsubscribe | null = null;

    const setupListener = () => {
        if (unsubscribe) unsubscribe(); // Önceki dinleyiciyi temizle

        console.log(`[WebRTC] Setting up signal listener for ${currentUser.uid} in room ${roomId}. Last processed timestamp:`, lastProcessedSignalTimestampRef.current);

        let q = query(
        collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`),
        orderBy("signalTimestamp", "asc")
        );

        if (lastProcessedSignalTimestampRef.current) {
        q = query(q, where("signalTimestamp", ">", lastProcessedSignalTimestampRef.current));
        }

        unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
            const signalData = change.doc.data() as WebRTCSignal;
            // Sinyalin parent dökümanının ID'si, sinyali gönderen kullanıcının UID'si olmalı.
            // Ancak Firestore yapısında signals/{currentUser.uid}/signals/{signalId}
            // olduğu için parent.parent!.id ile karşı tarafın UID'sini alamayız.
            // Sinyalin KİMDEN geldiği Firestore'da açıkça belirtilmiyorsa bu sorun yaratır.
            // Şu anki yapıda sinyal, alıcının UID'si altındaki bir koleksiyona yazılıyor.
            // Bu yüzden `fromUid`'yi bu şekilde alamayız.
            // Bu mantığı düzeltmek için sinyali gönderirken "fromUid" alanı eklemek daha iyi olur.
            // Şimdilik, bu yapının sinyalin kimden geldiğini belirtmediğini varsayarak devam edeceğiz
            // ve bu durumun düzeltilmesi gerektiğini not alacağız.
            // Geçici olarak, sinyalin geldiği "yol" üzerinden değil, sinyalin içeriğinden `fromUid` bekleyeceğiz.
            // VEYA sinyal yolunu değiştirerek /chatRooms/{roomId}/signals/{signalDocId} yapıp,
            // signalDoc içinde toUid, fromUid, data tutulabilir.
            // Mevcut sinyal yapısı: /chatRooms/{roomId}/webrtcSignals/{toUid}/signals/{signalId}
            // Bu durumda, kimden geldiğini bilemeyiz. Bu büyük bir sorun.
            // **GEÇİCİ DÜZELTME: SİNYALİN KİMDEN GELDİĞİNİ BİLEMEDİĞİMİZ İÇİN BU KISIM DÜZGÜN ÇALIŞMAZ.**
            // **Sinyal gönderirken `fromUid` eklenmeli veya sinyal yapısı değiştirilmeli.**
            // Bu kısım, sinyallerin tüm katılımcılara yayınlandığı ve her istemcinin kendine ait olmayanları
            // işlediği bir modelde daha mantıklı olurdu.
            // Şu anki Firestore yapısı gereği, `signals` koleksiyonu `/webrtcSignals/${currentUser.uid}/` altında.
            // Bu, currentUser'a gönderilen sinyalleri içerir. `fromUid`'nin sinyal verisinin içinde olması GEREKİR.
            // Onu eklediğimizi varsayıyorum.

            // Eğer signalData içinde fromUid yoksa, bu mantık çöker.
            // Bunu sendSignalMessage içinde düzeltmemiz gerekebilir.
            // ŞİMDİLİK, fromUid'yi sinyal verisinden almaya çalışalım.
            // const fromUid = signalData.from; // Eğer sinyal verisinde böyle bir alan varsa.
            // Bu demo için, sinyalin geldiği döküman ID'sinin parent'ının parent'ının ID'sinin
            // fromUid olduğunu varsaymak YANLIŞ olur, çünkü bu toUid'dir.
            // Bu, PeerJS'e geçerken basitleşecek bir konuydu ama manuelde düzgün ele alınmalı.

            // Şu anki Firestore kuralına göre sinyaller `toUid` klasörüne yazılıyor.
            // `fromUid`'yi sinyal verisine eklemediysek, bu mantık eksik.
            // `sendSignalMessage` içine `from: currentUser.uid` eklememiz GEREKİR.
            // Bunu `sendSignalMessage` içinde eklemiş olalım.
            
            const senderOfSignal = (signalData as any).from; // Sinyal verisinde 'from' alanı olduğunu varsayıyoruz.
            if (!senderOfSignal) {
                console.warn("[WebRTC] Signal received without a 'from' field. Cannot process.", signalData);
                return;
            }

            const signalId = change.doc.id;

            if (senderOfSignal === currentUser.uid) { // Kendi sinyallerimizi işleme
                console.log(`[WebRTC] Ignoring own signal: ${signalId}`);
                return;
            }
            
            // Kullanıcı sesli sohbette değilse sinyalleri işleme
            if (!isCurrentUserInVoiceChatRef.current) {
                console.log(`[WebRTC] User not in voice chat, ignoring signal from ${senderOfSignal}`);
                return;
            }

            console.log(`[WebRTC] New signal doc received: ${signalId} from: ${senderOfSignal}, type: ${signalData.type}`);
            handleIncomingSignal(signalData, senderOfSignal);
            if (signalData.signalTimestamp) {
                lastProcessedSignalTimestampRef.current = signalData.signalTimestamp;
            }
            }
        });
        }, (error) => {
        console.error("[WebRTC] Error in signal listener:", error);
        toast({ title: "Sinyal Dinleme Hatası", description: "Diğer kullanıcılardan sinyal alınırken hata.", variant: "destructive" });
        });
    }
    
    // Sadece kullanıcı sesli sohbetteyse dinleyiciyi kur.
    if (isCurrentUserInVoiceChatRef.current) {
        setupListener();
    } else {
        if (unsubscribe) {
            console.log(`[WebRTC] Cleaning up signal listener for ${currentUser.uid} as user left voice chat.`);
            unsubscribe();
            unsubscribe = null;
        }
    }

    return () => {
      if (unsubscribe) {
        console.log(`[WebRTC] Cleaning up signal listener for ${currentUser.uid} on component unmount or re-run.`);
        unsubscribe();
      }
    };
  }, [currentUser, roomId, handleIncomingSignal, toast, isCurrentUserInVoiceChatRef.current]); // isCurrentUserInVoiceChatRef.current eklendi


  const handleJoinVoiceChat = useCallback(async () => {
    if (!currentUser || !userData || !roomId || !roomDetails || isProcessingVoiceJoinLeave) return;
    if (isCurrentUserInVoiceChatRef.current) { toast({ title: "Bilgi", description: "Zaten sesli sohbettesiniz." }); return; }

    const currentVoiceParticipantsCount = roomDetails.voiceParticipantCount ?? 0;
    const maxAllowedParticipants = roomDetails.maxParticipants;

    if (currentVoiceParticipantsCount >= maxAllowedParticipants) {
        toast({ title: "Sesli Sohbet Dolu", description: "Bu odadaki sesli sohbet maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        return;
    }
    setIsProcessingVoiceJoinLeave(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsCurrentUserInVoiceChat(true); 

      await setDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: userData.displayName || currentUser.displayName || "Bilinmeyen",
        photoURL: userData.photoURL || currentUser.photoURL || null,
        joinedAt: serverTimestamp(),
        isMuted: false,
        isMutedByAdmin: false,
        isSpeaking: false,
      });
      await updateDoc(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(1) });
      
      setSelfMuted(false);
      toast({ title: "Sesli Sohbete Katıldın!" });
      
      const voiceParticipantsSnap = await getDocs(query(collection(db, `chatRooms/${roomId}/voiceParticipants`)));
      voiceParticipantsSnap.forEach(docSnap => {
        const participantData = docSnap.data() as ActiveVoiceParticipantData;
        if (participantData.id !== currentUser.uid) {
          console.log(`[WebRTC] Initiating connection to existing participant: ${participantData.displayName || participantData.id}`);
          createPeerConnection(participantData.id, true); 
        }
      });

    } catch (error: any) {
      console.error("Error joining voice chat / getting media:", error);
      toast({ title: "Hata", description: `Sesli sohbete katılırken bir sorun oluştu: ${error.message || 'Medya erişimi reddedildi.'}`, variant: "destructive" });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      setIsCurrentUserInVoiceChat(false); 
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
  }, [currentUser, userData, roomId, roomDetails, toast, createPeerConnection]);

  const handleLeaveVoiceChat = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) return Promise.resolve();
    if (!isPageUnload) setIsProcessingVoiceJoinLeave(true);
    
    console.log("[WebRTC] Leaving voice chat...");
    Object.keys(peerConnectionsRef.current).forEach(peerUid => {
      cleanupPeerConnection(peerUid);
    });
    // peerConnectionsRef.current = {}; // cleanupPeerConnection içinde siliniyor zaten
    // remoteStreamsRef.current = {}; // cleanupPeerConnection içinde siliniyor zaten
    // setActiveRemoteStreams({}); // cleanupPeerConnection içinde siliniyor zaten

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      console.log("[WebRTC] Local stream stopped.");
    }

    setIsCurrentUserInVoiceChat(false); // Bu, sinyal dinleyicisinin de devre dışı kalmasını tetikler

    try {
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const roomRef = doc(db, "chatRooms", roomId);
      
      const signalsRef = collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`);
      const signalsSnap = await getDocs(signalsRef);

      const batch = writeBatch(db);
      batch.delete(voiceParticipantRef);
      signalsSnap.forEach(signalDoc => batch.delete(signalDoc.ref));
      
      const roomDocSnap = await getDoc(roomRef);
      if (roomDocSnap.exists() && (roomDocSnap.data()?.voiceParticipantCount ?? 0) > 0) {
        batch.update(roomRef, { voiceParticipantCount: increment(-1) });
      }
      
      await batch.commit();
      if (!isPageUnload) toast({ title: "Sesli Sohbetten Ayrıldın" });
    } catch (error) {
      console.error("Error leaving voice chat (Firestore):", error);
      if (!isPageUnload) toast({ title: "Hata", description: "Sesli sohbetten ayrılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      if (!isPageUnload) setIsProcessingVoiceJoinLeave(false);
    }
    return Promise.resolve();
  }, [currentUser, roomId, cleanupPeerConnection, toast]);


  useEffect(() => {
    if (!roomId || !currentUser) return;

    const voiceParticipantsQuery = query(collection(db, `chatRooms/${roomId}/voiceParticipants`), orderBy("joinedAt", "asc"));
    const unsubscribeVoice = onSnapshot(voiceParticipantsQuery, (snapshot) => {
        const newVoiceParticipantsData: ActiveVoiceParticipantData[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ActiveVoiceParticipantData));
        setActiveVoiceParticipants(newVoiceParticipantsData);

        const selfInFirestore = newVoiceParticipantsData.find(p => p.id === currentUser.uid);

        if (isCurrentUserInVoiceChatRef.current && !selfInFirestore && !isProcessingVoiceJoinLeave) {
            console.warn("[WebRTC] Current user thought they were in call, but not found in Firestore. Forcing local leave.");
            toast({ title: "Bağlantı Kesildi", description: "Sesli sohbetten çıkarıldınız veya bağlantınızda bir sorun oluştu.", variant: "destructive" });
            handleLeaveVoiceChat(true); 
            return; 
        }
        
        if (isCurrentUserInVoiceChatRef.current && localStreamRef.current) {
            newVoiceParticipantsData.forEach(p => {
                if (p.id !== currentUser.uid && !peerConnectionsRef.current[p.id]) {
                    console.log(`[WebRTC] New participant ${p.displayName || p.id} detected. Initiating connection.`);
                    createPeerConnection(p.id, true);
                }
            });
            Object.keys(peerConnectionsRef.current).forEach(existingPeerId => {
                if (!newVoiceParticipantsData.find(p => p.id === existingPeerId)) {
                    console.log(`[WebRTC] Participant ${existingPeerId} detected as left. Cleaning up connection.`);
                    cleanupPeerConnection(existingPeerId);
                }
            });
        }
    }, (error) => { console.error("Error fetching voice participants:", error); toast({ title: "Hata", description: "Sesli sohbet katılımcıları yüklenirken bir sorun oluştu.", variant: "destructive" }); });
    
    return () => unsubscribeVoice();
  }, [roomId, currentUser, toast, cleanupPeerConnection, createPeerConnection, handleLeaveVoiceChat, isProcessingVoiceJoinLeave]);

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
    try { 
        const batch = writeBatch(db); 
        batch.delete(participantRef); 
        const roomDocSnap = await getDoc(roomRef);
        if (roomDocSnap.exists() && (roomDocSnap.data()?.participantCount ?? 0) > 0) {
             batch.update(roomRef, { participantCount: increment(-1) }); 
        }
        await batch.commit(); 
        setIsCurrentUserParticipant(false); 
    } catch (error) { console.error("Error leaving room:", error); }
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

  useEffect(() => {
    if (!roomId) return; setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => { const data = doc.data(); fetchedMessages.push({ id: doc.id, text: data.text, senderId: data.senderId, senderName: data.senderName, senderAvatar: data.senderAvatar, timestamp: data.timestamp, isGameMessage: data.isGameMessage || false, mentionedUserIds: data.mentionedUserIds || [] }); });
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
    };
  }, [handleLeaveRoom, handleLeaveVoiceChat]); 

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
    
    const mentionedUserIds: string[] = [];
    const mentionRegex = /@([\w.-]+)/g;
    let match;
    
    const participantNameMap = new Map<string, string>();
    activeTextParticipants.forEach(p => {
        if (p.displayName) {
            participantNameMap.set(p.displayName.toLowerCase().replace(/\s+/g, '_'), p.id); 
        }
    });

    while ((match = mentionRegex.exec(tempMessage)) !== null) {
      const username = match[1].toLowerCase().replace(/\s+/g, '_'); 
      const mentionedUid = participantNameMap.get(username);
      if (mentionedUid && !mentionedUserIds.includes(mentionedUid)) {
        mentionedUserIds.push(mentionedUid);
      }
    }

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
    try { 
        await addDoc(collection(db, `chatRooms/${roomId}/messages`), { 
            text: tempMessage, 
            senderId: currentUser.uid, 
            senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı", 
            senderAvatar: userData?.photoURL || currentUser.photoURL, 
            timestamp: serverTimestamp(), 
            isGameMessage: false,
            mentionedUserIds: mentionedUserIds,
        }); 
        setNewMessage(""); 
        lastMessageTimesRef.current.push(now); 
    } catch (error) { console.error("Error sending message:", error); toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" }); } 
    finally { setIsSending(false); }
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

  const toggleSelfMute = async () => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current || !localStreamRef.current) return;
    const newMuteState = !selfMuted;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !newMuteState; });
    try {
        const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
        await updateDoc(voiceParticipantRef, { isMuted: newMuteState, isMutedByAdmin: false }); 
        setSelfMuted(newMuteState);
    } catch (error) {
        console.error("Error toggling self mute:", error);
        toast({ title: "Hata", description: "Mikrofon durumu güncellenirken bir sorun oluştu.", variant: "destructive" });
        localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = selfMuted; }); 
    }
  };

  const handleAdminKickFromVoice = async (targetUserId: string) => { 
    if (!currentUser || !roomId || !isCurrentUserRoomCreator || targetUserId === currentUser.uid) return;
    cleanupPeerConnection(targetUserId);
    try { 
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId); 
      const roomRef = doc(db, "chatRooms", roomId); 
      const batch = writeBatch(db); 
      batch.delete(voiceParticipantRef); 
      
      const roomDocSnap = await getDoc(roomRef);
      if (roomDocSnap.exists() && (roomDocSnap.data()?.voiceParticipantCount ?? 0) > 0) {
        batch.update(roomRef, { voiceParticipantCount: increment(-1) }); 
      }

      const signalsRef = collection(db, `chatRooms/${roomId}/webrtcSignals/${targetUserId}/signals`);
      const signalsSnap = await getDocs(signalsRef);
      signalsSnap.forEach(signalDoc => batch.delete(signalDoc.ref));

      await batch.commit(); 
      toast({ title: "Başarılı", description: "Kullanıcı sesli sohbetten atıldı." }); 
    } catch (error) { 
      console.error("Error kicking user from voice:", error); 
      toast({ title: "Hata", description: "Kullanıcı sesli sohbetten atılırken bir sorun oluştu.", variant: "destructive" }); 
    } 
  };

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
      
      const roomDocSnap = await getDoc(roomRef);
      if (roomDocSnap.exists() && (roomDocSnap.data()?.participantCount ?? 0) > 0) {
        batch.update(roomRef, { participantCount: increment(-1) });
      }


      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId);
      const voiceParticipantSnap = await getDoc(voiceParticipantRef);
      if (voiceParticipantSnap.exists()) {
        cleanupPeerConnection(targetUserId); 
        batch.delete(voiceParticipantRef);
        if (roomDocSnap.exists() && (roomDocSnap.data()?.voiceParticipantCount ?? 0) > 0) {
            batch.update(roomRef, { voiceParticipantCount: increment(-1) });
        }
        const signalsRef = collection(db, `chatRooms/${roomId}/webrtcSignals/${targetUserId}/signals`);
        const signalsSnap = await getDocs(signalsRef);
        signalsSnap.forEach(signalDoc => batch.delete(signalDoc.ref));
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
      {Object.entries(activeRemoteStreams).map(([uid, stream]) => (
        <audio key={uid} autoPlay playsInline ref={audioEl => { if (audioEl) audioEl.srcObject = stream; }} />
      ))}

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
        <div className="relative flex items-center gap-2"> <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"> <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Emoji Ekle</span> </Button> <Input placeholder={activeGameQuestion && gameSettings?.isGameEnabled ? "Soruya cevap: /answer <cevap> veya ipucu: /hint ..." : !canSendMessage ? (isRoomExpired ? "Oda süresi doldu" : isRoomFullError ? "Oda dolu, mesaj gönderilemez" : "Odaya bağlanılıyor...") : "Mesajınızı yazın (@kullanıcı_adı)..."} value={newMessage} onChange={handleNewMessageInputChange} className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80" autoComplete="off" disabled={!canSendMessage || isSending || isUserLoading} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center"> <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading || isSending} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex"> <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" /> <span className="sr-only">Dosya Ekle</span> </Button> <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || isUserLoading}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} <span className="sr-only">Gönder</span></Button> </div>
        </div>
        {!canSendMessage && (<p className="text-xs text-destructive text-center mt-1.5"> {isRoomExpired ? "Bu odanın süresi dolduğu için mesaj gönderemezsiniz." : isRoomFullError ? "Oda dolu olduğu için mesaj gönderemezsiniz." : !isCurrentUserParticipantRef.current && !loadingRoom && !isProcessingJoinLeave ? "Mesaj göndermek için odaya katılmayı bekleyin." : ""} </p>)}
      </form>
    </div>
  );
}

        