
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb, Info, ExternalLink, Mic, MicOff, UserCog, VolumeX, LogOut, Crown, UserPlus, Star } from "lucide-react";
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
import { useAuth, type UserData, type FriendRequest, checkUserPremium } from "@/contexts/AuthContext";
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
  senderIsPremium?: boolean;
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
  creatorIsPremium?: boolean;
  isPremiumRoom?: boolean;
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
  isPremium?: boolean;
  joinedAt?: Timestamp;
  isTyping?: boolean;
}

export interface ActiveVoiceParticipantData {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  isPremium?: boolean;
  joinedAt?: Timestamp;
  isMuted?: boolean; // User's self-mute status
  isMutedByAdmin?: boolean; // Admin-enforced mute
  isSpeaking?: boolean;
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

  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
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


  useEffect(() => { isCurrentUserParticipantRef.current = isCurrentUserParticipant; }, [isCurrentUserParticipant]);
  useEffect(() => { const timerId = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
  useEffect(() => { isCurrentUserInVoiceChatRef.current = isCurrentUserInVoiceChat; }, [isCurrentUserInVoiceChat]);
  useEffect(() => { localIsSpeakingRef.current = localIsSpeaking; }, [localIsSpeaking]);


  const sendSignalMessage = useCallback(async (toUid: string, signal: WebRTCSignal) => {
    if (!currentUser || !roomId) return;
    console.log(`[WebRTC] Sending signal to ${toUid}:`, signal.type, signal.sdp ? `SDP (first 30): ${signal.sdp.substring(0, 30)}...` : (signal.candidate ? `Candidate: ${signal.candidate.candidate?.substring(0,30)}...` : "No SDP/Candidate"));
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
      console.log(`[WebRTC] Cleaning up PeerConnection for ${targetUid}. Current state: ${pc.connectionState}, signaling: ${pc.signalingState}`);
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
      console.log(`[WebRTC] Peer connection with ${targetUid} closed and deleted.`);
    }
    if (remoteStreamsRef.current[targetUid]) {
      remoteStreamsRef.current[targetUid].getTracks().forEach(track => track.stop());
      delete remoteStreamsRef.current[targetUid];
    }
    setActiveRemoteStreams(prev => {
      const newStreams = { ...prev };
      if (newStreams[targetUid]) {
        console.log(`[WebRTC] Removing stream for ${targetUid} from activeRemoteStreams during cleanup.`);
        delete newStreams[targetUid];
      }
      return newStreams;
    });
    delete negotiatingRef.current[targetUid];
  }, []);

  const createPeerConnection = useCallback((targetUid: string): RTCPeerConnection | null => {
    console.log(`[WebRTC] Attempting to create PeerConnection for ${targetUid}.`);
    if (peerConnectionsRef.current[targetUid]) {
      console.warn(`[WebRTC] PeerConnection for ${targetUid} already exists. Reusing. State: ${peerConnectionsRef.current[targetUid].connectionState}`);
      return peerConnectionsRef.current[targetUid];
    }

    if (!localStreamRef.current || !localStreamRef.current.active || localStreamRef.current.getAudioTracks().length === 0) {
      console.error(`[WebRTC] Cannot create PeerConnection for ${targetUid}: Local stream is not available, not active, or has no audio tracks.`);
      toast({title: "Lokal Akış Hatası", description: "Peer bağlantısı oluşturulamadı: Mikrofon akışınız aktif değil.", variant: "destructive"});
      return null;
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    peerConnectionsRef.current[targetUid] = pc;
    console.log(`[WebRTC] PeerConnection created for ${targetUid}. Initial signalingState: ${pc.signalingState}`);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE candidate for ${targetUid}:`, event.candidate.candidate ? event.candidate.candidate.substring(0, 30) + "..." : "null candidate string");
        sendSignalMessage(targetUid, { type: 'candidate', candidate: event.candidate.toJSON() });
      } else {
        console.log(`[WebRTC] All ICE candidates have been sent for ${targetUid}. iceGatheringState: ${pc.iceGatheringState}`);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state change for ${targetUid}: ${pc.iceGatheringState}`);
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC ontrack] Track received from ${targetUid}. Stream IDs: ${event.streams.map(s => s.id).join(', ')}, Track kind: ${event.track.kind}, Track readyState: ${event.track.readyState}, Track muted: ${event.track.muted}, Track enabled: ${event.track.enabled}`);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        const audioTracks = remoteStream.getAudioTracks();
        console.log(`[WebRTC ontrack] Remote stream from ${targetUid} (ID: ${remoteStream.id}) is active: ${remoteStream.active}, has ${audioTracks.length} audio tracks.`);

        if (audioTracks.length > 0) {
            console.log(`[WebRTC ontrack] First audio track from ${targetUid}: id=${audioTracks[0].id}, kind=${audioTracks[0].kind}, label='${audioTracks[0].label}', enabled=${audioTracks[0].enabled}, muted=${audioTracks[0].muted}, readyState=${audioTracks[0].readyState}`);
            audioTracks[0].onunmute = () => console.log(`[WebRTC ontrack] Audio track ${audioTracks[0].id} from ${targetUid} UNMUTED.`);
            audioTracks[0].onmute = () => console.log(`[WebRTC ontrack] Audio track ${audioTracks[0].id} from ${targetUid} MUTED.`);
            audioTracks[0].onended = () => console.log(`[WebRTC ontrack] Audio track ${audioTracks[0].id} from ${targetUid} ENDED.`);
        } else {
            console.warn(`[WebRTC ontrack] Remote stream from ${targetUid} (ID: ${remoteStream.id}) has NO audio tracks.`);
        }

        if (remoteStream.active && audioTracks.length > 0) {
          setActiveRemoteStreams(prev => {
            if (prev[targetUid] === remoteStream && prev[targetUid]?.active === remoteStream.active) {
                console.log(`[WebRTC ontrack] Stream for ${targetUid} is already the same object and active status. No update to activeRemoteStreams.`);
                return prev;
            }
            console.log(`[WebRTC ontrack] Updating activeRemoteStreams for ${targetUid} with new stream object (ID: ${remoteStream.id}).`);
            return { ...prev, [targetUid]: remoteStream };
          });
          remoteStreamsRef.current[targetUid] = remoteStream;
        } else {
          console.warn(`[WebRTC ontrack] Remote stream from ${targetUid} (ID: ${remoteStream.id}) is INACTIVE or has NO audio tracks. Not adding/removing from activeRemoteStreams.`);
          setActiveRemoteStreams(prev => {
            if (prev[targetUid]) {
              const newStreams = { ...prev };
              delete newStreams[targetUid];
              console.warn(`[WebRTC ontrack] Removed previously active stream for ${targetUid} as it's no longer valid.`);
              return newStreams;
            }
            return prev;
          });
        }
      } else {
        console.warn(`[WebRTC ontrack] Received track event from ${targetUid} but no stream (event.streams[0] is null/undefined). Track kind: ${event.track.kind}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE connection state change for ${targetUid}: ${pc.iceConnectionState}. RTC Signaling State: ${pc.signalingState}, Connection State: ${pc.connectionState}, ICE Gathering State: ${pc.iceGatheringState}`);
         if (pc.iceConnectionState === 'failed') {
            console.error(`[WebRTC] ICE connection FAILED for ${targetUid}. Restarting ICE might be needed or check STUN/TURN servers.`);
        }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state change for ${targetUid}: ${pc.connectionState}. RTC Signaling State: ${pc.signalingState}, ICE Connection State: ${pc.iceConnectionState}, ICE Gathering State: ${pc.iceGatheringState}`);
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        console.warn(`[WebRTC] Connection with ${targetUid} is ${pc.connectionState}. Cleaning up.`);
        cleanupPeerConnection(targetUid);
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state change for ${targetUid}: ${pc.signalingState}`);
    };

    pc.onnegotiationneeded = async () => {
      console.log(`[WebRTC] Negotiation needed for ${targetUid}. Current signaling state: ${pc.signalingState}, Negotiating flag: ${negotiatingRef.current[targetUid]}`);
      if (negotiatingRef.current[targetUid]) {
        console.log(`[WebRTC] Negotiation for ${targetUid} already in progress. Skipping onnegotiationneeded.`);
        return;
      }
      try {
        if (pc.signalingState === 'stable') {
          negotiatingRef.current[targetUid] = true;
          console.log(`[WebRTC] Creating offer for ${targetUid} due to onnegotiationneeded. Current signalingState: ${pc.signalingState}`);
          const offer = await pc.createOffer();
          console.log(`[WebRTC] Offer created for ${targetUid}. Setting local description. Current signalingState: ${pc.signalingState}`);
          await pc.setLocalDescription(offer);
          console.log(`[WebRTC] Local description (offer) set for ${targetUid} from onnegotiationneeded. New signalingState: ${pc.signalingState}. SDP (first 30): ${offer.sdp?.substring(0,30)}...`);
          sendSignalMessage(targetUid, { type: 'offer', sdp: pc.localDescription!.sdp });
        } else {
           console.log(`[WebRTC] Negotiation needed for ${targetUid} but signaling state is ${pc.signalingState} (not 'stable'). Skipping offer creation in onnegotiationneeded.`);
        }
      } catch (error) {
        console.error(`[WebRTC] Error in onnegotiationneeded for ${targetUid}:`, error);
        toast({ title: "WebRTC Müzakere Hatası", description: `Bağlantı anlaşması (onnegotiationneeded) sırasında hata (${targetUid}). Detaylar konsolda.`, variant: "destructive" });
      } finally {
        negotiatingRef.current[targetUid] = false;
      }
    };

    if (localStreamRef.current && localStreamRef.current.active && localStreamRef.current.getTracks().length > 0) {
      const localTracks = localStreamRef.current.getTracks();
      console.log(`[WebRTC] Adding ${localTracks.length} local tracks to new PC for ${targetUid}. Local stream is active: ${localStreamRef.current.active}`);
      localTracks.forEach(track => {
        try {
            const sender = pc.getSenders().find(s => s.track === track);
            if (!sender) {
                 const newSender = pc.addTrack(track, localStreamRef.current!);
                 console.log(`[WebRTC] Local track (kind: ${track.kind}, id: ${track.id}, enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}) added to PC for ${targetUid}. Sender:`, newSender);
            } else {
                 console.log(`[WebRTC] Local track (kind: ${track.kind}, id: ${track.id}) already on PC for ${targetUid}. Sender:`, sender, `Not re-adding.`);
            }
        } catch (e) {
            console.error(`[WebRTC] Error adding local track ${track.kind} to PC for ${targetUid}:`, e);
        }
      });
    } else {
       console.warn(`[WebRTC] createPeerConnection for ${targetUid}: Local stream not available, not active, or has no tracks when PC created. localStreamRef.current:`, localStreamRef.current, `localStreamRef.current?.active:`, localStreamRef.current?.active);
    }

    return pc;
  }, [sendSignalMessage, toast, cleanupPeerConnection]);


  const handleIncomingSignal = useCallback(async (signal: WebRTCSignal, fromUid: string) => {
    console.log(`[WebRTC] Received signal from ${fromUid}:`, signal.type, "Current signaling state for peer:", peerConnectionsRef.current[fromUid]?.signalingState);
    let pc = peerConnectionsRef.current[fromUid];

    if (!pc && signal.type === 'offer') {
        console.log(`[WebRTC] No PC for ${fromUid} for incoming offer, creating one as non-initiator.`);
        pc = createPeerConnection(fromUid)!;
        if (!pc) {
          console.error(`[WebRTC] Failed to create peer connection for ${fromUid} upon receiving offer.`);
          return;
        }
    } else if (!pc) {
        console.warn(`[WebRTC] Received ${signal.type} from ${fromUid} but no PC exists and signal is not an offer. Ignoring.`);
        return;
    }

    try {
        if (signal.type === 'offer') {
            if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer" ) { 
                console.warn(`[WebRTC] Setting remote offer from ${fromUid} while signaling state is ${pc.signalingState}. This might indicate a glare condition or race.`);
            }
            if (signal.sdp) {
                console.log(`[WebRTC] Attempting to setRemoteDescription (offer) from ${fromUid}. Current signalingState: ${pc.signalingState}`);
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
                console.log(`[WebRTC] Remote description (offer) set for ${fromUid}. New signalingState: ${pc.signalingState}. Creating answer.`);
                const answer = await pc.createAnswer();
                console.log(`[WebRTC] Answer created for ${fromUid}. Setting local description. Current signalingState: ${pc.signalingState}`);
                await pc.setLocalDescription(answer);
                console.log(`[WebRTC] Local description (answer) set for ${fromUid}. New signalingState: ${pc.signalingState}. SDP (first 30): ${answer.sdp?.substring(0,30)}...`);
                sendSignalMessage(fromUid, { type: 'answer', sdp: pc.localDescription!.sdp });
            } else {
                 console.error(`[WebRTC] Received offer from ${fromUid} without SDP.`);
            }
            negotiatingRef.current[fromUid] = false;
        } else if (signal.type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
                if (signal.sdp) {
                    console.log(`[WebRTC] Attempting to setRemoteDescription (answer) from ${fromUid}. Current signalingState: ${pc.signalingState}`);
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                    console.log(`[WebRTC] Remote description (answer) set for ${fromUid}. New signalingState: ${pc.signalingState}. Connection should be established.`);
                } else {
                    console.error(`[WebRTC] Received answer from ${fromUid} without SDP.`);
                }
            } else {
                 console.warn(`[WebRTC] Received answer from ${fromUid} but local signaling state is ${pc.signalingState} (expected 'have-local-offer'). Ignoring answer.`);
            }
            negotiatingRef.current[fromUid] = false;
        } else if (signal.type === 'candidate') {
            if (signal.candidate && signal.candidate.candidate) { 
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    console.log(`[WebRTC] Added ICE candidate from ${fromUid}.`);
                } catch (e: any) {
                     console.warn(`[WebRTC] Error adding ICE candidate for ${fromUid} (State: ${pc.signalingState}):`, e.message, "Candidate:", signal.candidate);
                     if (!pc.remoteDescription && (e.message.includes("remote description is not set") || e.name === "InvalidStateError")) {
                        console.log(`[WebRTC] ICE candidate for ${fromUid} arrived before remote description was set. This is usually handled by the browser queueing the candidate.`);
                     }
                }
            } else {
                console.warn(`[WebRTC] Received null/empty candidate string from ${fromUid}. Candidate object:`, signal.candidate);
            }
        }
    } catch (error: any) {
        console.error(`[WebRTC] Error handling signal from ${fromUid} (type: ${signal.type}):`, error, `Signaling state was: ${pc.signalingState}`);
        toast({ title: "WebRTC Sinyal İşleme Hatası", description: `Sinyal işlenirken hata (${fromUid}, Tip: ${signal.type}, Durum: ${pc.signalingState}). Detaylar konsolda.`, variant: "destructive" });
        negotiatingRef.current[fromUid] = false;
    }
  }, [createPeerConnection, sendSignalMessage, toast]);

  useEffect(() => {
    if (!currentUser || !roomId) {
        return;
    }
    let unsubscribeSignals: Unsubscribe | null = null;
    const setupSignalListener = () => {
        if (unsubscribeSignals) unsubscribeSignals();
        console.log(`[WebRTC] Setting up signal listener for ${currentUser.uid} in room ${roomId}. Last processed timestamp:`, lastProcessedSignalTimestampRef.current);
        let q = query(
          collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`),
          orderBy("signalTimestamp", "asc")
        );
        if (lastProcessedSignalTimestampRef.current) {
          q = query(q, where("signalTimestamp", ">", lastProcessedSignalTimestampRef.current));
        }
        unsubscribeSignals = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const signalData = change.doc.data() as WebRTCSignal;
              const senderOfSignal = signalData.from;
              if (!senderOfSignal) {
                  console.warn("[WebRTC] Signal received without a 'from' field. Cannot process.", signalData);
                  return;
              }
              const signalId = change.doc.id;
              if (senderOfSignal === currentUser.uid) {
                  return;
              }
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
    };
    if (isCurrentUserInVoiceChat) {
        setupSignalListener();
    } else {
        if (unsubscribeSignals) {
            console.log(`[WebRTC] Cleaning up signal listener for ${currentUser.uid} as user left voice chat.`);
            unsubscribeSignals();
            unsubscribeSignals = null;
        }
    }
    return () => {
      if (unsubscribeSignals) {
        console.log(`[WebRTC] Cleaning up signal listener for ${currentUser.uid} on component unmount or re-run.`);
        unsubscribeSignals();
      }
    };
  }, [currentUser, roomId, handleIncomingSignal, toast, isCurrentUserInVoiceChat]);


  // Speaking detection logic
  const updateSpeakingStatusInFirestore = useCallback(async (isSpeaking: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) return;
    try {
      const participantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      await updateDoc(participantRef, { isSpeaking });
    } catch (error) {
      console.warn(`[WebRTC] Error updating speaking status for ${currentUser.uid} to ${isSpeaking}:`, error);
    }
  }, [currentUser, roomId]);

  const detectSpeaking = useCallback(() => {
    if (!audioContextRef.current || !analyserRef.current || !dataArrayRef.current) {
      speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking); 
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
    speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking);
  }, [updateSpeakingStatusInFirestore]);

  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current || !localStreamRef.current.active || localStreamRef.current.getAudioTracks().length === 0) {
      console.warn("[WebRTC Speaking] Cannot start speaking detection: Local stream not ready.");
      return;
    }
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(e => console.error("Error resuming AudioContext:", e));
        }
        if (!analyserRef.current && audioContextRef.current) {
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256; 
            const bufferLength = analyserRef.current.frequencyBinCount;
            dataArrayRef.current = new Uint8Array(bufferLength);
            const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
            source.connect(analyserRef.current);
        }
        if (speakingDetectionFrameIdRef.current) cancelAnimationFrame(speakingDetectionFrameIdRef.current);
        speakingDetectionFrameIdRef.current = requestAnimationFrame(detectSpeaking);
        console.log("[WebRTC Speaking] Speaking detection started.");
    } catch (e) {
        console.error("[WebRTC Speaking] Error starting speaking detection:", e);
    }
  }, [detectSpeaking]);

  const stopSpeakingDetection = useCallback(() => {
    console.log("[WebRTC Speaking] Stopping speaking detection.");
    if (speakingDetectionFrameIdRef.current) {
      cancelAnimationFrame(speakingDetectionFrameIdRef.current);
      speakingDetectionFrameIdRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (analyserRef.current) {
        // Disconnect analyser to allow garbage collection
        if (audioContextRef.current && audioContextRef.current.destination) {
            // Assuming source was connected to analyser, and analyser perhaps to destination or nowhere else
            // This is a bit tricky without knowing the full graph.
            // Best to just nullify and let GC handle if possible.
        }
        analyserRef.current = null;
    }
    dataArrayRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        console.log("[WebRTC Speaking] AudioContext closed.");
        audioContextRef.current = null;
      }).catch(e => {
          console.error("Error closing AudioContext:", e);
          audioContextRef.current = null; 
      });
    } else if (audioContextRef.current && audioContextRef.current.state === 'closed') {
        console.log("[WebRTC Speaking] AudioContext was already closed.");
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
    const maxAllowedParticipants = roomDetails.maxParticipants;

    if (currentVoiceParticipantsCount >= maxAllowedParticipants) {
        toast({ title: "Sesli Sohbet Dolu", description: "Bu odadaki sesli sohbet maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        return;
    }
    setIsProcessingVoiceJoinLeave(true);
    console.log("[WebRTC] Attempting to join voice chat. Getting user media...");
    const userIsCurrentlyPremium = isCurrentUserPremium();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log("[WebRTC] Got user media stream:", stream, "Number of tracks:", stream.getTracks().length, "Stream active:", stream.active);
      if (!stream.active || stream.getTracks().length === 0) {
        console.error("[WebRTC] GetUserMedia returned an inactive stream or a stream with no tracks!");
        toast({title: "Medya Hatası", description: "Mikrofonunuza erişilemedi veya boş/inaktif bir medya akışı alındı.", variant: "destructive"});
        throw new Error("No active tracks in media stream");
      }
      localStreamRef.current = stream;
      
      // Mute by admin check before enabling local track for others
      const selfVoiceDocRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const selfVoiceDocSnap = await getDoc(selfVoiceDocRef);
      const selfIsAdminMuted = selfVoiceDocSnap.exists() && selfVoiceDocSnap.data()?.isMutedByAdmin === true;

      if (selfIsAdminMuted) {
        console.log("[WebRTC] User is admin-muted. Joining voice but local tracks will remain disabled for others initially.");
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        setSelfMuted(true); // Reflect admin mute visually
      } else {
        setSelfMuted(false);
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      }
      startSpeakingDetection();


      await setDoc(doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: userData.displayName || currentUser.displayName || "Bilinmeyen",
        photoURL: userData.photoURL || currentUser.photoURL || null,
        isPremium: userIsCurrentlyPremium,
        joinedAt: serverTimestamp(),
        isMuted: selfIsAdminMuted, // Initial self-mute state reflects admin mute
        isMutedByAdmin: selfIsAdminMuted,
        isSpeaking: false,
      });
      await updateDoc(doc(db, "chatRooms", roomId), { voiceParticipantCount: increment(1) });

      setIsCurrentUserInVoiceChat(true);
      toast({ title: "Sesli Sohbete Katıldın!" });

      const voiceParticipantsQuery = query(collection(db, `chatRooms/${roomId}/voiceParticipants`));
      const voiceParticipantsSnap = await getDocs(voiceParticipantsQuery);

      voiceParticipantsSnap.forEach(docSnap => {
        const participantData = docSnap.data() as ActiveVoiceParticipantData;
        if (participantData.id !== currentUser.uid) {
          console.log(`[WebRTC] Joining: Initiating connection to existing participant: ${participantData.displayName || participantData.id}`);
          createPeerConnection(participantData.id);
        }
      });

    } catch (error: any) {
      console.error("[WebRTC] Error joining voice chat / getting media:", error);
      toast({ title: "Hata", description: `Sesli sohbete katılırken bir sorun oluştu: ${error.message || 'Medya erişimi reddedildi.'}`, variant: "destructive" });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        console.log("[WebRTC] Local stream stopped due to join error.");
      }
      stopSpeakingDetection();
      setIsCurrentUserInVoiceChat(false);
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
        console.error("[WebRTC] Error cleaning up voice participant on join failure:", cleanupError);
      }
    } finally {
      setIsProcessingVoiceJoinLeave(false);
    }
  }, [currentUser, userData, roomId, roomDetails, toast, createPeerConnection, isCurrentUserPremium, startSpeakingDetection, stopSpeakingDetection]);

  const handleLeaveVoiceChat = useCallback(async (isPageUnload = false) => {
    if (!currentUser || !roomId || !isCurrentUserInVoiceChatRef.current) {
      console.log("[WebRTC] handleLeaveVoiceChat called but conditions not met. CurrentUser:", !!currentUser, "RoomID:", roomId, "InVoiceChat:", isCurrentUserInVoiceChatRef.current);
      return Promise.resolve();
    }
    if (!isPageUnload) setIsProcessingVoiceJoinLeave(true);

    console.log("[WebRTC] Leaving voice chat...");
    stopSpeakingDetection();
    Object.keys(peerConnectionsRef.current).forEach(peerUid => {
      cleanupPeerConnection(peerUid);
    });
    peerConnectionsRef.current = {};
    setActiveRemoteStreams({});
    lastProcessedSignalTimestampRef.current = null;


    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[WebRTC] Stopping local track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      localStreamRef.current = null;
      console.log("[WebRTC] Local stream stopped and nulled.");
    } else {
        console.log("[WebRTC] localStreamRef was already null when trying to leave voice chat.");
    }

    setIsCurrentUserInVoiceChat(false);

    try {
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, currentUser.uid);
      const roomRef = doc(db, "chatRooms", roomId);

      const signalsCollectionRef = collection(db, `chatRooms/${roomId}/webrtcSignals/${currentUser.uid}/signals`);
      const signalsSnap = await getDocs(signalsCollectionRef);

      const batch = writeBatch(db);

      const voiceParticipantDocSnap = await getDoc(voiceParticipantRef);
      if (voiceParticipantDocSnap.exists()) {
        batch.delete(voiceParticipantRef);
        const roomDocSnap = await getDoc(roomRef);
        if (roomDocSnap.exists() && (roomDocSnap.data()?.voiceParticipantCount ?? 0) > 0) {
          batch.update(roomRef, { voiceParticipantCount: increment(-1) });
        } else if (roomDocSnap.exists() && (roomDocSnap.data()?.voiceParticipantCount ?? 0) === 0) {
           console.warn("[WebRTC] Room voiceParticipantCount was already 0 when trying to decrement.");
        }
      } else {
        console.warn("[WebRTC] Voice participant document to delete was not found for user:", currentUser.uid);
      }

      signalsSnap.forEach(signalDoc => batch.delete(signalDoc.ref));

      await batch.commit();
      if (!isPageUnload) toast({ title: "Sesli Sohbetten Ayrıldın" });
      console.log("[WebRTC] Successfully left voice chat (Firestore updated).");
    } catch (error) {
      console.error("[WebRTC] Error leaving voice chat (Firestore):", error);
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
      const voiceParticipantsQuery = query(collection(db, `chatRooms/${roomId}/voiceParticipants`), orderBy("joinedAt", "asc"));
      unsubscribeVoiceParticipants = onSnapshot(voiceParticipantsQuery, (snapshot) => {
          let newVoiceParticipantsData: ActiveVoiceParticipantData[] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ActiveVoiceParticipantData));

          const selfInFirestore = newVoiceParticipantsData.find(p => p.id === currentUser.uid);

          if (isCurrentUserInVoiceChatRef.current && selfInFirestore && selfInFirestore.isSpeaking !== localIsSpeakingRef.current && !selfMuted && !selfInFirestore.isMutedByAdmin) {
            console.log(`[WebRTC Voice Listener] Speaking status for local user (${currentUser.uid}) might differ. Firestore: ${selfInFirestore.isSpeaking}, Local Detection: ${localIsSpeakingRef.current}. SelfMuted: ${selfMuted}, AdminMuted: ${selfInFirestore.isMutedByAdmin}`);
          }

          if (isCurrentUserInVoiceChatRef.current) {
            newVoiceParticipantsData = newVoiceParticipantsData.map(p => {
              if (p.id === currentUser.uid) {
                return { ...p, isSpeaking: (selfInFirestore?.isMutedByAdmin || selfMuted) ? false : localIsSpeakingRef.current };
              }
              return p;
            });
          }

          setActiveVoiceParticipants(newVoiceParticipantsData);

          if (isCurrentUserInVoiceChatRef.current && !selfInFirestore && !isProcessingVoiceJoinLeave) {
              console.warn(`[WebRTC Voice Listener] Current user (${currentUser.uid}) thought they were in call, but not found in Firestore. Forcing local leave. isProcessingVoiceJoinLeave: ${isProcessingVoiceJoinLeave}. Active voice participants:`, newVoiceParticipantsData.map(p => p.id));
              handleLeaveVoiceChat(true);
              return;
          }
          
          // Handle admin mute propagation to local stream
          if (selfInFirestore && localStreamRef.current) {
            const isAdminMuted = selfInFirestore.isMutedByAdmin === true;
            localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !isAdminMuted && !selfMuted;
            });
            if (isAdminMuted && !selfMuted) {
                setSelfMuted(true); // Reflect admin mute locally if user hasn't self-muted
            }
          }


          if (isCurrentUserInVoiceChatRef.current && localStreamRef.current && localStreamRef.current.active) {
              newVoiceParticipantsData.forEach(p => {
                  if (p.id !== currentUser.uid && !peerConnectionsRef.current[p.id]) {
                      console.log(`[WebRTC Voice Listener] New participant ${p.displayName || p.id} detected. Creating connection.`);
                      createPeerConnection(p.id);
                  }
              });
              Object.keys(peerConnectionsRef.current).forEach(existingPeerId => {
                  if (!newVoiceParticipantsData.find(p => p.id === existingPeerId)) {
                      console.log(`[WebRTC Voice Listener] Participant ${existingPeerId} detected as left. Cleaning up connection.`);
                      cleanupPeerConnection(existingPeerId);
                  }
              });
          }
      }, (error) => {
        console.error("[WebRTC] Error fetching voice participants:", error);
        toast({ title: "Sesli Katılımcı Hatası", description: "Sesli sohbet katılımcıları alınırken hata.", variant: "destructive" });
      });
    };

    setupVoiceParticipantsListener();

    return () => {
      if (unsubscribeVoiceParticipants) {
        unsubscribeVoiceParticipants();
      }
    };
  }, [roomId, currentUser, toast, cleanupPeerConnection, createPeerConnection, handleLeaveVoiceChat, isProcessingVoiceJoinLeave, selfMuted]);

  useEffect(() => {
    const fetchGameAssets = async () => {
      setLoadingGameAssets(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          setGameSettings(settingsSnap.data() as GameSettings);
        } else {
          setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        }

        const questionsQuery = query(collection(db, "gameQuestions"), orderBy("createdAt", "desc"));
        const questionsSnap = await getDocs(questionsQuery);
        const fetchedQuestions: GameQuestion[] = [];
        questionsSnap.forEach((doc) => {
          fetchedQuestions.push({ id: doc.id, ...doc.data() } as GameQuestion);
        });
        setAvailableGameQuestions(fetchedQuestions);

      } catch (error) {
        console.error("[GameSystem] Error fetching game assets:", error);
        setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        setAvailableGameQuestions([]);
        toast({ title: "Oyun Hatası", description: "Oyun verileri yüklenemedi.", variant: "destructive" });
      } finally {
        setLoadingGameAssets(false);
      }
    };
    fetchGameAssets();
  }, [toast]);


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
        if (!nextQuestion) {
            console.warn("[GameSystem] No available question found to ask.");
            if (gameSettings?.questionIntervalSeconds) {
                 await updateDoc(roomDocRef, {
                    nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds))
                });
            }
            return;
        }

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
    if (gameSettings?.isGameEnabled && isCurrentUserParticipantRef.current && roomDetails && !loadingGameAssets) {
      gameQuestionIntervalTimerRef.current = setInterval(() => {
        if (roomDetails.nextGameQuestionTimestamp && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline) {
          attemptToAskNewQuestion();
        }
      }, 5000);
    }
    return () => { if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current); };
  }, [gameSettings, roomDetails, attemptToAskNewQuestion, loadingGameAssets, isCurrentUserParticipantRef]);


  useEffect(() => { if (isCurrentUserParticipantRef.current && gameSettings?.isGameEnabled && roomDetails?.nextGameQuestionTimestamp && !roomDetails.currentGameQuestionId && !roomDetails.currentGameAnswerDeadline && availableGameQuestions.length > 0 && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !loadingGameAssets) { attemptToAskNewQuestion(); } }, [gameSettings, roomDetails, availableGameQuestions, attemptToAskNewQuestion, loadingGameAssets, isCurrentUserParticipantRef]);

  useEffect(() => {
    if (roomDetails?.currentGameQuestionId && availableGameQuestions.length > 0) {
      const question = availableGameQuestions.find(q => q.id === roomDetails.currentGameQuestionId);
      setActiveGameQuestion(question || null); setShowGameQuestionCard(!!question);
    } else {
      setActiveGameQuestion(null); setShowGameQuestionCard(false);
    }
  }, [roomDetails?.currentGameQuestionId, availableGameQuestions]);

  const handleCloseGameQuestionCard = useCallback(() => setShowGameQuestionCard(false), []);
  const getAvatarFallbackText = useCallback((name?: string | null) => name ? name.substring(0, 2).toUpperCase() : "PN", []);

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

      const batch = writeBatch(db);
      batch.set(participantRef, {
          joinedAt: serverTimestamp(),
          displayName: userData.displayName || currentUser.displayName || "Bilinmeyen",
          photoURL: userData.photoURL || currentUser.photoURL || null,
          uid: currentUser.uid,
          isTyping: false,
          isPremium: userIsCurrentlyPremium,
       });
      batch.update(roomRef, { participantCount: increment(1) });

      if (gameSettings?.isGameEnabled && !currentRoomData.gameInitialized && !currentRoomData.nextGameQuestionTimestamp && !currentRoomData.currentGameQuestionId && !currentRoomData.currentGameAnswerDeadline) {
        batch.update(roomRef, {
            gameInitialized: true,
            nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)),
            currentGameQuestionId: null,
            currentGameAnswerDeadline: null
        });
      }

      await batch.commit();
      setIsCurrentUserParticipant(true);
      toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });
      const userDisplayNameForJoin = userData.displayName || currentUser.displayName || "Bir kullanıcı";
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: `[SİSTEM] ${userDisplayNameForJoin} odaya katıldı.`, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true });

      if (gameSettings?.isGameEnabled) {
        let gameInfoMessage = `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `;
        const updatedRoomSnap = await getDoc(roomRef); const updatedRoomData = updatedRoomSnap.data() as ChatRoomDetails;
        if (updatedRoomData?.currentGameQuestionId && availableGameQuestions.length > 0) {
            const currentQ = availableGameQuestions.find(q => q.id === updatedRoomData.currentGameQuestionId);
            if (currentQ) gameInfoMessage += `Aktif bir soru var: "${currentQ.text}". Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`;
            if (updatedRoomData.currentGameAnswerDeadline) gameInfoMessage += ` (Kalan Süre: ${formatCountdown(Math.max(0, Math.floor((updatedRoomData.currentGameAnswerDeadline.toDate().getTime() - new Date().getTime())/1000)))})`
        }
        else if (updatedRoomData?.nextGameQuestionTimestamp) { const now = new Date(); const nextTime = updatedRoomData.nextGameQuestionTimestamp.toDate(); const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000)); gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(diffSeconds)} sonra gelecek.`; }
        else if (typeof gameSettings.questionIntervalSeconds === 'number') { gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(gameSettings.questionIntervalSeconds)} sonra gelecek.`; }
        if (gameInfoMessage !== `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `) { await addDoc(collection(db, `chatRooms/${roomId}/messages`), { text: gameInfoMessage, senderId: "system", senderName: "Sistem", senderAvatar: null, timestamp: serverTimestamp(), isGameMessage: true }); }
      }
    } catch (error) { console.error("Error joining room:", error); toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setIsProcessingJoinLeave(false); }
  }, [currentUser, userData, roomId, roomDetails, toast, router, gameSettings, loadingGameAssets, availableGameQuestions, isCurrentUserPremium]);

  const formatCountdown = useCallback((seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    const minutes = Math.floor(seconds / 60); const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },[]);

  useEffect(() => {
    if (!roomId) return; setLoadingRoom(true);
    const roomDocRef = doc(db, "chatRooms", roomId);
    const unsubscribeRoom = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fetchedRoomDetails: ChatRoomDetails = {
            id: docSnap.id,
            name: data.name,
            description: data.description,
            creatorId: data.creatorId,
            creatorIsPremium: data.creatorIsPremium || false,
            isPremiumRoom: data.isPremiumRoom || false,
            participantCount: data.participantCount || 0,
            maxParticipants: data.maxParticipants || (PREMIUM_USER_ROOM_CAPACITY),
            expiresAt: data.expiresAt,
            currentGameQuestionId: data.currentGameQuestionId,
            nextGameQuestionTimestamp: data.nextGameQuestionTimestamp,
            gameInitialized: data.gameInitialized,
            voiceParticipantCount: data.voiceParticipantCount || 0,
            currentGameAnswerDeadline: data.currentGameAnswerDeadline
        };
        setRoomDetails(fetchedRoomDetails); document.title = `${fetchedRoomDetails.name} - HiweWalk`;
      } else { toast({ title: "Hata", description: "Sohbet odası bulunamadı.", variant: "destructive" }); router.push("/chat"); }
      setLoadingRoom(false);
    }, (error) => { console.error("Error fetching room details:", error); toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" }); setLoadingRoom(false); });
    return () => unsubscribeRoom();
  }, [roomId, toast, router]);

  useEffect(() => {
    if (!roomId || !currentUser || !userData || !roomDetails || loadingGameAssets) return;
    if (!isCurrentUserParticipantRef.current && !isProcessingJoinLeave && !isRoomFullError) { handleJoinRoom(); }
    const participantsQuery = query(collection(db, `chatRooms/${roomId}/participants`), orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (snapshot) => {
      const fetchedParticipants: ActiveTextParticipant[] = []; let currentUserIsFoundInSnapshot = false;
      snapshot.forEach((doc) => { const participantData = doc.data(); fetchedParticipants.push({ id: doc.id, displayName: participantData.displayName, photoURL: participantData.photoURL, isPremium: participantData.isPremium || false, joinedAt: participantData.joinedAt, isTyping: participantData.isTyping } as ActiveTextParticipant); if (doc.id === currentUser.uid) currentUserIsFoundInSnapshot = true; });
      setActiveTextParticipants(fetchedParticipants);
      if (isCurrentUserParticipantRef.current !== currentUserIsFoundInSnapshot) { if (isCurrentUserParticipantRef.current && !currentUserIsFoundInSnapshot && !isProcessingJoinLeave) { toast({ title: "Bilgi", description: "Odadan çıkarıldınız veya bağlantınız kesildi.", variant: "default" }); } setIsCurrentUserParticipant(currentUserIsFoundInSnapshot); }
    });
    return () => unsubscribeParticipants();
  }, [roomId, currentUser, userData, roomDetails, handleJoinRoom, isProcessingJoinLeave, isRoomFullError, toast, loadingGameAssets]);

  useEffect(() => {
    if (!roomId) return; setLoadingMessages(true);
    const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => { const data = doc.data(); fetchedMessages.push({ id: doc.id, text: data.text, senderId: data.senderId, senderName: data.senderName, senderAvatar: data.senderAvatar, senderIsPremium: data.senderIsPremium || false, timestamp: data.timestamp, isGameMessage: data.isGameMessage || false, mentionedUserIds: data.mentionedUserIds || [] }); });
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
      handleLeaveRoom(true);
      if (isCurrentUserInVoiceChatRef.current) handleLeaveVoiceChat(true);
      if (currentTypingTimeout) clearTimeout(currentTypingTimeout);
      if (currentGameQuestionIntervalTimer) clearInterval(currentGameQuestionIntervalTimer);
      if (currentCountdownDisplayTimer) clearInterval(currentCountdownDisplayTimer);
      if (currentGameAnswerDeadlineTimer) clearInterval(currentGameAnswerDeadlineTimer);
    };
  }, [handleLeaveRoom, handleLeaveVoiceChat]);

  const scrollToBottom = useCallback(() => { if (scrollAreaRef.current) { const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]'); if (viewport) viewport.scrollTop = viewport.scrollHeight; } }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  const isRoomExpired = roomDetails?.expiresAt ? isPast(roomDetails.expiresAt.toDate()) : false;
  const canSendMessage = !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current;

  const handleNewMessageInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value; setNewMessage(currentMessage);
    if (!isCurrentUserParticipantRef.current || !canSendMessage) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else if (currentMessage.trim() !== "") updateUserTypingStatus(true);
    if (currentMessage.trim() === "") { updateUserTypingStatus(false); if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; } }
    else { typingTimeoutRef.current = setTimeout(() => { updateUserTypingStatus(false); typingTimeoutRef.current = null; }, TYPING_DEBOUNCE_DELAY); }
  }, [canSendMessage, updateUserTypingStatus]);

  const handleSendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (isSending || isUserLoading || !currentUser || !newMessage.trim() || !roomId || !canSendMessage || !userData || loadingGameAssets) return;

    const now = Date.now();
    lastMessageTimesRef.current = lastMessageTimesRef.current.filter(time => now - time < MESSAGE_WINDOW_SECONDS * 1000);
    if (lastMessageTimesRef.current.length >= MAX_MESSAGES_PER_WINDOW) {
      toast({ title: "Spam Uyarısı", description: `Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz yavaşlayın.`, variant: "destructive" });
      return;
    }

    setIsSending(true); const tempMessage = newMessage.trim();
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    updateUserTypingStatus(false); const roomDocRef = doc(db, "chatRooms", roomId);
    const userIsCurrentlyPremium = isCurrentUserPremium();

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
            senderIsPremium: userIsCurrentlyPremium,
            timestamp: serverTimestamp(),
            isGameMessage: false,
            mentionedUserIds: mentionedUserIds,
        });
        setNewMessage("");
        lastMessageTimesRef.current.push(now);
    } catch (error) { console.error("Error sending message:", error); toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" }); }
    finally { setIsSending(false); }
  },[isSending, isUserLoading, currentUser, newMessage, roomId, canSendMessage, userData, loadingGameAssets, activeGameQuestion, gameSettings, roomDetails, toast, updateUserDiamonds, activeTextParticipants, updateUserTypingStatus, isCurrentUserPremium]);

  const handleDeleteRoom = useCallback(async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) { toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" }); return; }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz, tüm mesajlar ve katılımcı bilgileri silinecektir.`)) return;
    try { await deleteChatRoomAndSubcollections(roomId); toast({ title: "Başarılı", description: `"${roomDetails.name}" odası silindi.` }); router.push("/chat"); } catch (error) { console.error("Error deleting room: ", error); toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" }); }
  },[roomDetails, currentUser, roomId, router, toast]);

  const handleExtendDuration = useCallback(async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid || !roomDetails.expiresAt) { toast({ title: "Hata", description: "Süre uzatma işlemi yapılamadı.", variant: "destructive" }); return; }
    if ((userData.diamonds ?? 0) < ROOM_EXTENSION_COST) { toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds ?? 0}`, variant: "destructive" }); return; }
    setIsExtending(true);
    try { const currentExpiresAt = roomDetails.expiresAt.toDate(); const newExpiresAtDate = addMinutes(currentExpiresAt, ROOM_EXTENSION_DURATION_MINUTES); const roomDocRef = doc(db, "chatRooms", roomId); await updateDoc(roomDocRef, { expiresAt: Timestamp.fromDate(newExpiresAtDate) }); await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_EXTENSION_COST); toast({ title: "Başarılı", description: `Oda süresi ${ROOM_EXTENSION_DURATION_MINUTES} dakika uzatıldı. ${ROOM_EXTENSION_COST} elmas harcandı.` }); } catch (error) { console.error("Error extending room duration:", error); toast({ title: "Hata", description: "Süre uzatılırken bir sorun oluştu.", variant: "destructive" }); } finally { setIsExtending(false); }
  },[roomDetails, currentUser, userData, roomId, toast, updateUserDiamonds]);

  const handleIncreaseCapacity = useCallback(async () => {
    if (!roomDetails || !currentUser || !userData || roomDetails.creatorId !== currentUser.uid) {
      toast({ title: "Hata", description: "Kapasite artırma işlemi yapılamadı.", variant: "destructive" });
      return;
    }
    if ((userData.diamonds ?? 0) < CAPACITY_INCREASE_COST) {
      toast({ title: "Yetersiz Elmas", description: `Kapasite artırmak için ${CAPACITY_INCREASE_COST} elmasa ihtiyacınız var.`, variant: "destructive" });
      return;
    }
    if (roomDetails.maxParticipants >= PREMIUM_USER_ROOM_CAPACITY) {
      toast({ title: "Limit Dolu", description: "Oda zaten maksimum premium kapasitesine ulaşmış.", variant: "default" });
      return;
    }
    setIsIncreasingCapacity(true);
    try {
      const roomDocRef = doc(db, "chatRooms", roomId);
      await updateDoc(roomDocRef, { maxParticipants: increment(CAPACITY_INCREASE_SLOTS) });
      await updateUserDiamonds((userData.diamonds ?? 0) - CAPACITY_INCREASE_COST);
      toast({ title: "Başarılı", description: `Oda kapasitesi ${CAPACITY_INCREASE_SLOTS} artırıldı. ${CAPACITY_INCREASE_COST} elmas harcandı.` });
    } catch (error) {
      console.error("Error increasing room capacity:", error);
      toast({ title: "Hata", description: "Kapasite artırılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsIncreasingCapacity(false);
    }
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
      const userDocRef = doc(db, "users", senderId); const userDocSnap = await getDoc(userDocRef); if (!userDocSnap.exists()) { toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" }); setPopoverOpenForUserId(null); return; }
      const targetUser = { uid: userDocSnap.id, ...userDocSnap.data() } as UserData;
      targetUser.isPremium = checkUserPremium(targetUser);
      setPopoverTargetUser(targetUser);
      const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, senderId); const friendDocSnap = await getDoc(friendDocRef); if (friendDocSnap.exists()) { setFriendshipStatus("friends"); setPopoverLoading(false); return; }
      const outgoingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", senderId), where("status", "==", "pending")); const outgoingReqSnap = await getDocs(outgoingReqQuery); if (!outgoingReqSnap.empty) { setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: outgoingReqSnap.docs[0].id, ...outgoingReqSnap.docs[0].data() } as FriendRequest); setPopoverLoading(false); return; }
      const incomingReqQuery = query(collection(db, "friendRequests"), where("fromUserId", "==", senderId), where("toUserId", "==", currentUser.uid), where("status", "==", "pending")); const incomingReqSnap = await getDocs(incomingReqQuery); if (!incomingReqSnap.empty) { setFriendshipStatus("request_received"); setRelevantFriendRequest({ id: incomingReqSnap.docs[0].id, ...incomingReqSnap.docs[0].data() } as FriendRequest); setPopoverLoading(false); return; }
      setFriendshipStatus("none");
    } catch (error) { console.error("Error fetching user info for popover:", error); toast({ title: "Hata", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, toast]);

  const handleSendFriendRequestPopover = useCallback(async () => {
    if (!currentUser || !userData || !popoverTargetUser) return; setPopoverLoading(true);
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    try { const newRequestRef = await addDoc(collection(db, "friendRequests"), { fromUserId: currentUser.uid, fromUsername: userData.displayName, fromAvatarUrl: userData.photoURL, fromUserIsPremium: currentUserIsCurrentlyPremium, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName, toAvatarUrl: popoverTargetUser.photoURL, status: "pending", createdAt: serverTimestamp() }); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` }); setFriendshipStatus("request_sent"); setRelevantFriendRequest({ id: newRequestRef.id, fromUserId: currentUser.uid, fromUsername: userData.displayName || "", fromAvatarUrl: userData.photoURL || null, fromUserIsPremium: currentUserIsCurrentlyPremium, toUserId: popoverTargetUser.uid, toUsername: popoverTargetUser.displayName || "", toAvatarUrl: popoverTargetUser.photoURL || null, status: "pending", createdAt: Timestamp.now() }); }
    catch (error) { console.error("Error sending friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" }); }
    finally { setPopoverLoading(false); }
  }, [currentUser, userData, popoverTargetUser, toast, isCurrentUserPremium]);

  const handleAcceptFriendRequestPopover = useCallback(async () => {
    if (!currentUser || !userData || !relevantFriendRequest || !popoverTargetUser) return; setPopoverLoading(true);
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    const targetUserIsCurrentlyPremium = popoverTargetUser.isPremium || false;
    try { const batch = writeBatch(db); const requestRef = doc(db, "friendRequests", relevantFriendRequest.id); batch.update(requestRef, { status: "accepted" }); const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, popoverTargetUser.uid); batch.set(myFriendRef, { displayName: popoverTargetUser.displayName, photoURL: popoverTargetUser.photoURL, isPremium: targetUserIsCurrentlyPremium, addedAt: serverTimestamp() }); const theirFriendRef = doc(db, `users/${popoverTargetUser.uid}/confirmedFriends`, currentUser.uid); batch.set(theirFriendRef, { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: currentUserIsCurrentlyPremium, addedAt: serverTimestamp() }); await batch.commit(); toast({ title: "Başarılı", description: `${popoverTargetUser.displayName} ile arkadaş oldunuz.` }); setFriendshipStatus("friends"); setRelevantFriendRequest(null); }
    catch (error) { console.error("Error accepting friend request from popover:", error); toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" }); }
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
        await updateDoc(voiceParticipantRef, { isMuted: newMuteState }); // isMutedByAdmin'i burada değiştirmiyoruz
        setSelfMuted(newMuteState);
        // Konuşma durumu da mute durumuna göre güncellenmeli
        if (newMuteState) {
            updateSpeakingStatusInFirestore(false); // Mute ise konuşmuyor
            setLocalIsSpeaking(false);
        }
    } catch (error) {
        console.error("Error toggling self mute:", error);
        toast({ title: "Hata", description: "Mikrofon durumu güncellenirken bir sorun oluştu.", variant: "destructive" });
        localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = selfMuted; }); // Hata durumunda eski duruma dön
    }
  }, [currentUser, roomId, selfMuted, toast, updateSpeakingStatusInFirestore]);

  const handleAdminToggleMuteUserVoice = useCallback(async (targetUserId: string, currentAdminMuteState?: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserRoomCreator || targetUserId === currentUser.uid) return;
    
    const newAdminMuteState = !currentAdminMuteState;
    try {
      const voiceParticipantRef = doc(db, `chatRooms/${roomId}/voiceParticipants`, targetUserId);
      await updateDoc(voiceParticipantRef, {
        isMutedByAdmin: newAdminMuteState,
        isMuted: newAdminMuteState, // Admin mute ettiğinde, kullanıcının self-mute'u da aktif olmalı
      });
      toast({
        title: "Başarılı",
        description: `Kullanıcının mikrofonu ${newAdminMuteState ? "kapatıldı (yönetici tarafından)" : "açılmasına izin verildi"}.`
      });
    } catch (error) {
      console.error("Error toggling user mute by admin:", error);
      toast({ title: "Hata", description: "Kullanıcının mikrofon durumu yönetici tarafından güncellenirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [currentUser, roomId, isCurrentUserRoomCreator, toast]);


  const handleKickParticipantFromTextChat = useCallback(async (targetUserId: string, targetUsername?: string) => {
    if (!isCurrentUserRoomCreator || !currentUser || targetUserId === currentUser?.uid) {
      toast({ title: "Yetki Hatası", description: "Bu kullanıcıyı odadan atma yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (!confirm(`${targetUsername || 'Bu kullanıcıyı'} metin sohbetinden atmak istediğinizden emin misiniz? Bu işlem kullanıcıyı sesli sohbetten de çıkaracaktır (eğer katılıyorsa).`)) return;

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
        cleanupPeerConnection(targetUserId); // Önce peer bağlantısını temizle
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
  }, [isCurrentUserRoomCreator, currentUser, roomId, cleanupPeerConnection, toast]);


  if (loadingRoom || !roomDetails || (isProcessingJoinLeave && !isRoomFullError && !isCurrentUserParticipantRef.current) || loadingGameAssets) {
    return (<div className="flex flex-1 items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2 text-lg">Oda yükleniyor...</p></div>);
  }

  return (
    <div className="flex flex-col h-screen bg-card rounded-xl shadow-lg overflow-hidden relative">
      {Object.entries(activeRemoteStreams).map(([uid, stream]) => {
        console.log(`[WebRTC RENDER] Rendering audio element for ${uid}`, stream, stream?.id, stream?.active, stream?.getAudioTracks().map(t => ({id:t.id, enabled: t.enabled, muted: t.muted, readyState: t.readyState})));
        return (
          <audio
            key={uid}
            autoPlay
            playsInline
            controls={process.env.NODE_ENV === 'development'}
            ref={audioEl => {
              if (audioEl) {
                if (audioEl.srcObject !== stream) {
                    console.log(`[WebRTC RENDER REF] Setting srcObject for ${uid}. New stream ID: ${stream?.id}, Old srcObject ID: ${audioEl.srcObject?.id}`);
                    audioEl.srcObject = stream;
                }
                if (stream && audioEl.srcObject === stream && audioEl.paused && audioEl.readyState >= 2) { // Check readyState
                     audioEl.play().catch(error => {
                        if (error.name !== 'AbortError') { // AbortError can happen if srcObject is changed while playing
                             console.warn(`[WebRTC RENDER REF] Error explicitly playing audio for ${uid}:`, error);
                        }
                     });
                }
              }
            }}
          />
        )
      })}

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
              <h2 className="text-base sm:text-lg font-semibold text-foreground truncate" title={roomDetails.name}>{roomDetails.name}</h2>
              {isCurrentUserRoomCreator && <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" title="Oda Sahibi" />}
              {roomDetails.creatorIsPremium && <Star className="h-4 w-4 text-yellow-400 flex-shrink-0" title="Premium Oda Sahibi" />}
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
                    <div onClick={() => participant.id !== currentUser?.uid && handleOpenUserInfoPopover(participant.id)} className="flex-shrink-0 cursor-pointer relative">
                        <Avatar className="h-7 w-7">
                            <AvatarImage src={participant.photoURL || "https://placehold.co/40x40.png"} data-ai-hint="active user avatar" />
                            <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
                        </Avatar>
                        {participant.isPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
                    </div>
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
          {currentUser && roomDetails.creatorId === currentUser.uid && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9">
                  <MoreVertical className="h-5 w-5" /><span className="sr-only">Oda Seçenekleri</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isRoomExpired && roomDetails.expiresAt && (
                  <DropdownMenuItem onClick={handleExtendDuration} disabled={isExtending || isUserLoading || isIncreasingCapacity}>
                    {isExtending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Süre Uzat
                  </DropdownMenuItem>
                )}
                {!userIsCurrentlyPremium && roomDetails.maxParticipants < PREMIUM_USER_ROOM_CAPACITY && (
                   <DropdownMenuItem onClick={handleIncreaseCapacity} disabled={isIncreasingCapacity || isUserLoading || isExtending}>
                    {isIncreasingCapacity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Katılımcı Artır
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDeleteRoom} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" /> Odayı Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <div className="p-3 border-b bg-background/70 backdrop-blur-sm"> <div className="flex items-center justify-between mb-2"> <h3 className="text-sm font-medium text-primary">Sesli Sohbet ({activeVoiceParticipants.length}/{roomDetails.maxParticipants})</h3> {isCurrentUserInVoiceChat ? (<div className="flex items-center gap-2"> <Button variant={selfMuted ? "destructive" : "outline"} size="sm" onClick={toggleSelfMute} className="h-8 px-2.5" disabled={isProcessingVoiceJoinLeave} title={selfMuted ? "Mikrofonu Aç" : "Mikrofonu Kapat"}>{selfMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button> <Button variant="outline" size="sm" onClick={() => handleLeaveVoiceChat(false)} disabled={isProcessingVoiceJoinLeave} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Ayrıl</Button> </div>) : (<Button variant="default" size="sm" onClick={handleJoinVoiceChat} disabled={isProcessingVoiceJoinLeave || (roomDetails.voiceParticipantCount ?? 0) >= roomDetails.maxParticipants} className="h-8 px-2.5">{isProcessingVoiceJoinLeave && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}<Mic className="mr-1.5 h-4 w-4" /> Katıl</Button>)} </div> <VoiceParticipantGrid participants={activeVoiceParticipants} currentUserUid={currentUser?.uid} isCurrentUserRoomCreator={isCurrentUserRoomCreator} roomCreatorId={roomDetails?.creatorId} maxSlots={roomDetails.maxParticipants} onAdminKickUser={() => { /* Kicking from voice is removed */ }} onAdminToggleMuteUser={handleAdminToggleMuteUserVoice} getAvatarFallbackText={getAvatarFallbackText} onSlotClick={handleVoiceParticipantSlotClick} /> </div>
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}> {loadingMessages && (<div className="flex flex-1 items-center justify-center py-10"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p> </div>)} {!loadingMessages && messages.length === 0 && !isRoomExpired && !isRoomFullError && isCurrentUserParticipantRef.current && (<div className="text-center text-muted-foreground py-10 px-4"> <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Henüz hiç mesaj yok.</p> <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p> </div>)} {!isCurrentUserParticipantRef.current && !isRoomFullError && !loadingRoom && !isProcessingJoinLeave && (<div className="text-center text-muted-foreground py-10 px-4"> <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" /> <p className="text-lg font-medium">Odaya katılmadınız.</p> <p className="text-sm">Mesajları görmek ve göndermek için odaya otomatik olarak katılıyorsunuz. Lütfen bekleyin veya bir sorun varsa sayfayı yenileyin.</p> </div>)} {isRoomFullError && (<div className="text-center text-destructive py-10 px-4"> <ShieldAlert className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odası dolu!</p> <p>Maksimum katılımcı sayısına ulaşıldığı için mesaj gönderemezsiniz.</p> </div>)} {isRoomExpired && !isRoomFullError && (<div className="text-center text-destructive py-10"> <Clock className="mx-auto h-16 w-16 text-destructive/80 mb-3" /> <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p> <p>Yeni mesaj gönderilemez.</p> </div>)}
          {messages.map((msg) => (<ChatMessageItem key={msg.id} msg={msg} currentUserUid={currentUser?.uid} popoverOpenForUserId={popoverOpenForUserId} onOpenUserInfoPopover={handleOpenUserInfoPopover} setPopoverOpenForUserId={setPopoverOpenForUserId} popoverLoading={popoverLoading} popoverTargetUser={popoverTargetUser} friendshipStatus={friendshipStatus} relevantFriendRequest={relevantFriendRequest} onAcceptFriendRequestPopover={handleAcceptFriendRequestPopover} onSendFriendRequestPopover={handleSendFriendRequestPopover} onDmAction={handleDmAction} onViewProfileAction={handleViewProfileAction} getAvatarFallbackText={getAvatarFallbackText} currentUserPhotoURL={userData?.photoURL || currentUser?.photoURL || undefined} currentUserDisplayName={userData?.displayName || currentUser?.displayName || undefined} currentUserIsPremium={userIsCurrentlyPremium} isCurrentUserRoomCreator={isCurrentUserRoomCreator} onKickParticipantFromTextChat={handleKickParticipantFromTextChat} />))}
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

