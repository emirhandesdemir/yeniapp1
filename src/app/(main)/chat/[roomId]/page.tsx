
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile, Loader2, Users, Trash2, Clock, Gem, RefreshCw, UserCircle, MessageSquare, MoreVertical, UsersRound, ShieldAlert, Pencil, Gamepad2, X } from "lucide-react";
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
import { addMinutes, formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import GameQuestionCard from "@/components/game/GameQuestionCard"; // Yeni komponent importu

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  isGameMessage?: boolean; // Oyun mesajlarını ayırt etmek için
}

interface ChatRoomDetails {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  participantCount?: number;
  maxParticipants: number;
  expiresAt?: Timestamp;
}

interface ActiveParticipant {
  id: string; // userId
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

// Oyun Sistemi Arayüzleri
interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

interface GameQuestion {
  id: string;
  text: string;
  answer: string;
  reward: number;
}

// Şimdilik soruları burada hardcode edelim
const HARDCODED_QUESTIONS: GameQuestion[] = [
  { id: "q1", text: "Hangi anahtar kapı açmaz?", answer: "klavye", reward: 5 },
  { id: "q2", text: "Hangi ilimizde trafik lambası yoktur?", answer: "sinop", reward: 7 },
  { id: "q3", text: "Her zaman önünüzde olan ama göremediğiniz şey nedir?", answer: "gelecek", reward: 3 },
  { id: "q4", text: "Matematikte asal sayı olmayan tek çift sayı hangisidir?", answer: "2", reward: 4 },
  { id: "q5", text: "Bir fili buzdolabına nasıl sokarsın?", answer: "sokamazsın", reward: 2 },
];


const ROOM_EXTENSION_COST = 2;
const ROOM_EXTENSION_DURATION_MINUTES = 20;
const TYPING_DEBOUNCE_DELAY = 1500; // ms

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
  const [now, setNow] = useState(new Date());

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

  // Oyun Sistemi State'leri
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [activeGameQuestion, setActiveGameQuestion] = useState<GameQuestion | null>(null);
  const [showGameQuestionCard, setShowGameQuestionCard] = useState(false);
  const gameQuestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [availableGameQuestions, setAvailableGameQuestions] = useState<GameQuestion[]>([...HARDCODED_QUESTIONS]);


  // Oyun Ayarlarını Firestore'dan Çekme
  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const settingsData = docSnap.data() as GameSettings;
          console.log("[GameSystem] Fetched game settings:", settingsData);
          setGameSettings(settingsData);
        } else {
          console.log("[GameSystem] No game settings found in Firestore, game disabled by default.");
          setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 }); // Varsayılan olarak kapalı
        }
      } catch (error) {
        console.error("[GameSystem] Error fetching game settings:", error);
        setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 }); // Hata durumunda kapalı
        toast({ title: "Oyun Hatası", description: "Oyun ayarları yüklenirken bir sorun oluştu.", variant: "destructive" });
      }
    };
    fetchGameSettings();
  }, [toast]);

  // Oyun Soru Zamanlayıcısı
  useEffect(() => {
    if (gameSettings?.isGameEnabled && isCurrentUserParticipant && roomId) {
      if (gameQuestionTimerRef.current) {
        clearInterval(gameQuestionTimerRef.current);
      }
      gameQuestionTimerRef.current = setInterval(() => {
        if (!activeGameQuestion && availableGameQuestions.length > 0) { // Sadece aktif soru yoksa ve sorulacak soru varsa
          console.log("[GameSystem] Timer fired, attempting to show a new question.");
          const randomIndex = Math.floor(Math.random() * availableGameQuestions.length);
          const nextQuestion = availableGameQuestions[randomIndex];
          
          // Soruyu `availableGameQuestions` listesinden çıkar (geçici olarak, daha sonra tekrar eklenebilir)
          // Veya daha basit bir yaklaşım: aynı soru tekrar sorulabilir. Şimdilik basit tutalım.
          // const remainingQuestions = availableGameQuestions.filter(q => q.id !== nextQuestion.id);
          // setAvailableGameQuestions(remainingQuestions.length > 0 ? remainingQuestions : [...HARDCODED_QUESTIONS]); // Sorular biterse başa dön

          setActiveGameQuestion(nextQuestion);
          setShowGameQuestionCard(true);
          
          // Sisteme oyun mesajı ekle
          addDoc(collection(db, `chatRooms/${roomId}/messages`), {
            text: `[OYUN] Yeni bir soru geldi! "${nextQuestion.text}" (Ödül: ${nextQuestion.reward} Elmas). Cevaplamak için /answer <cevabınız> yazın.`,
            senderId: "system",
            senderName: "Oyun Sistemi",
            senderAvatar: null, // veya bir oyun ikonu URL'si
            timestamp: serverTimestamp(),
            isGameMessage: true,
          }).catch(err => console.error("[GameSystem] Error sending new question system message:", err));

        }
      }, (gameSettings.questionIntervalSeconds || 180) * 1000); // Saniye cinsinden ayar

      return () => {
        if (gameQuestionTimerRef.current) {
          clearInterval(gameQuestionTimerRef.current);
          gameQuestionTimerRef.current = null;
        }
      };
    } else {
      // Oyun kapalıysa veya kullanıcı katılımcı değilse zamanlayıcıyı temizle
      if (gameQuestionTimerRef.current) {
        clearInterval(gameQuestionTimerRef.current);
        gameQuestionTimerRef.current = null;
        console.log("[GameSystem] Timer cleared because game is disabled or user is not participant.");
      }
      // Aktif soru varsa ve oyun devre dışı bırakılırsa soruyu gizle
      if (activeGameQuestion) {
        setActiveGameQuestion(null);
        setShowGameQuestionCard(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSettings, isCurrentUserParticipant, activeGameQuestion, roomId, availableGameQuestions]);


  const handleCloseGameQuestionCard = () => {
    setShowGameQuestionCard(false);
    setActiveGameQuestion(null); // Soruyu kapatınca aktif soruyu da temizle, böylece timer yeni soru getirebilir.
    // Soru kapatıldığında sistem mesajı da eklenebilir.
     addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: `[OYUN] Soru ("${activeGameQuestion?.text?.substring(0,20)}...") pas geçildi.`,
        senderId: "system",
        senderName: "Oyun Sistemi",
        timestamp: serverTimestamp(),
        isGameMessage: true,
      }).catch(err => console.error("[GameSystem] Error sending question passed system message:", err));
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
      await batch.commit();
      setIsCurrentUserParticipant(true);
      toast({ title: "Odaya Katıldınız!", description: `${roomDetails.name} odasına başarıyla katıldınız.` });
    } catch (error) {
      console.error("Error joining room:", error);
      toast({ title: "Hata", description: "Odaya katılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsProcessingJoinLeave(false);
    }
  }, [currentUser, userData, roomId, roomDetails, toast, router]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentUser || !roomId || !isCurrentUserParticipant) return Promise.resolve();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    await updateUserTypingStatus(false);
    const participantRef = doc(db, `chatRooms/${roomId}/participants`, currentUser.uid);
    const roomRef = doc(db, "chatRooms", roomId);
    try {
      const batch = writeBatch(db);
      batch.delete(participantRef);
      batch.update(roomRef, { participantCount: increment(-1) });
      await batch.commit();
      setIsCurrentUserParticipant(false);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  }, [currentUser, roomId, isCurrentUserParticipant, updateUserTypingStatus]);


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          isGameMessage: data.isGameMessage || false, // Oyun mesajı mı?
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
    return () => {
      if (isCurrentUserParticipant) {
         handleLeaveRoom();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (gameQuestionTimerRef.current) { // Component unmount olduğunda timer'ı temizle
        clearInterval(gameQuestionTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Oyun Cevabı Kontrolü
    if (tempMessage.toLowerCase().startsWith("/answer ") && activeGameQuestion && showGameQuestionCard) {
      const userAnswer = tempMessage.substring(8).trim(); // "/answer " kısmını atla (8 karakter)
      console.log(`[GameSystem] User ${userData.displayName} answered: "${userAnswer}" for question: "${activeGameQuestion.text}"`);

      if (userAnswer.toLowerCase() === activeGameQuestion.answer.toLowerCase()) {
        const reward = activeGameQuestion.reward;
        await updateUserDiamonds((userData.diamonds || 0) + reward);
        
        const successSystemMessage = `[OYUN] Tebrikler ${userData.displayName}! "${activeGameQuestion.text}" sorusuna doğru cevap verdin ve ${reward} elmas kazandın!`;
        addDoc(collection(db, `chatRooms/${roomId}/messages`), {
          text: successSystemMessage,
          senderId: "system",
          senderName: "Oyun Sistemi",
          timestamp: serverTimestamp(),
          isGameMessage: true,
        });
        toast({ title: "Doğru Cevap!", description: `${reward} elmas kazandın!` });
        
        setActiveGameQuestion(null); // Soruyu temizle
        setShowGameQuestionCard(false); // Kartı gizle
      } else {
        const incorrectSystemMessage = `[OYUN] ${userData.displayName}, "${userAnswer}" cevabın doğru değil. Tekrar dene!`;
         addDoc(collection(db, `chatRooms/${roomId}/messages`), {
          text: incorrectSystemMessage,
          senderId: "system",
          senderName: "Oyun Sistemi",
          timestamp: serverTimestamp(),
          isGameMessage: true,
        });
        toast({ title: "Yanlış Cevap", description: "Maalesef doğru değil, tekrar deneyebilirsin.", variant: "destructive" });
      }
      setIsSending(false); // Bu durumda da sending false olmalı
      return; // Oyun komutu işlendi, normal mesaj olarak gönderme
    }


    // Normal Mesaj Gönderme
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
    if (userData.diamonds < ROOM_EXTENSION_COST) {
      toast({ title: "Yetersiz Elmas", description: `Süre uzatmak için ${ROOM_EXTENSION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds}`, variant: "destructive" });
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
      await updateUserDiamonds(userData.diamonds - ROOM_EXTENSION_COST);
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


  if (loadingRoom || !roomDetails || (isProcessingJoinLeave && !isRoomFullError && !isCurrentUserParticipant)) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Oda yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.20))] sm:h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.28))] bg-card rounded-xl shadow-lg overflow-hidden relative">
      {/* Oyun Soru Kartı */}
      {showGameQuestionCard && activeGameQuestion && gameSettings?.isGameEnabled && (
        <GameQuestionCard
          question={activeGameQuestion}
          onClose={handleCloseGameQuestionCard}
        />
      )}

      <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="md:hidden flex-shrink-0 h-9 w-9">
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
                                Süre Uzat (2 <Gem className="inline h-3 w-3 ml-1 mr-0.5 text-yellow-400 dark:text-yellow-500" />)
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
                {/* Oyun Mesajları Farklı Stilde */}
                {msg.isGameMessage ? (
                    <div className="w-full max-w-md mx-auto my-2">
                        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-gradient-to-r from-primary/10 via-secondary/20 to-accent/10 border border-border/50 shadow-sm">
                           <Gamepad2 className="inline h-4 w-4 mr-1.5 text-primary" /> {msg.text}
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
                                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => toast({ description: "DM özelliği yakında!"})} >
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
                activeGameQuestion && showGameQuestionCard && gameSettings?.isGameEnabled
                ? "Soruya cevap vermek için /answer <cevabınız> yazın veya normal mesaj gönderin..."
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
  