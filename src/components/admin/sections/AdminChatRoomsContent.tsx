
"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, Timestamp, query, orderBy, where } from "firebase/firestore"; 
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Users, Clock, ListChecks as AdminListChecksIcon, ShieldAlert, AlertTriangle, Info } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteChatRoomAndSubcollections } from "@/lib/firestoreUtils";

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

export default function AdminChatRoomsContent() {
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
  }, [adminUserData, toast]);

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    setProcessingDelete(roomId);
    try {
      await deleteChatRoomAndSubcollections(roomId);
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
      const currentTime = Timestamp.now();
      const q = query(roomsCollectionRef, where("expiresAt", "<", currentTime));
      const expiredRoomsSnapshot = await getDocs(q);

      if (expiredRoomsSnapshot.empty) {
        toast({ title: "Bilgi", description: "Silinecek süresi dolmuş oda bulunamadı." });
        setProcessingBulkDelete(false);
        return;
      }
      
      const deletePromises = expiredRoomsSnapshot.docs.map(async (roomDoc) => {
        await deleteChatRoomAndSubcollections(roomDoc.id);
        deletedCount++;
      });

      await Promise.all(deletePromises);

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
     <div className="flex flex-1 items-center justify-center p-8">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Oda yönetimi yükleniyor...</p>
     </div>
   );
 }

 if (adminUserData?.role !== 'admin' && !loading) {
    return (
     <div className="flex flex-1 items-center justify-center p-8">
       <Card className="w-full max-w-md text-center p-6 shadow-lg">
           <CardHeader>
               <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
               <CardTitle>Erişim Reddedildi</CardTitle>
               <CardDescription>Bu bölümü görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
           </CardHeader>
       </Card>
     </div>
   );
 }

 if (loading) {
   return (
     <div className="flex flex-1 items-center justify-center p-8">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Sohbet odaları yükleniyor...</p>
     </div>
   );
 }


  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/40">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] sm:w-[70px]">Resim</TableHead>
                    <TableHead>Oda Adı</TableHead>
                    <TableHead className="hidden md:table-cell">Açıklama</TableHead>
                    <TableHead>Oluşturan</TableHead>
                    <TableHead className="text-center">Katılımcı</TableHead>
                    <TableHead>Süre</TableHead>
                    <TableHead className="hidden lg:table-cell">Oluşturulma</TableHead>
                    <TableHead className="text-right">Eylemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chatRooms.map((room) => (
                    <TableRow key={room.id} className={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'opacity-60' : ''}>
                      <TableCell>
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 rounded-md">
                          <AvatarImage src={room.image || `https://placehold.co/40x40.png`} data-ai-hint="chat room icon" />
                          <AvatarFallback>{getAvatarFallbackText(room.name)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{room.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                          {room.description ? (
                              <TooltipProvider delayDuration={100}>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <p className="truncate max-w-[120px] xl:max-w-[200px] text-xs text-muted-foreground cursor-help flex items-center">
                                              <Info className="h-3 w-3 mr-1 flex-shrink-0"/> {room.description}
                                          </p>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs bg-popover text-popover-foreground p-2 rounded shadow-lg border">
                                          <p className="text-xs">{room.description}</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                          ) : (
                              <span className="text-xs text-muted-foreground/70 italic">Yok</span>
                          )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{room.creatorName || room.creatorId.substring(0,8)}...</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="flex items-center justify-center gap-1 w-fit mx-auto text-xs">
                          <Users className="h-3 w-3" /> {room.participantCount ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                          <Badge 
                              variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'} 
                              className="flex items-center gap-1 w-fit text-xs"
                          >
                              <Clock className="h-3 w-3" /> {getExpiryInfo(room.expiresAt)}
                          </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {room.createdAt instanceof Timestamp 
                          ? room.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric'}) 
                          : 'Bilinmiyor'}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="xs" className="h-7 px-2 sm:h-8 sm:px-3" disabled={processingDelete === room.id || processingBulkDelete}>
                              {processingDelete === room.id ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
