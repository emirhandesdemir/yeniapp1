
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, Timestamp, query, orderBy, writeBatch, where } from "firebase/firestore"; 
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Users, Clock, ListChecks as AdminListChecksIcon, ShieldAlert, AlertTriangle } from "lucide-react"; // Renamed ListChecks
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';

interface ChatRoomAdminView {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  creatorName?: string; 
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  participantCount?: number;
  image?: string;
}

export default function AdminChatRoomsPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoomAdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();
  const [now, setNow] = useState(new Date());
  const [processingDelete, setProcessingDelete] = useState<string | null>(null);
  const [processingBulkDelete, setProcessingBulkDelete] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchChatRooms = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const roomsCollectionRef = collection(db, "chatRooms");
        const q = query(roomsCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const roomsList = querySnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        } as ChatRoomAdminView));
        setChatRooms(roomsList);
      } catch (error) {
        console.error("Error fetching chat rooms:", error);
        toast({
          title: "Hata",
          description: "Sohbet odaları yüklenirken bir sorun oluştu.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (adminUserData?.role === 'admin') {
        fetchChatRooms();
    } else if (adminUserData !== undefined) {
        setLoading(false);
    }
  }, [toast, adminUserData]);

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    setProcessingDelete(roomId);
    const batch = writeBatch(db);
    try {
      // Delete messages sub-collection
      const messagesRef = collection(db, `chatRooms/${roomId}/messages`);
      const messagesSnap = await getDocs(messagesRef);
      messagesSnap.forEach(msgDoc => batch.delete(msgDoc.ref));

      // Delete participants sub-collection
      const participantsRef = collection(db, `chatRooms/${roomId}/participants`);
      const participantsSnap = await getDocs(participantsRef);
      participantsSnap.forEach(partDoc => batch.delete(partDoc.ref));
      
      // Delete the room document itself
      batch.delete(doc(db, "chatRooms", roomId));

      await batch.commit();

      setChatRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
      toast({ title: "Başarılı", description: `"${roomName}" odası ve tüm içeriği silindi.` });
    } catch (error) {
      console.error("Error deleting room:", error);
      toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingDelete(null);
    }
  };

  const handleBulkDeleteExpiredRooms = async () => {
    if (!confirm("Süresi dolmuş tüm sohbet odalarını ve içeriklerini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }
    setProcessingBulkDelete(true);
    let deletedCount = 0;
    try {
      const roomsCollectionRef = collection(db, "chatRooms");
      // Firestore'da `Timestamp.now()` doğrudan query'de kullanılamaz, bu yüzden client-side'da anlık zaman damgası oluşturuyoruz.
      const currentTime = Timestamp.now();
      const q = query(roomsCollectionRef, where("expiresAt", "<", currentTime));
      const expiredRoomsSnapshot = await getDocs(q);

      if (expiredRoomsSnapshot.empty) {
        toast({ title: "Bilgi", description: "Silinecek süresi dolmuş oda bulunamadı." });
        setProcessingBulkDelete(false);
        return;
      }
      
      const batchPromises = expiredRoomsSnapshot.docs.map(async (roomDoc) => {
        const batch = writeBatch(db);
        const roomId = roomDoc.id;
        
        const messagesRef = collection(db, `chatRooms/${roomId}/messages`);
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.forEach(msgDoc => batch.delete(msgDoc.ref));

        const participantsRef = collection(db, `chatRooms/${roomId}/participants`);
        const participantsSnap = await getDocs(participantsRef);
        participantsSnap.forEach(partDoc => batch.delete(partDoc.ref));
        
        batch.delete(doc(db, "chatRooms", roomId));
        await batch.commit();
        deletedCount++;
      });

      await Promise.all(batchPromises);

      // Update local state
      setChatRooms(prevRooms => prevRooms.filter(room => 
        !expiredRoomsSnapshot.docs.some(expiredDoc => expiredDoc.id === room.id)
      ));

      toast({ title: "Başarılı", description: `${deletedCount} süresi dolmuş oda silindi.` });
    } catch (error) {
      console.error("Error bulk deleting expired rooms:", error);
      toast({ title: "Hata", description: "Süresi dolmuş odalar silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingBulkDelete(false);
    }
  };


  const getExpiryInfo = (expiresAt?: Timestamp): string => {
    if (!expiresAt) return "Süresiz";
    const expiryDate = expiresAt.toDate();
    if (isPast(expiryDate)) {
      return "Süresi Doldu";
    }
    return `Kalan: ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };
  
  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "O";
  };


  if (adminUserData === undefined || adminUserData === null && loading) {
    return (
     <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-theme(spacing.20))]">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Oda yönetimi yükleniyor...</p>
     </div>
   );
 }

 if (adminUserData?.role !== 'admin') {
    return (
     <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-theme(spacing.20))]">
       <Card className="w-full max-w-md text-center p-6 shadow-lg">
           <CardHeader>
               <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
               <CardTitle>Erişim Reddedildi</CardTitle>
               <CardDescription>Bu sayfayı görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
           </CardHeader>
       </Card>
     </div>
   );
 }

 if (loading) { // admin yetkisi var ama veriler yükleniyor
   return (
     <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-theme(spacing.20))]">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Sohbet odaları yükleniyor...</p>
     </div>
   );
 }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <AdminListChecksIcon className="h-7 w-7 text-primary" />
              <CardTitle className="text-2xl font-headline">Oda Yönetimi</CardTitle>
            </div>
            <CardDescription>Uygulamadaki tüm sohbet odalarını görüntüleyin ve yönetin.</CardDescription>
          </div>
          <Button onClick={handleBulkDeleteExpiredRooms} variant="outline" disabled={processingBulkDelete || loading} className="w-full sm:w-auto">
            {processingBulkDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <AlertTriangle className="mr-2 h-4 w-4 text-orange-500"/>
            Süresi Dolan Odaları Sil
          </Button>
        </CardHeader>
        <CardContent>
          {chatRooms.length === 0 && !loading ? (
            <p className="text-muted-foreground text-center py-8">Henüz oluşturulmuş sohbet odası bulunmamaktadır.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Resim</TableHead>
                  <TableHead>Oda Adı</TableHead>
                  <TableHead>Oluşturan</TableHead>
                  <TableHead className="text-center">Katılımcı</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatRooms.map((room) => (
                  <TableRow key={room.id} className={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'opacity-60' : ''}>
                    <TableCell>
                      <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage src={room.image || `https://placehold.co/40x40.png`} data-ai-hint="chat room icon" />
                        <AvatarFallback>{getAvatarFallbackText(room.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>{room.creatorName || room.creatorId.substring(0,8)}...</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="flex items-center justify-center gap-1 w-fit mx-auto">
                        <Users className="h-3 w-3" /> {room.participantCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        <Badge 
                            variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'} 
                            className="flex items-center gap-1 w-fit"
                        >
                            <Clock className="h-3 w-3" /> {getExpiryInfo(room.expiresAt)}
                        </Badge>
                    </TableCell>
                    <TableCell>
                      {room.createdAt instanceof Timestamp 
                        ? room.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric'}) 
                        : 'Bilinmiyor'}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={processingDelete === room.id || processingBulkDelete}>
                            {processingDelete === room.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">Sil</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{room.name}" adlı sohbet odasını ve içindeki tüm mesajları kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={!!processingDelete || processingBulkDelete}>İptal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRoom(room.id, room.name)}
                              disabled={!!processingDelete || processingBulkDelete}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              {(processingDelete === room.id) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Evet, Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
