
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, LogIn, Loader2, MessageSquare, X, Clock, Gem, UsersRound, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef, ChangeEvent } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
];
const defaultRoomImage = placeholderImages[0];

const ROOM_CREATION_COST = 1;
const ROOM_DEFAULT_DURATION_MINUTES = 20;
const MAX_PARTICIPANTS_PER_ROOM = 7;


export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [newRoomImageFile, setNewRoomImageFile] = useState<File | null>(null);
  const [newRoomImagePreview, setNewRoomImagePreview] = useState<string | null>(defaultRoomImage.url);
  const roomImageInputRef = useRef<HTMLInputElement>(null);
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

  const handleRoomImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Dosya Çok Büyük", description: "Lütfen 5MB'den küçük bir resim seçin.", variant: "destructive"});
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir resim dosyası (JPEG, PNG, GIF, WebP) seçin.", variant: "destructive"});
        return;
      }
      setNewRoomImageFile(file);
      setNewRoomImagePreview(URL.createObjectURL(file));
    }
  };

  const resetCreateRoomForm = () => {
    setNewRoomName("");
    setNewRoomDescription("");
    setNewRoomImageFile(null);
    setNewRoomImagePreview(defaultRoomImage.url);
    if (roomImageInputRef.current) {
      roomImageInputRef.current.value = "";
    }
  };


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
    console.log("[ChatPage] Starting room creation...");

    let imageUrl = defaultRoomImage.url;
    let imageHint = defaultRoomImage.hint;

    try {
      if (newRoomImageFile) {
        console.log("[ChatPage] Room image file provided, attempting upload...");
        const file = newRoomImageFile;
        const fileExtension = file.name.split('.').pop();
        const imageFileName = `${currentUser.uid}_${Date.now()}.${fileExtension}`;
        const roomImageRef = storageRef(storage, `chat_room_images/${imageFileName}`);
        const uploadTask = uploadBytesResumable(roomImageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log('[ChatPage] Upload is ' + progress + '% done');
            },
            (error) => {
              console.error("[ChatPage] Room image upload Firebase error:", error);
              toast({ title: "Oda Resmi Yükleme Hatası", description: `Firebase hatası: ${error.code || error.message}`, variant: "destructive" });
              reject(error);
            },
            async () => {
              try {
                console.log("[ChatPage] Upload complete, getting download URL...");
                imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                imageHint = "custom room image";
                console.log("[ChatPage] Room image uploaded and URL obtained:", imageUrl);
                resolve();
              } catch (urlError: any) {
                console.error("[ChatPage] Room image getDownloadURL error:", urlError);
                toast({ title: "Oda Resmi URL Hatası", description: `URL alınamadı: ${urlError.code || urlError.message}`, variant: "destructive" });
                reject(urlError);
              }
            }
          );
        });
      }

      const currentTime = new Date();
      const expiresAtDate = addMinutes(currentTime, ROOM_DEFAULT_DURATION_MINUTES);

      const roomDataToCreate = {
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
      console.log("[ChatPage] Creating room document with data:", roomDataToCreate);
      await addDoc(collection(db, "chatRooms"), roomDataToCreate);
      await updateUserDiamonds(userData.diamonds - ROOM_CREATION_COST);

      toast({ title: "Başarılı", description: `"${newRoomName}" odası oluşturuldu. ${ROOM_CREATION_COST} elmas harcandı.` });
      resetCreateRoomForm();
      setIsCreateModalOpen(false);
      console.log("[ChatPage] Room creation successful.");
    } catch (error: any) {
      console.error("[ChatPage] Error creating room (outer catch):", error);
       if (!(error.message?.includes("Oda Resmi Yükleme Hatası") || error.message?.includes("Oda Resmi URL Hatası"))) {
         toast({ title: "Hata", description: `Oda oluşturulurken bir sorun oluştu: ${error.code || error.message}`, variant: "destructive" });
      }
    } finally {
      console.log("[ChatPage] Ending room creation process. Setting isCreatingRoom to false.");
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
        <Dialog open={isCreateModalOpen} onOpenChange={(isOpen) => {
            setIsCreateModalOpen(isOpen);
            if (!isOpen) resetCreateRoomForm();
        }}>
          <DialogTrigger asChild>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground animate-subtle-pulse w-full sm:w-auto"
              disabled={!currentUser || isUserLoading || isUserDataLoading || (userData && userData.diamonds < ROOM_CREATION_COST) }
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Oda Oluştur (1 <Gem className="inline h-4 w-4 ml-1 mr-0.5 text-yellow-300 dark:text-yellow-400" />)
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <form onSubmit={handleCreateRoom}>
              <DialogHeader>
                <DialogTitle>Yeni Sohbet Odası Oluştur</DialogTitle>
                <DialogDescription>
                  Odanız için bir ad, açıklama ve resim belirleyin. Oda oluşturmak {ROOM_CREATION_COST} elmasa mal olur ve {ROOM_DEFAULT_DURATION_MINUTES} dakika aktif kalır.
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roomDescription">Açıklama</Label>
                  <Textarea
                    id="roomDescription"
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    rows={2}
                    disabled={isCreatingRoom}
                  />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="roomImage">Oda Resmi (İsteğe Bağlı)</Label>
                    <div className="flex items-center gap-4">
                        {newRoomImagePreview && (
                            <Image
                                src={newRoomImagePreview}
                                alt="Oda resmi önizlemesi"
                                width={80}
                                height={80}
                                className="rounded-md border object-cover aspect-square"
                                data-ai-hint="room preview image"
                            />
                        )}
                        <Button type="button" variant="outline" onClick={() => roomImageInputRef.current?.click()} disabled={isCreatingRoom}>
                            <UploadCloud className="mr-2 h-4 w-4" /> Resim Seç
                        </Button>
                    </div>
                    <input
                        type="file"
                        id="roomImage"
                        ref={roomImageInputRef}
                        className="hidden"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleRoomImageChange}
                        disabled={isCreatingRoom}
                    />
                    <p className="text-xs text-muted-foreground">Max 5MB. Önerilen boyut: 600x400.</p>
                </div>
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
                  src={room.image || defaultRoomImage.url}
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

    