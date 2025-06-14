
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
  query,
  orderBy,
  updateDoc,
  getDocs as getSubDocs,
} from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Users, Clock, Edit, ShieldQuestion, Gem, UserCog as AdminUserCogIcon, ListChecks as AdminListChecksIcon, ShieldCheck } from "lucide-react"; // Renamed icons to avoid conflict
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const { currentUser: adminAuthUser, userData: adminUserData } = useAuth(); // Renamed for clarity

  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [chatRooms, setChatRooms] = useState<ChatRoomAdminView[]>([]);
  const [loadingChatRooms, setLoadingChatRooms] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isEditDiamondsDialogOpen, setIsEditDiamondsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [diamondAdjustment, setDiamondAdjustment] = useState<number>(0);
  const [processingUserAction, setProcessingUserAction] = useState(false);
  const [processingDeleteRoom, setProcessingDeleteRoom] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Users
  useEffect(() => {
    const fetchUsers = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoadingUsers(false);
        return;
      }
      setLoadingUsers(true);
      try {
        const usersCollectionRef = collection(db, "users");
        const q = query(usersCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const usersList = querySnapshot.docs.map(docSnapshot => ({
          uid: docSnapshot.id,
          ...docSnapshot.data(),
        } as UserData));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({ title: "Hata", description: "Kullanıcılar yüklenirken bir sorun oluştu.", variant: "destructive" });
      } finally {
        setLoadingUsers(false);
      }
    };

    if (adminUserData?.role === 'admin') {
      fetchUsers();
    } else if (adminUserData !== undefined) {
      setLoadingUsers(false);
    }
  }, [adminUserData, toast]);

  // Fetch Chat Rooms
  useEffect(() => {
    const fetchChatRooms = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoadingChatRooms(false);
        return;
      }
      setLoadingChatRooms(true);
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
        toast({ title: "Hata", description: "Sohbet odaları yüklenirken bir sorun oluştu.", variant: "destructive" });
      } finally {
        setLoadingChatRooms(false);
      }
    };
    if (adminUserData?.role === 'admin') {
      fetchChatRooms();
    } else if (adminUserData !== undefined) {
      setLoadingChatRooms(false);
    }
  }, [adminUserData, toast]);


  const handleOpenEditRoleDialog = (user: UserData) => {
    setSelectedUser(user);
    setNewRole(user.role || 'user');
    setIsEditRoleDialogOpen(true);
  };

  const handleOpenEditDiamondsDialog = (user: UserData) => {
    setSelectedUser(user);
    setDiamondAdjustment(0);
    setIsEditDiamondsDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;
    setProcessingUserAction(true);
    try {
      const userDocRef = doc(db, "users", selectedUser.uid);
      await updateDoc(userDocRef, { role: newRole });
      setUsers(prevUsers => prevUsers.map(u => u.uid === selectedUser.uid ? { ...u, role: newRole } : u));
      toast({ title: "Başarılı", description: `${selectedUser.displayName || selectedUser.email || selectedUser.uid}' kullanıcısının rolü güncellendi.` });
      setIsEditRoleDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating role:", error);
      toast({ title: "Hata", description: "Kullanıcı rolü güncellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingUserAction(false);
    }
  };

  const handleUpdateDiamonds = async () => {
    if (!selectedUser || typeof diamondAdjustment !== 'number') return;
    setProcessingUserAction(true);
    try {
      const userDocRef = doc(db, "users", selectedUser.uid);
      const currentDiamonds = selectedUser.diamonds || 0;
      const updatedDiamonds = Math.max(0, currentDiamonds + diamondAdjustment);
      await updateDoc(userDocRef, { diamonds: updatedDiamonds });
      setUsers(prevUsers => prevUsers.map(u => u.uid === selectedUser.uid ? { ...u, diamonds: updatedDiamonds } : u));
      toast({ title: "Başarılı", description: `${selectedUser.displayName || selectedUser.email || selectedUser.uid}' kullanıcısının elmasları güncellendi.` });
      setIsEditDiamondsDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating diamonds:", error);
      toast({ title: "Hata", description: "Kullanıcı elmasları güncellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingUserAction(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    setProcessingDeleteRoom(roomId);
    try {
      const messagesQuery = query(collection(db, `chatRooms/${roomId}/messages`));
      const messagesSnapshot = await getSubDocs(messagesQuery);
      const deleteMessagePromises: Promise<void>[] = [];
      messagesSnapshot.forEach((messageDoc) => {
        deleteMessagePromises.push(deleteDoc(doc(db, `chatRooms/${roomId}/messages`, messageDoc.id)));
      });
      await Promise.all(deleteMessagePromises);
      await deleteDoc(doc(db, "chatRooms", roomId));
      setChatRooms(prevRooms => prevRooms.filter(room => room.id !== roomId));
      toast({ title: "Başarılı", description: `"${roomName}" odası ve tüm mesajları silindi.` });
    } catch (error) {
      console.error("Error deleting room:", error);
      toast({ title: "Hata", description: "Oda silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingDeleteRoom(null);
    }
  };
  
  const getAvatarFallbackText = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "PN";
  };

  const getRoomAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "O";
  };

  const getExpiryInfo = (expiresAt?: Timestamp): string => {
    if (!expiresAt) return "Süresiz";
    const expiryDate = expiresAt.toDate();
    if (isPast(expiryDate)) return "Süresi Doldu";
    return `Kalan: ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: tr })}`;
  };

  if (adminUserData === undefined || adminUserData === null) { // Ensure adminUserData is loaded
     return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Admin verileri yükleniyor...</p>
      </div>
    );
  }

  if (adminUserData?.role !== 'admin') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
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

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <div>
            <CardTitle className="text-3xl font-headline text-primary-foreground/90">Admin Paneli</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Uygulama ayarlarını ve içeriğini buradan yönetin.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="user-management" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
          <TabsTrigger value="user-management"><AdminUserCogIcon className="mr-2 h-4 w-4" /> Kullanıcı Yönetimi</TabsTrigger>
          <TabsTrigger value="room-management"><AdminListChecksIcon className="mr-2 h-4 w-4" /> Oda Yönetimi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="user-management" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Kullanıcılar</CardTitle>
              <CardDescription>Uygulamadaki tüm kullanıcıları görüntüleyin ve rollerini yönetin.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz kayıtlı kullanıcı bulunmamaktadır.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Avatar</TableHead>
                      <TableHead>Kullanıcı Adı</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead className="text-center">Elmas</TableHead>
                      <TableHead className="text-center">Rol</TableHead>
                      <TableHead>Kayıt Tarihi</TableHead>
                      <TableHead className="text-right">Eylemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar list" />
                            <AvatarFallback>{getAvatarFallbackText(user.displayName, user.email)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{user.displayName || "İsimsiz"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="flex items-center justify-center gap-1 w-fit mx-auto">
                            <Gem className="h-3 w-3 text-yellow-500" /> {user.diamonds ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className={user.role === 'admin' ? 'bg-primary text-primary-foreground' : ''}>
                            {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.createdAt instanceof Timestamp
                            ? user.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : user.createdAt ? new Date(user.createdAt as any).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Bilinmiyor'}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditRoleDialog(user)} aria-label="Rolü Düzenle" className="hover:text-primary" disabled={user.uid === adminAuthUser?.uid || processingUserAction}>
                            <AdminUserCogIcon className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditDiamondsDialog(user)} aria-label="Elmasları Düzenle" className="hover:text-yellow-500" disabled={processingUserAction}>
                            <Gem className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="room-management" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sohbet Odaları</CardTitle>
              <CardDescription>Uygulamadaki tüm sohbet odalarını görüntüleyin ve yönetin.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChatRooms ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : chatRooms.length === 0 ? (
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
                            <AvatarFallback>{getRoomAvatarFallbackText(room.name)}</AvatarFallback>
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
                          <Badge variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'} className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" /> {getExpiryInfo(room.expiresAt)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {room.createdAt instanceof Timestamp
                            ? room.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Bilinmiyor'}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={processingDeleteRoom === room.id}>
                                {processingDeleteRoom === room.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                                <AlertDialogCancel disabled={!!processingDeleteRoom}>İptal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRoom(room.id, room.name)}
                                  disabled={!!processingDeleteRoom}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  {processingDeleteRoom === room.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        </TabsContent>
      </Tabs>

      {/* User Edit Dialogs */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Rolünü Düzenle</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                {selectedUser.displayName || selectedUser.email || selectedUser.uid} kullanıcısının rolünü değiştirin.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="role-select">Rol</Label>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as 'user' | 'admin')}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Rol Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Kullanıcı</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={processingUserAction}>İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateRole} disabled={processingUserAction}>
              {processingUserAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDiamondsDialogOpen} onOpenChange={setIsEditDiamondsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Elmaslarını Düzenle</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                {selectedUser.displayName || selectedUser.email || selectedUser.uid} kullanıcısının elmas sayısını düzenleyin. Mevcut: {selectedUser.diamonds ?? 0}.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="diamond-adjustment">Eklenecek/Çıkarılacak Elmas</Label>
            <Input
              id="diamond-adjustment"
              type="number"
              value={diamondAdjustment}
              onChange={(e) => setDiamondAdjustment(parseInt(e.target.value, 10) || 0)}
              placeholder="Örn: 10 veya -5"
            />
            {selectedUser && (
                <p className="text-sm text-muted-foreground">
                Sonuç: {Math.max(0, (selectedUser.diamonds ?? 0) + diamondAdjustment)} elmas. (Minimum 0)
                </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={processingUserAction}>İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateDiamonds} disabled={processingUserAction}>
              {processingUserAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    