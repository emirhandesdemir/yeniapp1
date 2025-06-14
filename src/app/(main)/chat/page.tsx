
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, LogIn, Loader2, MessageSquare, X, Clock, Gem, UsersRound } from "lucide-react"; // UsersRound eklendi
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, Timestamp, updateDoc, increment, writeBatch } from "firebase/firestore";
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
import { addMinutes, formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  image: string;
  imageAiHint: string;
  participantCount?: number;
  maxParticipants: number;
}

const placeholderImages = [
  { url: "https://placehold.co/600x400.png", hint: "abstract modern" },
  { url: "https://placehold.co/600x400.png", hint: "community discussion" },
  { url: "https://placehold.co/600x400.png", hint: "technology connection" },
  { url: "https://placehold.co/600x400.png", hint: "ideas meeting" },
  { url: "https://placehold.co/600x400.png", hint: "group chat" },
];

const ROOM_CREATION_COST = 1;
const ROOM_DEFAULT_DURATION_MINUTES = 20;
const MAX_PARTICIPANTS_PER_ROOM = 7;


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

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    document.title = 'Sohbet Odaları - Sohbet Küresi';
    const q = query(collection(db, "chatRooms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const rooms: ChatRoom[] = [];
      querySnapshot.forEach((doc) => {
        const roomData = doc.data() as ChatRoom; 
        // Süresi dolan odaları doğrudan filtrelemiyoruz, kartta farklı gösteriyoruz.
        // Eğer tamamen gizlenmesi isteniyorsa burada filtreleme yapılabilir.
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

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData) {
      toast({ title: "Hata", description: "Oda oluşturmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (userData.diamonds < ROOM_CREATION_COST) {
      toast({ title: "Yetersiz Elmas", description: `Oda oluşturmak için ${ROOM_CREATION_COST} elmasa ihtiyacınız var. Mevcut elmas: ${userData.diamonds}`, variant: "destructive" });
      return;
    }
    if (!newRoomName.trim()) {
      toast({ title: "Hata", description: "Oda adı boş olamaz.", variant: "destructive" });
      return;
    }
    setIsCreatingRoom(true);
    try {
      const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
      const currentTime = new Date();
      const expiresAtDate = addMinutes(currentTime, ROOM_DEFAULT_DURATION_MINUTES);
      
      const roomDataToCreate = {
        name: newRoomName.trim(),
        description: newRoomDescription.trim(),
        creatorId: currentUser.uid,
        creatorName: userData.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAtDate),
        image: randomImage.url,
        imageAiHint: randomImage.hint,
        participantCount: 0, 
        maxParticipants: MAX_PARTICIPANTS_PER_ROOM,
      };

      await addDoc(collection(db, "chatRooms"), roomDataToCreate);
      await updateUserDiamonds(userData.diamonds - ROOM_CREATION_COST);

      toast({ title: "Başarılı", description: `"${newRoomName}" odası oluşturuldu. ${ROOM_CREATION_COST} elmas harcandı.` });
      setNewRoomName("");
      setNewRoomDescription("");
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Error creating room: ", error);
      toast({ title: "Hata", description: "Oda oluşturulurken bir sorun oluştu. Lütfen konsolu kontrol edin.", variant: "destructive" });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Sohbet Odaları</h1>
          <p className="text-muted-foreground">İlgi alanlarınıza uygun odalara katılın veya kendi odanızı oluşturun.</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground animate-subtle-pulse w-full sm:w-auto" 
              disabled={!currentUser || isUserLoading || isUserDataLoading || (userData && userData.diamonds < ROOM_CREATION_COST) }
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Oda Oluştur (1 <Gem className="inline h-4 w-4 ml-1 mr-0.5 text-yellow-300 dark:text-yellow-400" />)
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateRoom}>
              <DialogHeader>
                <DialogTitle>Yeni Sohbet Odası Oluştur</DialogTitle>
                <DialogDescription>
                  Odanız için bir ad ve açıklama girin. Oda oluşturmak {ROOM_CREATION_COST} elmasa mal olur ve {ROOM_DEFAULT_DURATION_MINUTES} dakika aktif kalır.
                  Maksimum katılımcı sayısı {MAX_PARTICIPANTS_PER_ROOM} kişidir. Mevcut elmasınız: {userData?.diamonds ?? 0}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="roomName" className="text-right">
                    Oda Adı
                  </Label>
                  <Input
                    id="roomName"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="col-span-3"
                    required
                    disabled={isCreatingRoom}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="roomDescription" className="text-right">
                    Açıklama
                  </Label>
                  <Textarea
                    id="roomDescription"
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    className="col-span-3"
                    rows={3}
                    disabled={isCreatingRoom}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isCreatingRoom}>İptal</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={
                    isCreatingRoom || 
                    !currentUser || 
                    !userData || 
                    (userData.diamonds < ROOM_CREATION_COST)
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
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="text-center">Henüz Aktif Sohbet Odası Yok</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center">
                İlk sohbet odasını siz oluşturun veya mevcut odaların süresi dolmuş olabilir!
                </p>
                <div className="flex justify-center mt-4">
                <MessageSquare className="h-24 w-24 text-muted" />
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeChatRooms.map((room) => (
            <Card key={room.id} className={`flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 rounded-xl bg-card`}>
              <div className="relative h-40 sm:h-48 w-full">
                <Image
                  src={room.image || "https://placehold.co/600x400.png"}
                  alt={room.name}
                  layout="fill"
                  objectFit="cover"
                  className="rounded-t-xl"
                  data-ai-hint={room.imageAiHint || "chat fun"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-xl"></div>
                 {currentUser && room.creatorId === currentUser.uid && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 z-10 h-7 w-7 sm:h-8 sm:w-8 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault(); 
                      e.stopPropagation();
                      handleDeleteRoom(room.id, room.name);
                    }}
                    aria-label="Odayı Sil"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                )}
                 <Badge variant="secondary" className="absolute bottom-2 left-2 flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5" /> 
                    {room.participantCount ?? 0} / {room.maxParticipants}
                </Badge>
              </div>
              <CardHeader className="pt-3 sm:pt-4 pb-2 sm:pb-3">
                <CardTitle className="text-lg sm:text-xl font-semibold text-primary-foreground/90 truncate" title={room.name}>{room.name}</CardTitle>
                <CardDescription className="h-10 text-xs sm:text-sm overflow-hidden text-ellipsis">{room.description || "Açıklama yok."}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-1 sm:pt-2 pb-3 sm:pb-4">
                <p className="text-xs text-muted-foreground mt-1 truncate">Oluşturan: {room.creatorName}</p>
                <div className="flex items-center text-xs text-muted-foreground mt-1.5 sm:mt-2">
                  <Clock className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {getExpiryInfo(room.expiresAt)}
                </div>
              </CardContent>
              <CardFooter className="p-3 sm:p-4">
                <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" 
                  disabled={(room.participantCount != null && room.maxParticipants != null && room.participantCount >= room.maxParticipants)}
                >
                  <Link href={`/chat/${room.id}`}>
                    <LogIn className="mr-2 h-4 w-4" /> 
                    {(room.participantCount != null && room.maxParticipants != null && room.participantCount >= room.maxParticipants ? "Oda Dolu" : "Odaya Katıl")}
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

    
