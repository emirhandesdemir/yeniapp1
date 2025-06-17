
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, LogIn, Loader2, MessageSquare, X, Clock, Gem, UsersRound, ShoppingBag, Youtube, Compass } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
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
import { addMinutes, formatDistanceToNow, isPast, addSeconds } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { deleteChatRoomAndSubcollections } from "@/lib/firestoreUtils";
import { motion, AnimatePresence } from "framer-motion";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  participantCount?: number;
  maxParticipants: number;
}

const ROOM_CREATION_COST = 10;
const ROOM_DEFAULT_DURATION_MINUTES = 20;
const MAX_PARTICIPANTS_PER_ROOM = 7;

const SCROLL_HIDE_THRESHOLD_CHAT = 80;
const ROOMS_INFO_CARD_SESSION_KEY = 'roomsInfoCardHidden_v1';

const cardVariants = {
  hidden: { opacity: 0, y: -20, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    marginBottom: '1.5rem', // Corresponds to space-y-6
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


export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const { currentUser, userData, updateUserDiamonds, isUserLoading, isUserDataLoading } = useAuth();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());

  const [isRoomsInfoCardVisible, setIsRoomsInfoCardVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(ROOMS_INFO_CARD_SESSION_KEY) !== 'true';
    }
    return true;
  });

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
    document.title = 'Sohbet Odaları - Sohbet Küresi';
    const q = query(collection(db, "chatRooms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const rooms: ChatRoom[] = [];
      querySnapshot.forEach((doc) => {
        const roomData = doc.data() as Omit<ChatRoom, 'id'>;
        rooms.push({ id: doc.id, ...roomData });
      });
      setChatRooms(rooms);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chat rooms: ", error);
      toast({ title: "Hata", description: "Sohbet odaları yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

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
    if ((userData.diamonds ?? 0) < ROOM_CREATION_COST) {
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

    let gameConfigData: { isGameEnabled?: boolean; questionIntervalSeconds?: number } | null = null;
    try {
      const gameConfigDocRef = doc(db, "appSettings", "gameConfig");
      const gameConfigSnap = await getDoc(gameConfigDocRef);
      if (gameConfigSnap.exists()) {
        gameConfigData = gameConfigSnap.data() as { isGameEnabled?: boolean; questionIntervalSeconds?: number };
      }
    } catch (configError) {
      console.warn("[ChatPage] Error fetching game config during room creation:", configError);
    }

    const imageUrl = "https://placehold.co/600x400.png";
    const imageHint = "community discussion";

    const currentTime = new Date();
    const expiresAtDate = addMinutes(currentTime, ROOM_DEFAULT_DURATION_MINUTES);

    const roomDataToCreate: any = {
      name: newRoomName.trim(),
      description: newRoomDescription.trim(),
      creatorId: currentUser.uid,
      creatorName: userData.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAtDate),
      image: imageUrl,
      imageAiHint: imageHint,
      participantCount: 0,
      maxParticipants: MAX_PARTICIPANTS_PER_ROOM,
    };

    if (gameConfigData?.isGameEnabled && typeof gameConfigData.questionIntervalSeconds === 'number' && gameConfigData.questionIntervalSeconds >= 30) {
      roomDataToCreate.gameInitialized = true;
      roomDataToCreate.nextGameQuestionTimestamp = Timestamp.fromDate(addSeconds(new Date(), gameConfigData.questionIntervalSeconds));
      roomDataToCreate.currentGameQuestionId = null;
    } else {
      roomDataToCreate.gameInitialized = false;
      roomDataToCreate.nextGameQuestionTimestamp = null;
      roomDataToCreate.currentGameQuestionId = null;
    }

    try {
      await addDoc(collection(db, "chatRooms"), roomDataToCreate);
      await updateUserDiamonds((userData.diamonds ?? 0) - ROOM_CREATION_COST);

      toast({ title: "Başarılı", description: `"${newRoomName}" odası oluşturuldu. ${ROOM_CREATION_COST} elmas harcandı.` });
      resetCreateRoomForm();
      setIsCreateModalOpen(false);
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
    if ((userData?.diamonds ?? 0) < ROOM_CREATION_COST) {
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

  const getExpiryInfo = (expiresAt: Timestamp | null | undefined): string => {
    if (!expiresAt) return "Süre bilgisi yok";
    const expiryDate = expiresAt.toDate();
    if (isPast(expiryDate)) {
      return "Süresi Doldu";
    }
    return `Kalan süre: ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };


  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Sohbet odaları yükleniyor...</p>
      </div>
    );
  }

  const activeChatRooms = chatRooms.filter(room => !(room.expiresAt && isPast(room.expiresAt.toDate())));
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
            <Card className="shadow-md bg-gradient-to-br from-primary/10 via-card to-accent/5 dark:from-primary/15 dark:via-card dark:to-accent/10 border-primary/15 overflow-hidden rounded-xl">
              <CardHeader className="p-4 pt-3 pb-2">
                <motion.div
                  className="flex justify-between items-start mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="h-5 w-5 text-primary" />
                    <CardTitle className="text-md font-semibold text-primary-foreground/90">
                      Sohbet Odalarını Keşfet!
                    </CardTitle>
                  </div>
                </motion.div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <motion.p
                  className="text-xs text-muted-foreground"
                >
                  Farklı konularda sohbetlere katıl, yeni insanlarla tanış veya kendi odanı oluşturup arkadaşlarını davet et. Her oda yeni bir macera!
                </motion.p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Sohbet Odaları</h1>
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
              <span className="ml-1.5 flex items-center text-xs text-yellow-300 dark:text-yellow-400 font-semibold">
                {ROOM_CREATION_COST}
                <Gem className="ml-1 h-3.5 w-3.5" />
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleCreateRoomSubmit}>
              <DialogHeader>
                <DialogTitle>Yeni Sohbet Odası Oluştur</DialogTitle>
                <DialogDescription>
                  Odanız için bir ad ve açıklama belirleyin. Oda oluşturmak {ROOM_CREATION_COST} elmasa mal olur ve {ROOM_DEFAULT_DURATION_MINUTES} dakika aktif kalır.
                  Maksimum katılımcı sayısı {MAX_PARTICIPANTS_PER_ROOM} kişidir. Mevcut elmasınız: {userData?.diamonds ?? 0}
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

                {!hasEnoughDiamonds && currentUser && (
                  <Card className="mt-4 border-orange-500/50 bg-orange-500/10 p-4">
                    <CardHeader className="p-0 mb-2">
                      <CardTitle className="text-base text-orange-700 dark:text-orange-400">Elmasların Yetersiz!</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-xs text-orange-600 dark:text-orange-300 mb-3">
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
                    !hasEnoughDiamonds
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

      {activeChatRooms.length === 0 && !loading ? (
        <Card className="col-span-full text-center py-10 sm:py-16 bg-card border border-border/20 rounded-xl shadow-lg">
            <CardHeader>
                <MessageSquare className="mx-auto h-16 w-16 sm:h-20 sm:w-20 text-primary/70 mb-4" />
                <CardTitle className="text-2xl sm:text-3xl font-semibold text-primary-foreground/90">Vuhu! Yeni Ufuklar Sizi Bekliyor!</CardTitle>
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
                    <span className="ml-1.5 flex items-center text-sm text-yellow-300 dark:text-yellow-200 font-semibold">
                      {ROOM_CREATION_COST}
                      <Gem className="ml-1 h-4 w-4" />
                    </span>
                  </Button>
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeChatRooms.map((room) => (
            <Card
              key={room.id}
              className="flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl bg-card border border-border/20 hover:border-primary/40 dark:border-border/10 dark:hover:border-primary/50 group"
            >
              <CardHeader className="pt-5 pb-3 sm:pt-6 sm:pb-4 relative">
                <CardTitle
                  className="text-lg sm:text-xl font-bold text-primary-foreground/90 group-hover:text-primary transition-colors truncate pr-10"
                  title={room.name}
                >
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
                <CardDescription className="h-10 text-xs sm:text-sm overflow-hidden text-ellipsis text-muted-foreground/80 group-hover:text-muted-foreground transition-colors mt-1.5" title={room.description}>
                  {room.description || "Açıklama yok."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-2 pb-3 sm:pb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <Badge variant="secondary" className="flex items-center gap-1.5 shadow-sm px-2.5 py-1">
                    <UsersRound className="h-3.5 w-3.5 text-primary/80" />
                    <span className="font-medium">{room.participantCount ?? 0} / {room.maxParticipants}</span>
                  </Badge>
                  <Badge
                    variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'}
                    className="flex items-center gap-1.5 shadow-sm px-2.5 py-1"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">{getExpiryInfo(room.expiresAt)}</span>
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/70 truncate">
                  Oluşturan: <span className="font-medium text-muted-foreground/90">{room.creatorName}</span>
                </p>
              </CardContent>
              <CardFooter className="p-3 sm:p-4 border-t bg-secondary/20 dark:bg-card/40 mt-auto">
                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/80 text-primary-foreground text-sm py-2.5 rounded-lg transition-transform group-hover:scale-105"
                  disabled={(room.participantCount != null && room.maxParticipants != null && room.participantCount >= room.maxParticipants)}
                >
                  <Link href={`/chat/${room.id}`}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {(room.participantCount != null && room.maxParticipants != null && room.participantCount >= room.maxParticipants ? "Oda Dolu" : "Sohbete Katıl")}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
    

    