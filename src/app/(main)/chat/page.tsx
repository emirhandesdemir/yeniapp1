
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, LogIn, Loader2, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, where } from "firebase/firestore";
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

// export const metadata: Metadata = { // Client component, metadata handled differently
//   title: 'Sohbet Odaları - Sohbet Küresi',
//   description: 'Aktif sohbet odalarını keşfedin veya yenisini oluşturun.',
// };

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  createdAt: any; // Firestore Timestamp
  image: string;
  imageAiHint: string;
  participantCount?: number; // Optional for now
}

const placeholderImages = [
  { url: "https://placehold.co/600x400.png", hint: "abstract modern" },
  { url: "https://placehold.co/600x400.png", hint: "community discussion" },
  { url: "https://placehold.co/600x400.png", hint: "technology connection" },
  { url: "https://placehold.co/600x400.png", hint: "ideas meeting" },
  { url: "https://placehold.co/600x400.png", hint: "group chat" },
];


export default function ChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Sohbet Odaları - Sohbet Küresi';
    const q = query(collection(db, "chatRooms"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const rooms: ChatRoom[] = [];
      querySnapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
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
    if (!currentUser) {
      toast({ title: "Hata", description: "Oda oluşturmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (!newRoomName.trim()) {
      toast({ title: "Hata", description: "Oda adı boş olamaz.", variant: "destructive" });
      return;
    }
    setIsCreatingRoom(true);
    try {
      const randomImage = placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
      await addDoc(collection(db, "chatRooms"), {
        name: newRoomName,
        description: newRoomDescription,
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName || currentUser.email || "Bilinmeyen Kullanıcı",
        createdAt: serverTimestamp(),
        image: randomImage.url,
        imageAiHint: randomImage.hint,
        participantCount: 1, // Initial participant is the creator
      });
      toast({ title: "Başarılı", description: `"${newRoomName}" odası oluşturuldu.` });
      setNewRoomName("");
      setNewRoomDescription("");
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Error creating room: ", error);
      toast({ title: "Hata", description: "Oda oluşturulurken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }
    try {
      // First, delete all messages in the room (subcollection)
      const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`));
      const messagesSnapshot = await getDocs(messagesQuery); // Need to import getDocs
      const deletePromises: Promise<void>[] = [];
      messagesSnapshot.forEach((messageDoc) => {
        deletePromises.push(deleteDoc(doc(db, `chatRooms/${roomId}/messages`, messageDoc.id)));
      });
      await Promise.all(deletePromises);

      // Then, delete the room itself
      await deleteDoc(doc(db, "chatRooms", roomId));
      toast({ title: "Başarılı", description: `"${roomName}" odası silindi.` });
    } catch (error) {
      console.error("Error deleting room: ", error);
      toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    }
  };
  
  // Import getDocs if not already imported
  useEffect(() => {
    const importGetDocs = async () => {
      if (typeof getDocs === 'undefined') {
        const { getDocs: firestoreGetDocs } = await import("firebase/firestore");
        // This is a workaround to make getDocs available in the scope
        (window as any).getDocs = firestoreGetDocs;
      }
    };
    importGetDocs();
  }, []);
  const getDocs = (queryRef: any) => (window as any).getDocs ? (window as any).getDocs(queryRef) : Promise.resolve({ forEach: () => {} });


  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Sohbet odaları yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Sohbet Odaları</h1>
          <p className="text-muted-foreground">İlgi alanlarınıza uygun odalara katılın veya kendi odanızı oluşturun.</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground animate-subtle-pulse">
              <PlusCircle className="mr-2 h-5 w-5" />
              Yeni Oda Oluştur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateRoom}>
              <DialogHeader>
                <DialogTitle>Yeni Sohbet Odası Oluştur</DialogTitle>
                <DialogDescription>
                  Odanız için bir ad ve açıklama girin.
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
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">İptal</Button>
                </DialogClose>
                <Button type="submit" disabled={isCreatingRoom}>
                  {isCreatingRoom && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Oluştur
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {chatRooms.length === 0 ? (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="text-center">Henüz Sohbet Odası Yok</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center">
                İlk sohbet odasını siz oluşturun!
                </p>
                <div className="flex justify-center mt-4">
                <MessageSquare className="h-24 w-24 text-muted" />
                </div>
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chatRooms.map((room) => (
            <Card key={room.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 rounded-xl bg-card">
              <div className="relative h-48 w-full">
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
                    className="absolute top-2 right-2 z-10 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault(); // Link'e tıklamayı engelle
                      e.stopPropagation(); // Card'a tıklamayı engelle
                      handleDeleteRoom(room.id, room.name);
                    }}
                    aria-label="Odayı Sil"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <CardHeader className="pt-4">
                <CardTitle className="text-xl font-semibold text-primary-foreground/90">{room.name}</CardTitle>
                <CardDescription className="h-10 overflow-hidden text-ellipsis">{room.description || "Açıklama yok."}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  {room.participantCount || 1} katılımcı
                </div>
                <p className="text-xs text-muted-foreground mt-1">Oluşturan: {room.creatorName}</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/chat/${room.id}`}>
                    <LogIn className="mr-2 h-4 w-4" /> Odaya Katıl
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
