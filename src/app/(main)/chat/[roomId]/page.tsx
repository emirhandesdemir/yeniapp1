
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X, Puzzle, Lightbulb } from "lucide-react";
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
} from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, formatDistanceToNow, isPast, addSeconds } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import GameQuestionCard from "@/components/game/GameQuestionCard";
import { generateDmChatId } from "@/lib/utils";

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
  // Oyun Sistemi v1 Alanları
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

interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

interface GameQuestion {
  id: string;
  text: string;
  answer: string;
  hint: string; // İpucu alanı eklendi
  // reward alanı kaldırıldı, sabit 1 elmas olacak
}

const FIXED_GAME_REWARD = 1; // Sabit ödül miktarı
const HINT_COST = 1; // İpucu maliyeti

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
          console.warn("[GameSystem] Game config not found, defaulting to disabled.");
          setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        }
      } catch (error) {
        console.error("[GameSystem] Error fetching game settings:", error);
        setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        toast({ title: "Oyun Hatası", description: "Oyun ayarları yüklenirken bir sorun oluştu.", variant: "destructive" });
      }
    };
    fetchGameSettings();
  }, [toast]);

  const formatCountdown = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  // Firestore'dan gelen nextGameQuestionTimestamp'e göre geri sayımı güncelleyen useEffect
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

          if (diffSeconds <= 0 && isCurrentUserParticipant && gameSettings?.isGameEnabled && !roomDetails.currentGameQuestionId) {
             // Süre doldu, potansiyel olarak yeni soru tetiklenecek (aşağıdaki interval timer tarafından)
          }
        } else {
          setNextQuestionCountdown(null);
        }
      };
      updateCountdown(); // Hemen güncelle
      countdownDisplayTimerRef.current = setInterval(updateCountdown, 1000);
    } else if (roomDetails?.currentGameQuestionId) {
        setNextQuestionCountdown(null); // Aktif soru varsa geri sayımı durdur/gizle
    } else {
        setNextQuestionCountdown(null);
    }
    return () => {
      if (countdownDisplayTimerRef.current) clearInterval(countdownDisplayTimerRef.current);
    };
  }, [roomDetails?.nextGameQuestionTimestamp, roomDetails?.currentGameQuestionId, isCurrentUserParticipant, gameSettings?.isGameEnabled]);


  // Yeni soru sorma ve Firestore'u güncelleme zamanlayıcısı
  useEffect(() => {
    if (gameQuestionIntervalTimerRef.current) {
      clearInterval(gameQuestionIntervalTimerRef.current);
    }

    const attemptToAskNewQuestion = async () => {
      if (
        !isCurrentUserParticipant ||
        !gameSettings?.isGameEnabled ||
        !roomId ||
        !roomDetails || // roomDetails yüklendi mi?
        roomDetails.currentGameQuestionId || // Zaten aktif bir soru var mı?
        availableGameQuestions.length === 0 // Sorulacak soru kalmadı mı?
      ) {
        return;
      }

      // Sadece bir client'in (örneğin oda yaratıcısı veya rastgele bir aktif katılımcı)
      // yeni soruyu tetiklemesini sağlamak için bir mekanizma gerekebilir.
      // Şimdilik, her client dener, ilk Firestore'a yazan kazanır.
      // Veya sadece oda yaratıcısı ise tetikle: if (currentUser?.uid !== roomDetails.creatorId) return;

      try {
        const roomDocRef = doc(db, "chatRooms", roomId);
        // Firestore'dan en son durumu tekrar oku, başka bir client zaten soru sormuş olabilir
        const currentRoomSnap = await getDoc(roomDocRef);
        if (!currentRoomSnap.exists()) return;
        const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;

        if (currentRoomData.currentGameQuestionId) {
          // Başka bir client zaten soru sormuş
          return;
        }
        
        const randomIndex = Math.floor(Math.random() * availableGameQuestions.length);
        const nextQuestion = availableGameQuestions[randomIndex];
        const newNextGameQuestionTimestamp = Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds));

        const batch = writeBatch(db);
        batch.update(roomDocRef, {
          currentGameQuestionId: nextQuestion.id,
          nextGameQuestionTimestamp: newNextGameQuestionTimestamp,
        });
        
        batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
            text: `[OYUN] Yeni bir soru geldi! "${nextQuestion.text}" (Ödül: ${FIXED_GAME_REWARD} Elmas). Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`,
            senderId: "system",
            senderName: "Oyun Sistemi",
            senderAvatar: null,
            timestamp: serverTimestamp(),
            isGameMessage: true,
        });

        await batch.commit();
        // setActiveGameQuestion ve setShowGameQuestionCard artık roomDetails dinleyicisi tarafından yönetilecek.
        // setAvailableGameQuestions güncellenmesi doğru cevapta yapılmalı.
      } catch (error) {
        console.error("[GameSystem] Error attempting to ask new question:", error);
      }
    };
    
    // Bu interval, nextGameQuestionTimestamp'e ulaşıldığında yeni soru sormayı dener.
    // Sürekli çalışmak yerine, sadece nextGameQuestionTimestamp geldiğinde tetiklenmeli.
    // Bu yüzden bu intervali kaldırıp, yukarıdaki countdownDisplayTimer'daki kontrolü güçlendireceğiz.
    // Şimdilik, bir sonraki soru timestamp'i geldiğinde bu fonksiyonu çağıran bir mantık lazım.
    // Bu useEffect'in bağımlılıkları, client'in aktif olup olmadığına ve oyunun etkin olup olmadığına bağlı.
    // Asıl tetikleyici, roomDetails.nextGameQuestionTimestamp'in zamanının gelmesi olmalı.

    if (gameSettings?.isGameEnabled && isCurrentUserParticipant) {
        // Bu timer, periyodik olarak yeni soru sorma DENEMESİ yapar.
        // Asıl senkronizasyon Firestore'daki timestamp ile olacak.
        gameQuestionIntervalTimerRef.current = setInterval(() => {
            if (roomDetails?.nextGameQuestionTimestamp && isPast(roomDetails.nextGameQuestionTimestamp.toDate()) && !roomDetails.currentGameQuestionId) {
                attemptToAskNewQuestion();
            }
        }, 5000); // Her 5 saniyede bir kontrol et (çok sık olmamalı)
    }


    return () => {
      if (gameQuestionIntervalTimerRef.current) clearInterval(gameQuestionIntervalTimerRef.current);
    };
  }, [gameSettings, isCurrentUserParticipant, roomId, roomDetails, availableGameQuestions, currentUser?.uid]);

  // roomDetails.currentGameQuestionId değiştiğinde aktif soruyu ve kartı güncelle
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


  const handleCloseGameQuestionCard = () => {
    setShowGameQuestionCard(false); // Sadece kartı gizle, soruyu null yapma
  };


  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const updateUserTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!currentUser || !roomId || !isCurrentUserParticipant) return;
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    try {
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) {
        await updateDoc(participantRef, { isTyping });
      }
    } catch (error) {
      // console.warn("Could not update typing status:", error);
    }
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
        if (participantSnap.data()?.isTyping) {
          await updateDoc(participantRef, { isTyping: false });
        }
        setIsProcessingJoinLeave(false);
        return;
      }
      const currentRoomSnap = await getDoc(roomRef);
      if (!currentRoomSnap.exists()) {
          toast({ title: "Hata", description: "Oda bulunamadı.", variant: "destructive" });
          router.push("/chat");
          return;
      }
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;
      if ((currentRoomData.participantCount ?? 0) >= currentRoomData.maxParticipants) {
        setIsRoomFullError(true);
        toast({ title: "Oda Dolu", description: "Bu oda maksimum katılımcı sayısına ulaşmış.", variant: "destructive" });
        setIsProcessingJoinLeave(false);
        return;
      }

      const batch = writeBatch(db);
      batch.set(participantRef, {
        joinedAt: serverTimestamp(),
        displayName: userData.displayName || currentUser.displayName || "Bilinmeyen",
        photoURL: userData.photoURL || currentUser.photoURL || null,
        uid: currentUser.uid,
        isTyping: false,
      });
      batch.update(roomRef, { participantCount: increment(1) });

      // Oyun başlatma mantığı (sadece bir kez ve oda yaratıcısı tarafından yapılabilir veya ilk giren tarafından)
      if (gameSettings?.isGameEnabled && !currentRoomData.gameInitialized && !currentRoomData.nextGameQuestionTimestamp && !currentRoomData.currentGameQuestionId) {
          batch.update(roomRef, {
              gameInitialized: true,
              nextGameQuestionTimestamp: Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds)),
              currentGameQuestionId: null,
          });
      }

      await batch.commit();
      setIsCurrentUserParticipant(true);
      toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });

      const userDisplayNameForJoin = userData.displayName || currentUser.displayName || "Bir kullanıcı";
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: `[SİSTEM] ${userDisplayNameForJoin} odaya katıldı.`,
        senderId: "system",
        senderName: "Sistem",
        senderAvatar: null,
        timestamp: serverTimestamp(),
        isGameMessage: true,
      });
      
      if (gameSettings?.isGameEnabled) {
        let gameInfoMessage = `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `;
        // roomDetails Firestore'dan güncellendikten sonra currentRoomData'yı kullanmak daha doğru olabilir
        const updatedRoomSnap = await getDoc(roomRef); // Firestore'dan son durumu al
        const updatedRoomData = updatedRoomSnap.data() as ChatRoomDetails;

        if (updatedRoomData?.currentGameQuestionId) {
            const currentQ = HARDCODED_QUESTIONS.find(q => q.id === updatedRoomData.currentGameQuestionId);
            if(currentQ) gameInfoMessage += `Aktif bir soru var: "${currentQ.text}". Cevaplamak için /answer <cevabınız>, ipucu için /hint yazın.`;
        } else if (updatedRoomData?.nextGameQuestionTimestamp) {
            const now = new Date();
            const nextTime = updatedRoomData.nextGameQuestionTimestamp.toDate();
            const diffSeconds = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000));
            gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(diffSeconds)} sonra gelecek.`;
        } else if (typeof gameSettings.questionIntervalSeconds === 'number') {
            gameInfoMessage += `Bir sonraki oyun sorusu yaklaşık ${formatCountdown(gameSettings.questionIntervalSeconds)} sonra gelecek.`;
        }

        if (gameInfoMessage !== `[BİLGİ] Hoş geldin ${userDisplayNameForJoin}! `) {
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
                text: gameInfoMessage,
                senderId: "system",
                senderName: "Sistem",
                senderAvatar: null,
                timestamp: serverTimestamp(),
                isGameMessage: true,
            });
        }
      }

    } catch (error) {
      console.error("Error joining room:", error);
      toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsProcessingJoinLeave(false);
    }
  }, [currentUser, userData, roomId, roomDetails, toast, router, gameSettings]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentUser || !roomId || !isCurrentUserParticipant) return Promise.resolve();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    await updateUserTypingStatus(false);
    
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    
    const userDisplayNameForLeave = userData?.displayName || currentUser?.displayName;
    if (userDisplayNameForLeave) {
        try {
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
                text: `[SİSTEM] ${userDisplayNameForLeave} odadan ayrıldı.`,
                senderId: "system",
                senderName: "Sistem",
                senderAvatar: null,
                timestamp: serverTimestamp(),
                isGameMessage: true,
            });
        } catch (msgError) {
            console.warn("Could not send leave message:", msgError);
        }
    }

    try {
      const batch = writeBatch(db);
      batch.delete(participantRef);
      batch.update(roomRef, { participantCount: increment(-1) });
      await batch.commit();
      setIsCurrentUserParticipant(false);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  }, [currentUser, roomId, isCurrentUserParticipant, updateUserTypingStatus, userData?.displayName]);

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
          maxParticipants: data.maxParticipants || 7,
          expiresAt: data.expiresAt,
          currentGameQuestionId: data.currentGameQuestionId,
          nextGameQuestionTimestamp: data.nextGameQuestionTimestamp,
          gameInitialized: data.gameInitialized,
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
      toast({ title: "Hata", description: "Oda bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingRoom(false);
    });
    return () => unsubscribeRoom();
  }, [roomId, toast, router]);


  useEffect(() => {
    if (!roomId || !currentUser || !userData || !roomDetails) return;
    if (!isCurrentUserParticipant && !isProcessingJoinLeave && !isRoomFullError) {
        handleJoinRoom();
    }
    const participantsQuery = query(collection(db, `chatRooms/${roomId}/participants`), orderBy("joinedAt", "asc"));
    const unsubscribeParticipants = onSnapshot(participantsQuery, (snapshot) => {
      const fetchedParticipants: ActiveParticipant[] = [];
      let currentUserIsStillParticipant = false;
      snapshot.forEach((doc) => {
        const participantData = doc.data();
        fetchedParticipants.push({ 
            id: doc.id, 
            displayName: participantData.displayName,
            photoURL: participantData.photoURL,
            joinedAt: participantData.joinedAt,
            isTyping: participantData.isTyping,
        } as ActiveParticipant);
        if (doc.id === currentUser.uid) {
            currentUserIsStillParticipant = true;
        }
      });
      setActiveParticipants(fetchedParticipants);
      setIsCurrentUserParticipant(currentUserIsStillParticipant);
      if (isCurrentUserParticipant && !currentUserIsStillParticipant && !isProcessingJoinLeave) {
        setIsCurrentUserParticipant(false); 
      }
    });
    return () => unsubscribeParticipants();
  }, [roomId, currentUser, userData, roomDetails, handleJoinRoom, isCurrentUserParticipant, isProcessingJoinLeave, isRoomFullError]);


  useEffect(() => {
    if(!roomId) return;
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
          isGameMessage: data.isGameMessage || false, 
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
    return () => unsubscribeMessages();
  }, [roomId, currentUser?.uid, toast]);


  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isCurrentUserParticipant) {
         handleLeaveRoom();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isCurrentUserParticipant) {
         handleLeaveRoom();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (gameQuestionIntervalTimerRef.current) { 
        clearInterval(gameQuestionIntervalTimerRef.current);
      }
      if (countdownDisplayTimerRef.current) {
        clearInterval(countdownDisplayTimerRef.current);
      }
    };
  }, [isCurrentUserParticipant, handleLeaveRoom]);


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
  const canSendMessage = !isRoomExpired && !isRoomFullError && isCurrentUserParticipant;


  const handleNewMessageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const currentMessage = e.target.value;
    setNewMessage(currentMessage);
    if (!isCurrentUserParticipant || !canSendMessage) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      if (currentMessage.trim() !== "") {
        updateUserTypingStatus(true);
      }
    }
    if (currentMessage.trim() === "") {
        updateUserTypingStatus(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    } else { 
        typingTimeoutRef.current = setTimeout(() => {
            updateUserTypingStatus(false);
            typingTimeoutRef.current = null; 
        }, TYPING_DEBOUNCE_DELAY);
    }
  };


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newMessage.trim() || !roomId || !canSendMessage || !userData) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    await updateUserTypingStatus(false);

    const tempMessage = newMessage.trim();
    setNewMessage(""); 

    const roomDocRef = doc(db, "chatRooms", roomId);

    // /hint komutu işleme
    if (tempMessage.toLowerCase() === "/hint" && activeGameQuestion && gameSettings?.isGameEnabled) {
        if ((userData.diamonds ?? 0) < HINT_COST) {
            toast({ title: "Yetersiz Elmas", description: `İpucu için ${HINT_COST} elmasa ihtiyacın var.`, variant: "destructive"});
            setNewMessage(tempMessage); // Komutu geri yükle
            return;
        }
        setIsSending(true);
        try {
            await updateUserDiamonds((userData.diamonds ?? 0) - HINT_COST);
            toast({
                title: "İpucu!",
                description: (
                    <div className="flex items-start gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-400 mt-0.5" />
                        <span>{activeGameQuestion.hint} (-{HINT_COST} <Gem className="inline h-3 w-3 mb-px" />)</span>
                    </div>
                ),
                duration: 10000, // İpucunu daha uzun göster
            });
            await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
                text: `[OYUN] ${userData.displayName} bir ipucu kullandı!`,
                senderId: "system",
                senderName: "Oyun Sistemi",
                timestamp: serverTimestamp(),
                isGameMessage: true,
            });
        } catch (error) {
            console.error("[GameSystem] Error processing hint:", error);
            toast({ title: "Hata", description: "İpucu alınırken bir sorun oluştu.", variant: "destructive"});
            // Elmas düşürme başarısız olduysa geri yükleme mantığı eklenebilir.
        } finally {
            setIsSending(false);
        }
        return;
    }


    // /answer komutu işleme
    if (tempMessage.toLowerCase().startsWith("/answer ") && activeGameQuestion && gameSettings?.isGameEnabled) {
      setIsSending(true);
      const userAnswer = tempMessage.substring(8).trim();
      
      // Firestore'dan en güncel soru ID'sini al
      const currentRoomSnap = await getDoc(roomDocRef);
      const currentRoomData = currentRoomSnap.data() as ChatRoomDetails;

      if (currentRoomData?.currentGameQuestionId !== activeGameQuestion.id) {
        // Soru değişmiş veya cevaplanmış
        toast({ title: "Geç Kaldın!", description: "Bu soruya zaten cevap verildi veya soru değişti.", variant: "destructive" });
        setIsSending(false);
        return;
      }

      if (userAnswer.toLowerCase() === activeGameQuestion.answer.toLowerCase()) {
        const reward = FIXED_GAME_REWARD;
        await updateUserDiamonds((userData.diamonds || 0) + reward);
        
        const batch = writeBatch(db);
        batch.update(roomDocRef, { currentGameQuestionId: null }); // Soruyu Firestore'dan temizle
        batch.set(doc(collection(db, `chatRooms/${roomId}/messages`)), {
          text: `[OYUN] Tebrikler ${userData.displayName}! "${activeGameQuestion.text}" sorusuna doğru cevap verdin ve ${reward} elmas kazandın!`,
          senderId: "system",
          senderName: "Oyun Sistemi",
          timestamp: serverTimestamp(),
          isGameMessage: true,
        });
        await batch.commit();

        toast({ title: "Doğru Cevap!", description: `${reward} elmas kazandın!` });
        setAvailableGameQuestions(prev => prev.filter(q => q.id !== activeGameQuestion.id));
        // setActiveGameQuestion(null) ve setShowGameQuestionCard(false) artık Firestore dinleyicisiyle yönetilecek
      } else {
        addDoc(collection(db, `chatRooms/${roomId}/messages`), {
          text: `[OYUN] ${userData.displayName}, "${userAnswer}" cevabın doğru değil. Tekrar dene!`,
          senderId: "system",
          senderName: "Oyun Sistemi",
          timestamp: serverTimestamp(),
          isGameMessage: true,
        });
        toast({ title: "Yanlış Cevap", description: "Maalesef doğru değil, tekrar deneyebilirsin.", variant: "destructive" });
      }
      setIsSending(false);
      return;
    }

    // Normal mesaj gönderme
    setIsSending(true);
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: tempMessage,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        senderAvatar: userData?.photoURL || currentUser.photoURL,
        timestamp: serverTimestamp(),
        isGameMessage: false,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Hata", description: "Mesaj gönderilirken bir sorun oluştu.", variant: "destructive" });
      setNewMessage(tempMessage); 
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomDetails || !currentUser || roomDetails.creatorId !== currentUser.uid) {
      toast({ title: "Hata", description: "Bu odayı silme yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (!confirm(`"${roomDetails.name}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz, tüm mesajlar ve katılımcı bilgileri silinecektir.`)) {
      return;
    }
    try {
      const batch = writeBatch(db);
      
      const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`));
      const messagesSnapshot = await getDocs(messagesQuery);
      messagesSnapshot.forEach((messageDoc) => batch.delete(messageDoc.ref));

      const participantsQuery = query(collection(db, `chatRooms/${roomId}/participants`));
      const participantsSnapshot = await getDocs(participantsQuery);
      participantsSnapshot.forEach((participantDoc) => batch.delete(participantDoc.ref));
      
      batch.delete(doc(db, "chatRooms", roomId));
      
      await batch.commit();
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
    if ((userData.diamonds ?? 0) < ROOM_EXTENSION_COST) {
      toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds ?? 0}`, variant: "destructive" });
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
      await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_EXTENSION_COST);
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
        createdAt: Timestamp.now() 
      });
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

  const handleDmAction = (targetUserId: string | undefined | null) => {
    if (!currentUser?.uid || !targetUserId) return;
    const dmId = generateDmChatId(currentUser.uid, targetUserId);
    router.push(`/dm/${dmId}`);
  };


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
        <GameQuestionCard
          question={activeGameQuestion}
          onClose={handleCloseGameQuestionCard}
          reward={FIXED_GAME_REWARD} // Sabit ödülü props olarak geç
        />
      )}

      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0 h-9 w-9">
            <Link href="/chat"> 
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Geri</span>
            </Link>
            </Button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={`https://placehold.co/40x40.png?text=${roomDetails.name.substring(0,1)}`} data-ai-hint="group chat"/>
                <AvatarFallback>{getAvatarFallbackText(roomDetails.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-primary-foreground/90 truncate" title={roomDetails.name}>{roomDetails.name}</h2>
                <div className="flex items-center text-xs text-muted-foreground gap-x-2">
                    {roomDetails.expiresAt && (
                        <div className="flex items-center truncate">
                            <Clock className="mr-1 h-3 w-3" />
                            <span className="truncate" title={getExpiryInfo()}>{getExpiryInfo()}</span>
                        </div>
                    )}
                    {gameSettings?.isGameEnabled && isCurrentUserParticipant && nextQuestionCountdown !== null && !activeGameQuestion && formatCountdown(nextQuestionCountdown) && (
                      <div className="flex items-center truncate ml-2 border-l pl-2 border-muted-foreground/30" title={`Sonraki soruya kalan süre: ${formatCountdown(nextQuestionCountdown)}`}>
                        <Puzzle className="mr-1 h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatCountdown(nextQuestionCountdown)}
                        </span>
                      </div>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-9 px-2.5">
                        <UsersRound className="h-4 w-4" />
                        <span className="text-xs">{activeParticipants.length}/{roomDetails.maxParticipants}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                    <div className="p-2 border-b">
                        <h3 className="text-xs font-medium text-center text-muted-foreground">
                            Aktif Katılımcılar ({activeParticipants.length}/{roomDetails.maxParticipants})
                        </h3>
                    </div>
                    <ScrollArea className="max-h-60">
                        {activeParticipants.length === 0 && !isProcessingJoinLeave && (
                            <div className="text-center text-xs text-muted-foreground py-3 px-2">
                                <Users className="mx-auto h-6 w-6 mb-1 text-muted-foreground/50" />
                                Odada kimse yok.
                            </div>
                        )}
                        {isProcessingJoinLeave && activeParticipants.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-3 px-2">
                                <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-0.5" />
                                Yükleniyor...
                            </div>
                        )}
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
                                Süre Uzat ({ROOM_EXTENSION_COST} <Gem className="inline h-3 w-3 ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)
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

    <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1 p-3 sm:p-4 space-y-2" ref={scrollAreaRef}>
            {loadingMessages && (
                <div className="flex flex-1 items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Mesajlar yükleniyor...</p>
                </div>
            )}
            {!loadingMessages && messages.length === 0 && !isRoomExpired && !isRoomFullError && isCurrentUserParticipant && (
                <div className="text-center text-muted-foreground py-10 px-4">
                    <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-lg font-medium">Henüz hiç mesaj yok.</p>
                    <p className="text-sm">İlk mesajı sen göndererek sohbeti başlat!</p>
                </div>
            )}
             {!isCurrentUserParticipant && !isRoomFullError && !loadingRoom && !isProcessingJoinLeave && (
                <div className="text-center text-muted-foreground py-10 px-4">
                    <Users className="mx-auto h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-lg font-medium">Odaya katılmadınız.</p>
                    <p className="text-sm">Mesajları görmek ve göndermek için odaya otomatik olarak katılıyorsunuz. Lütfen bekleyin veya bir sorun varsa sayfayı yenileyin.</p>
                </div>
            )}
            {isRoomFullError && (
                 <div className="text-center text-destructive py-10 px-4">
                    <ShieldAlert className="mx-auto h-16 w-16 text-destructive/80 mb-3" />
                    <p className="text-lg font-semibold">Bu sohbet odası dolu!</p>
                    <p>Maksimum katılımcı sayısına ulaşıldığı için mesaj gönderemezsiniz.</p>
                </div>
            )}
            {isRoomExpired && !isRoomFullError && (
                <div className="text-center text-destructive py-10">
                    <Clock className="mx-auto h-16 w-16 text-destructive/80 mb-3" />
                    <p className="text-lg font-semibold">Bu sohbet odasının süresi dolmuştur.</p>
                    <p>Yeni mesaj gönderilemez.</p>
                </div>
            )}
            {messages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""} ${msg.isGameMessage ? "justify-center" : ""}`}>
                {msg.isGameMessage ? (
                    <div className="w-full max-w-md mx-auto my-2">
                        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-gradient-to-r from-primary/10 via-secondary/20 to-accent/10 border border-border/50 shadow-sm">
                           {msg.text.toLowerCase().includes("[oyun]") ? <Gamepad2 className="inline h-4 w-4 mr-1.5 text-primary" /> : <MessageSquare className="inline h-4 w-4 mr-1.5 text-blue-500" /> }
                           {msg.text}
                        </div>
                    </div>
                ) : (
                <>
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
                                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => handleDmAction(popoverTargetUser?.uid)} >
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
                </>
                )}
            </div>
            ))}
        </ScrollArea>
    </div>


      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading} className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
            <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder={
                activeGameQuestion && gameSettings?.isGameEnabled
                ? "Soruya cevap: /answer <cevap> veya ipucu: /hint ..."
                : !canSendMessage
                ? (isRoomExpired ? "Oda süresi doldu" : isRoomFullError ? "Oda dolu, mesaj gönderilemez" : "Odaya bağlanılıyor...")
                : "Mesajınızı yazın..."
            }
            value={newMessage}
            onChange={handleNewMessageInputChange}
            className="flex-1 pr-24 sm:pr-28 rounded-full h-10 sm:h-11 text-sm focus-visible:ring-primary/80"
            autoComplete="off"
            disabled={!canSendMessage || isSending || isUserLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button" disabled={!canSendMessage || isUserLoading} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
              <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-8 w-8 sm:h-9 sm:w-9" disabled={!canSendMessage || isSending || !newMessage.trim() || isUserLoading}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
        {!canSendMessage && (
            <p className="text-xs text-destructive text-center mt-1.5">
            {isRoomExpired ? "Bu odanın süresi dolduğu için mesaj gönderemezsiniz." :
             isRoomFullError ? "Oda dolu olduğu için mesaj gönderemezsiniz." :
             !isCurrentUserParticipant && !loadingRoom && !isProcessingJoinLeave ? "Mesaj göndermek için odaya katılmayı bekleyin." : ""}
            </p>
        )}
      </form>
    </div>
  );
}

