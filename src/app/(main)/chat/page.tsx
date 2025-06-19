
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, LogIn, Loader2, MessageSquare, X, Clock, Gem, UsersRound, ShoppingBag, Youtube, Compass, SearchCode, Mic, Star, Settings as SettingsIcon, Gamepad2 } from "lucide-react"; // Gamepad2 eklendi
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, Timestamp, updateDoc, where, limit, getDocs } from "firebase/firestore";
import { useAuth, checkUserPremium } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { addMinutes, isPast, addSeconds } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { deleteChatRoomAndSubcollections } from "@/lib/firestoreUtils";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import EditChatRoomDialog from "@/components/chat/EditChatRoomDialog";

interface ChatRoomVoiceParticipantPreview {
  uid: string;
  photoURL: string | null;
  displayName: string | null;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorIsPremium?: boolean;
  isPremiumRoom?: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  participantCount?: number;
  maxParticipants: number;
  voiceParticipantPreviews?: ChatRoomVoiceParticipantPreview[];
  image?: string;
  imageAiHint?: string;
  isGameEnabledInRoom?: boolean; // Eklendi
}

interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

const ROOM_CREATION_COST = 1;
const ROOM_DEFAULT_DURATION_MINUTES = 20;
const MAX_PARTICIPANTS_PER_ROOM = 7;
const PREMIUM_USER_ROOM_CAPACITY = 50;
const MAX_VOICE_PREVIEWS_ON_CARD = 4;

const SCROLL_HIDE_THRESHOLD_CHAT = 80;
const ROOMS_INFO_CARD_SESSION_KEY = 'roomsInfoCardHidden_v1_hiwewalk';

const cardVariants = {
  hidden: { opacity: 0, y: -20, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    marginBottom: '1.5rem',
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 0.5
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } },
};


export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const { currentUser, userData, updateUserDiamonds, isUserLoading, isUserDataLoading, isCurrentUserPremium } = useAuth();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);

  const [isRoomsInfoCardVisible, setIsRoomsInfoCardVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(ROOMS_INFO_CARD_SESSION_KEY) !== 'true';
    }
    return true;
  });

  const [isEditRoomModalOpen, setIsEditRoomModalOpen] = useState(false);
  const [editingRoomDetails, setEditingRoomDetails] = useState<ChatRoom | null>(null);


  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isRoomsInfoCardVisible) return;

    const handleScroll = () => {
      if (window.scrollY > SCROLL_HIDE_THRESHOLD_CHAT) {
        setIsRoomsInfoCardVisible(false);
        sessionStorage.setItem(ROOMS_INFO_CARD_SESSION_KEY, 'true');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isRoomsInfoCardVisible]);

  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          setGameSettings(docSnap.data() as GameSettings);
        } else {
          setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
        }
      } catch (error) {
        console.error("Error fetching game settings for room creation:", error);
        setGameSettings({ isGameEnabled: false, questionIntervalSeconds: 180 });
      }
    };
    fetchGameSettings();
  }, []);


  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const currentTime = Timestamp.now();
      const q = query(
        collection(db, "chatRooms"),
        where("expiresAt", ">", currentTime),
        orderBy("expiresAt", "asc"),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const roomsPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const roomData = docSnapshot.data() as Omit<ChatRoom, 'id' | 'voiceParticipantPreviews'>;
        if (roomData.expiresAt && !isPast(roomData.expiresAt.toDate())) {
          let voicePreviews: ChatRoomVoiceParticipantPreview[] = [];
          try {
            const voiceParticipantsRef = collection(db, `chatRooms/${docSnapshot.id}/voiceParticipants`);
            const voiceQuery = query(voiceParticipantsRef, orderBy("joinedAt", "asc"), limit(MAX_VOICE_PREVIEWS_ON_CARD));
            const voiceSnapshot = await getDocs(voiceQuery);
            voiceSnapshot.forEach(vpDoc => {
              const vpData = vpDoc.data();
              voicePreviews.push({
                uid: vpDoc.id,
                photoURL: vpData.photoURL || null,
                displayName: vpData.displayName || null,
              });
            });
          } catch (error) {
            console.warn(`Error fetching voice previews for room ${docSnapshot.id}:`, error);
          }
          return {
              id: docSnapshot.id,
              ...roomData,
              voiceParticipantPreviews: voicePreviews,
              creatorIsPremium: roomData.creatorIsPremium || false,
              isPremiumRoom: roomData.isPremiumRoom || false,
              isGameEnabledInRoom: roomData.isGameEnabledInRoom ?? (gameSettings?.isGameEnabled ?? false), // Eklendi
          } as ChatRoom;
        }
        return null;
      });

      const resolvedRooms = (await Promise.all(roomsPromises)).filter(room => room !== null) as ChatRoom[];
      const sortedRooms = resolvedRooms.sort((a,b) => {
        if (a.isPremiumRoom && !b.isPremiumRoom) return -1;
        if (!a.isPremiumRoom && b.isPremiumRoom) return 1;
        const participantDiff = (b.participantCount ?? 0) - (a.participantCount ?? 0);
        if (participantDiff !== 0) return participantDiff;
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setChatRooms(sortedRooms);
    } catch (error) {
      console.error("Error fetching chat rooms: ", error);
      toast({ title: "Hata", description: "Sohbet odaları yüklenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, gameSettings]);

  useEffect(() => {
    document.title = 'Sohbet Odaları - HiweWalk';
    fetchRooms();
  }, [fetchRooms]);

  const resetCreateRoomForm = () => {
    setNewRoomName("");
    setNewRoomDescription("");
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Oda oluşturmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }

    const userIsCreatorPremium = isCurrentUserPremium();

    if (!userIsCreatorPremium && (userData.diamonds ?? 0) < ROOM_CREATION_COST) {
      toast({
        title: "Yetersiz Elmas!",
        description: (
          <div>
            <p>Oda oluşturmak için {ROOM_CREATION_COST} elmasa ihtiyacın var. Mevcut elmas: {userData.diamonds ?? 0}.</p>
            <p className="mt-2">Sohbet odalarındaki oyunlara katılarak elmas kazanabilir veya mağazadan elmas alabilirsin!</p>
          </div>
        ),
        variant: "destructive",
        duration: 7000,
      });
      return;
    }
    if (!newRoomName.trim()) {
      toast({ title: "Hata", description: "Oda adı boş olamaz.", variant: "destructive" });
      return;
    }
    if (!newRoomDescription.trim()) {
      toast({ title: "Hata", description: "Oda açıklaması boş olamaz.", variant: "destructive" });
      return;
    }
    setIsCreatingRoom(true);


    const imageUrl = "https://placehold.co/600x400.png";
    const imageHint = "community discussion";

    const currentTime = new Date();
    const expiresAtDate = addMinutes(currentTime, ROOM_DEFAULT_DURATION_MINUTES);

    const roomMaxParticipants = userIsCreatorPremium ? PREMIUM_USER_ROOM_CAPACITY : MAX_PARTICIPANTS_PER_ROOM;
    const isGameInitiallyEnabled = gameSettings?.isGameEnabled ?? false;


    const roomDataToCreate: any = {
      name: newRoomName.trim(),
      description: newRoomDescription.trim(),
      creatorId: currentUser.uid,
      creatorName: userData.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
      creatorIsPremium: userIsCreatorPremium,
      isPremiumRoom: userIsCreatorPremium,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAtDate),
      image: imageUrl,
      imageAiHint: imageHint,
      participantCount: 0,
      voiceParticipantCount: 0,
      maxParticipants: roomMaxParticipants,
      isGameEnabledInRoom: isGameInitiallyEnabled, // Eklendi
      gameInitialized: false,
      currentGameQuestionId: null,
      nextGameQuestionTimestamp: null,
      currentGameAnswerDeadline: null,
    };

    if (isGameInitiallyEnabled && gameSettings?.isGameEnabled && typeof gameSettings.questionIntervalSeconds === 'number' && gameSettings.questionIntervalSeconds >= 30) {
      roomDataToCreate.gameInitialized = true;
      roomDataToCreate.nextGameQuestionTimestamp = Timestamp.fromDate(addSeconds(new Date(), gameSettings.questionIntervalSeconds));
    }


    try {
      const newRoomRef = await addDoc(collection(db, "chatRooms"), roomDataToCreate);
      if (!userIsCreatorPremium) {
        await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_CREATION_COST);
        toast({ title: "Başarılı", description: `"${newRoomName}" odası oluşturuldu. ${ROOM_CREATION_COST} elmas harcandı.` });
      } else {
        toast({ title: "Başarılı", description: `Premium kullanıcı olduğunuz için "${newRoomName}" odası ücretsiz oluşturuldu!` });
      }
      resetCreateRoomForm();
      setIsCreateModalOpen(false);

      setEditingRoomDetails({
        id: newRoomRef.id,
        name: roomDataToCreate.name,
        description: roomDataToCreate.description,
        creatorId: roomDataToCreate.creatorId,
        creatorName: roomDataToCreate.creatorName,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAtDate),
        image: roomDataToCreate.image,
        imageAiHint: roomDataToCreate.imageAiHint,
        maxParticipants: roomDataToCreate.maxParticipants,
        isGameEnabledInRoom: roomDataToCreate.isGameEnabledInRoom,
      } as ChatRoom);
      setIsEditRoomModalOpen(true);

    } catch (error: any) {
      console.error("[ChatPage] Error creating room:", error);
      toast({ title: "Hata", description: `Oda oluşturulurken bir sorun oluştu: ${error.code || error.message}`, variant: "destructive" });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleOpenCreateRoomDialog = () => {
    if (!currentUser || isUserLoading || isUserDataLoading) {
        toast({ title: "Giriş Gerekli", description: "Oda oluşturmak için lütfen giriş yapın.", variant: "destructive" });
        return;
    }
    const userIsCreatorPremium = isCurrentUserPremium();

    if (!userIsCreatorPremium && (userData?.diamonds ?? 0) < ROOM_CREATION_COST) {
        toast({
          title: "Yetersiz Elmas!",
          description: (
            <div>
              <p>Oda oluşturmak için {ROOM_CREATION_COST} elmasa ihtiyacın var. Mevcut elmas: {userData?.diamonds ?? 0}.</p>
              <p className="mt-2">Sohbet odalarındaki oyunlara katılarak elmas kazanabilir veya mağazadan elmas alabilirsin!</p>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm"><Link href="/store">Elmas Mağazası</Link></Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Yakında!", description: "Video izleyerek elmas kazanma özelliği yakında eklenecektir."})}>Video İzle</Button>
              </div>
            </div>
          ),
          variant: "destructive",
          duration: 10000,
        });
        return;
    }
    setIsCreateModalOpen(true);
};


  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }
    try {
      await deleteChatRoomAndSubcollections(roomId);
      setChatRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
      toast({ title: "Başarılı", description: `"${roomName}" odası silindi.` });
    } catch (error) {
      console.error("Error deleting room: ", error);
      toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const getPreciseCardExpiryInfo = (expiresAt: Timestamp | null | undefined): string => {
    if (!expiresAt) return "Süre bilgisi yok";
    const expiryDate = expiresAt.toDate();
    if (isPast(expiryDate)) {
      return "Süresi Doldu";
    }

    const diffSecondsTotal = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

    if (diffSecondsTotal < 0) return "Süresi Doldu";

    const days = Math.floor(diffSecondsTotal / 86400);
    const hours = Math.floor((diffSecondsTotal % 86400) / 3600);
    const minutes = Math.floor((diffSecondsTotal % 3600) / 60);

    if (days > 0) {
      return `Kalan: ${days} gün ${hours} sa`;
    }
    if (hours > 0) {
      return `Kalan: ${hours} sa ${minutes} dk`;
    }
    if (minutes > 0) {
      return `Kalan: ${minutes} dk`;
    }
    return `Kalan: <1 dk`;
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };


  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Sohbet odaları yükleniyor...</p>
      </div>
    );
  }
  const isCreatorPremiumForDialog = isCurrentUserPremium();
  const hasEnoughDiamonds = (userData?.diamonds ?? 0) >= ROOM_CREATION_COST;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isRoomsInfoCardVisible && (
          <motion.div
            key="rooms-info-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Card className="shadow-lg bg-card border border-border/30 rounded-xl overflow-hidden">
              <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
                <motion.div
                  className="flex items-center gap-3"
                  variants={itemVariants}
                >
                  <SearchCode className="h-7 w-7 text-primary" />
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">
                      Sohbet Odalarını Keşfet!
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Farklı konularda sohbetlere katıl, yeni insanlarla tanış veya kendi odanı oluşturup arkadaşlarını davet et. Her oda yeni bir macera!
                    </CardDescription>
                  </div>
                </motion.div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3">
                <motion.p
                  className="text-sm text-muted-foreground"
                  variants={itemVariants}
                >
                  Aşağıdaki listelenen aktif odalara katılabilir veya sağ üstteki butonu kullanarak kendi sohbet odanızı oluşturabilirsiniz.
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold text-foreground">Sohbet Odaları</h1>
          <p className="text-muted-foreground">İlgi alanlarınıza uygun odalara katılın veya kendi odanızı oluşturun.</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={(isOpen) => {
            setIsCreateModalOpen(isOpen);
            if (!isOpen) resetCreateRoomForm();
        }}>
          <DialogTrigger asChild>
            <Button
              onClick={handleOpenCreateRoomDialog}
              className="bg-primary hover:bg-primary/90 text-primary-foreground animate-subtle-pulse w-full sm:w-auto"
              disabled={!currentUser || isUserLoading || isUserDataLoading}
            >
              Yeni Oda Oluştur
               {isCreatorPremiumForDialog && (
                <Badge variant="secondary" className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5">Premium Ücretsiz</Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleCreateRoomSubmit}>
              <DialogHeader>
                <DialogTitle>Yeni Sohbet Odası Oluştur</DialogTitle>
                <DialogDescription>
                  Odanız için bir ad ve açıklama belirleyin.
                  {isCreatorPremiumForDialog
                    ? ` Premium kullanıcı olduğunuz için oda oluşturmak ücretsizdir ve ${PREMIUM_USER_ROOM_CAPACITY} katılımcı limitine sahip olacaktır.`
                    : ` Oda oluşturmak ${ROOM_CREATION_COST} elmasa mal olur, ${MAX_PARTICIPANTS_PER_ROOM} katılımcı limiti ve ${ROOM_DEFAULT_DURATION_MINUTES} dakika aktif kalma süresi olur.`}
                  Mevcut elmasınız: {userData?.diamonds ?? 0}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">Oda Adı</Label>
                  <Input
                    id="roomName"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                    disabled={isCreatingRoom}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roomDescription">Açıklama</Label>
                  <Textarea
                    id="roomDescription"
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    rows={3}
                    disabled={isCreatingRoom}
                    required
                    placeholder="Odanızın konusunu veya kurallarını kısaca açıklayın..."
                    maxLength={150}
                  />
                </div>

                {!isCreatorPremiumForDialog && !hasEnoughDiamonds && currentUser && (
                  <Card className="mt-4 border-destructive/50 bg-destructive/10 p-4">
                    <CardHeader className="p-0 mb-2">
                      <CardTitle className="text-base text-destructive-foreground dark:text-destructive">Elmasların Yetersiz!</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-xs text-destructive-foreground/80 dark:text-destructive/90 mb-3">
                        Oda oluşturmak için {ROOM_CREATION_COST} elmasa ihtiyacın var. Sohbet odalarındaki oyunlara katılarak elmas kazanabilir veya aşağıdaki seçenekleri değerlendirebilirsin:
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button asChild size="sm" className="flex-1 bg-primary hover:bg-primary/80">
                          <Link href="/store">
                            <ShoppingBag className="mr-1.5 h-4 w-4" /> Elmas Mağazası
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => toast({ title: "Yakında!", description: "Video izleyerek elmas kazanma özelliği yakında eklenecektir."})}
                        >
                          <Youtube className="mr-1.5 h-4 w-4" /> Video İzle Kazan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isCreatingRoom} onClick={resetCreateRoomForm}>İptal</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={
                    isCreatingRoom ||
                    !currentUser ||
                    !userData ||
                    (!isCreatorPremiumForDialog && !hasEnoughDiamonds)
                  }
                >
                  {isCreatingRoom && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Oluştur
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {editingRoomDetails && (
        <EditChatRoomDialog
          isOpen={isEditRoomModalOpen}
          onClose={() => {
            setIsEditRoomModalOpen(false);
            setEditingRoomDetails(null);
            fetchRooms();
          }}
          roomId={editingRoomDetails.id}
          initialName={editingRoomDetails.name}
          initialDescription={editingRoomDetails.description}
          initialImage={editingRoomDetails.image}
          initialIsGameEnabledInRoom={editingRoomDetails.isGameEnabledInRoom} // Eklendi
        />
      )}

      {chatRooms.length === 0 && !loading ? (
        <Card className="col-span-full text-center py-10 sm:py-16 bg-card border border-border/20 rounded-xl shadow-lg">
            <CardHeader>
                <MessageSquare className="mx-auto h-16 w-16 sm:h-20 sm:w-20 text-primary/70 mb-4" />
                <CardTitle className="text-2xl sm:text-3xl font-semibold text-foreground">Vuhu! Yeni Ufuklar Sizi Bekliyor!</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
                Görünüşe göre şu anda aktif bir sohbet odası yok. İlk adımı atıp kendi sohbet dünyanızı yaratmaya ne dersiniz?
                </p>
                <div className="mt-6">
                  <Button
                    onClick={handleOpenCreateRoomDialog}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground text-base px-6 py-3"
                    disabled={!currentUser || isUserLoading || isUserDataLoading }
                  >
                    Hemen Yeni Oda Oluştur!
                    {isCreatorPremiumForDialog && (
                        <Badge variant="secondary" className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5">Premium Ücretsiz</Badge>
                    )}
                  </Button>
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chatRooms.map((room) => {
            const isFull = (room.participantCount != null && room.maxParticipants != null && room.participantCount >= room.maxParticipants);
            const gameStatusText = room.isGameEnabledInRoom ? "Oyun Aktif" : "Oyun Kapalı";
            const gameStatusColor = room.isGameEnabledInRoom ? "bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-500/30" : "bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-500/20";

            return (
            <Card
              key={room.id}
              className={cn(
                "flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl border hover:border-primary/50 dark:hover:border-primary/60 group",
                room.isPremiumRoom ? 'border-yellow-500 dark:border-yellow-400 ring-1 ring-yellow-500/50 dark:ring-yellow-400/50 bg-gradient-to-br from-yellow-500/5 via-card to-yellow-500/10 dark:from-yellow-400/10 dark:via-card dark:to-yellow-400/15' : 'border-border/30 dark:border-border/20'
              )}
            >
              <CardHeader className="pt-5 pb-3 sm:pt-6 sm:pb-4 relative">
                <div className="flex items-center justify-between">
                    <CardTitle
                    className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate pr-10"
                    title={room.name}
                    >
                    {room.isPremiumRoom && <Star className="inline h-4 w-4 mb-0.5 mr-1.5 text-yellow-500 dark:text-yellow-400" />}
                    {room.name}
                    </CardTitle>
                    {currentUser && room.creatorId === currentUser.uid && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 sm:h-8 sm:w-8 opacity-70 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteRoom(room.id, room.name);
                        }}
                        aria-label="Odayı Sil"
                    >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    )}
                </div>
                <CardDescription className="h-10 text-xs sm:text-sm overflow-hidden text-ellipsis text-muted-foreground/80 group-hover:text-muted-foreground transition-colors mt-1.5" title={room.description}>
                  {room.description || "Açıklama yok."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-2 pb-3 sm:pb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <Badge variant="secondary" className="flex items-center justify-center gap-1.5 shadow-sm px-2.5 py-1">
                    <UsersRound className="h-3.5 w-3.5 text-primary/80" />
                    <span className="font-medium">{room.participantCount ?? 0} / {room.maxParticipants}</span>
                  </Badge>
                  <Badge
                    variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'}
                    className="flex items-center gap-1.5 shadow-sm px-2.5 py-1"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">{getPreciseCardExpiryInfo(room.expiresAt)}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-start text-xs text-muted-foreground mb-1">
                  <Badge className={cn("flex items-center gap-1.5 shadow-sm px-2 py-0.5 border", gameStatusColor)}>
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <span className="font-medium">{gameStatusText}</span>
                  </Badge>
                </div>
                {room.voiceParticipantPreviews && room.voiceParticipantPreviews.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Mic className="h-3.5 w-3.5 text-green-500"/>
                        <span className="text-xs font-medium text-muted-foreground">Sesli Sohbette:</span>
                    </div>
                    <div className="flex -space-x-2 overflow-hidden">
                      {room.voiceParticipantPreviews.map(vp => (
                        <Avatar key={vp.uid} className="inline-block h-6 w-6 rounded-full ring-2 ring-background" title={vp.displayName || 'Katılımcı'}>
                          <AvatarImage src={vp.photoURL || `https://placehold.co/24x24.png`} data-ai-hint="voice participant preview" />
                          <AvatarFallback>{getAvatarFallbackText(vp.displayName)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/70 truncate mt-2.5">
                  Oluşturan: <span className="font-medium text-muted-foreground/90">{room.creatorName}</span>
                  {room.creatorIsPremium && <Star className="inline h-3 w-3 ml-1 text-yellow-500 dark:text-yellow-400" title="Premium Oluşturucu" />}
                </p>
              </CardContent>
              <CardFooter className="p-3 sm:p-4 border-t bg-muted/20 dark:bg-card/30 mt-auto">
                <Button
                  asChild
                  className={cn(
                    "w-full text-sm py-2.5 rounded-lg transition-transform group-hover:scale-105",
                    isFull ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' :
                    room.isPremiumRoom ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' :
                    'bg-primary hover:bg-primary/80 text-primary-foreground'
                  )}
                  disabled={isFull}
                  aria-disabled={isFull}
                >
                  <Link href={!isFull ? `/chat/${room.id}` : '#'}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {isFull ? "Oda Dolu" : "Sohbete Katıl"}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
