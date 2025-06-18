
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Gem, UserCog as AdminUserCogIcon, ShieldAlert, Star, Users } from "lucide-react"; 
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
import { addDays, format } from 'date-fns'; 
import { tr } from 'date-fns/locale'; 

export default function AdminUsersContent() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser: adminAuthUser, userData: adminUserData } = useAuth();

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isEditDiamondsDialogOpen, setIsEditDiamondsDialogOpen] = useState(false);
  const [isEditPremiumDialogOpen, setIsEditPremiumDialogOpen] = useState(false); 
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPremiumStatus, setNewPremiumStatus] = useState<'none' | 'weekly' | 'monthly'>('none'); 
  const [diamondAdjustment, setDiamondAdjustment] = useState<number>(0);
  const [processingAction, setProcessingAction] = useState(false);


  useEffect(() => {
    const fetchUsers = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoading(false);
        return;
      }
      setLoading(true);
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
        toast({
          title: "Hata",
          description: "Kullanıcılar yüklenirken bir sorun oluştu.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (adminUserData?.role === 'admin') {
        fetchUsers();
    } else if (adminUserData !== undefined) { 
        setLoading(false);
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

  const handleOpenEditPremiumDialog = (user: UserData) => {
    setSelectedUser(user);
    setNewPremiumStatus(user.premiumStatus || 'none');
    setIsEditPremiumDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;
    setProcessingAction(true);
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
      setProcessingAction(false);
    }
  };

  const handleUpdateDiamonds = async () => {
    if (!selectedUser || typeof diamondAdjustment !== 'number') return;
    setProcessingAction(true);
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
      setProcessingAction(false);
    }
  };

  const handleUpdatePremiumStatus = async () => {
    if (!selectedUser || !newPremiumStatus) return;
    setProcessingAction(true);
    try {
      const userDocRef = doc(db, "users", selectedUser.uid);
      let newExpiryDate: Timestamp | null = null;

      if (newPremiumStatus === 'weekly') {
        newExpiryDate = Timestamp.fromDate(addDays(new Date(), 7));
      } else if (newPremiumStatus === 'monthly') {
        newExpiryDate = Timestamp.fromDate(addDays(new Date(), 30));
      }

      await updateDoc(userDocRef, { 
        premiumStatus: newPremiumStatus,
        premiumExpiryDate: newExpiryDate 
      });
      
      setUsers(prevUsers => prevUsers.map(u => 
        u.uid === selectedUser.uid ? { ...u, premiumStatus: newPremiumStatus, premiumExpiryDate: newExpiryDate } : u
      ));
      toast({ title: "Başarılı", description: `${selectedUser.displayName || selectedUser.email || selectedUser.uid}' kullanıcısının premium durumu güncellendi.` });
      setIsEditPremiumDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error updating premium status:", error);
      toast({ title: "Hata", description: "Kullanıcı premium durumu güncellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setProcessingAction(false);
    }
  };


  const getAvatarFallbackText = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "PN";
  };

  const formatPremiumExpiry = (timestamp: Timestamp | null | undefined) => {
    if (!timestamp) return "Yok";
    return format(timestamp.toDate(), "dd MMM yyyy, HH:mm", { locale: tr });
  };

  if (adminUserData === undefined || adminUserData === null && loading) {
     return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Kullanıcı yönetimi yükleniyor...</p>
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
        <p className="ml-2 text-lg">Kullanıcılar yükleniyor...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Kullanıcı Yönetimi</CardTitle>
          </div>
          <CardDescription>Uygulamadaki tüm kullanıcıları görüntüleyin ve rollerini/elmaslarını/premium durumlarını yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loading ? (
            <p className="text-muted-foreground text-center py-8">Henüz kayıtlı kullanıcı bulunmamaktadır.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] sm:w-[80px]">Avatar</TableHead>
                    <TableHead>Kullanıcı Adı</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead className="text-center">Elmas</TableHead>
                    <TableHead className="text-center">Rol</TableHead>
                    <TableHead className="text-center">Premium</TableHead>
                    <TableHead>Premium Bitiş</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead className="text-right">Eylemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 rounded-md">
                          <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar list" />
                          <AvatarFallback>{getAvatarFallbackText(user.displayName, user.email)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{user.displayName || "İsimsiz"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="flex items-center justify-center gap-1 w-fit mx-auto text-xs">
                          <Gem className="h-3 w-3 text-yellow-500" /> {user.diamonds ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className={user.role === 'admin' ? 'bg-primary text-primary-foreground text-xs' : 'text-xs'}>
                          {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={user.premiumStatus && user.premiumStatus !== 'none' ? 'default' : 'outline'} 
                          className={user.premiumStatus && user.premiumStatus !== 'none' ? 'bg-yellow-500 text-black dark:text-yellow-950 text-xs' : 'text-xs'}
                        >
                          {user.premiumStatus === 'weekly' ? 'Haftalık' : user.premiumStatus === 'monthly' ? 'Aylık' : 'Yok'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatPremiumExpiry(user.premiumExpiryDate)}</TableCell>
                      <TableCell className="text-xs">
                        {user.createdAt instanceof Timestamp 
                          ? user.createdAt.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : user.createdAt ? new Date(user.createdAt as any).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Bilinmiyor'}
                      </TableCell>
                      <TableCell className="text-right space-x-0.5 sm:space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditRoleDialog(user)} aria-label="Rolü Düzenle" className="hover:text-primary h-7 w-7 sm:h-8 sm:w-8" disabled={user.uid === adminAuthUser?.uid || processingAction}>
                          <AdminUserCogIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditDiamondsDialog(user)} aria-label="Elmasları Düzenle" className="hover:text-yellow-500 h-7 w-7 sm:h-8 sm:w-8" disabled={processingAction}>
                          <Gem className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleOpenEditPremiumDialog(user)} aria-label="Premium Durumunu Düzenle" className="hover:text-amber-500 h-7 w-7 sm:h-8 sm:w-8" disabled={processingAction}>
                          <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kullanıcı Rolünü Düzenle</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                <span className="font-medium text-foreground">{selectedUser.displayName || selectedUser.email || selectedUser.uid}</span> kullanıcısının rolünü değiştirin.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="role-select" className="text-sm">Rol</Label>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as 'user' | 'admin')}>
              <SelectTrigger id="role-select" className="h-9">
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
              <Button type="button" variant="outline" disabled={processingAction} size="sm">İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateRole} disabled={processingAction} size="sm">
              {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDiamondsDialogOpen} onOpenChange={setIsEditDiamondsDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kullanıcı Elmaslarını Düzenle</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                <span className="font-medium text-foreground">{selectedUser.displayName || selectedUser.email || selectedUser.uid}</span> kullanıcısının elmas sayısını düzenle. 
                Mevcut: <span className="font-semibold text-yellow-500">{selectedUser.diamonds ?? 0}</span>.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="diamond-adjustment" className="text-sm">Eklenecek/Çıkarılacak Elmas</Label>
            <Input
              id="diamond-adjustment"
              type="number"
              value={diamondAdjustment}
              onChange={(e) => setDiamondAdjustment(parseInt(e.target.value, 10) || 0)}
              placeholder="Örn: 10 (ekle) veya -5 (çıkar)"
              className="h-9"
            />
            {selectedUser && (
                <p className="text-xs text-muted-foreground">
                İşlem sonrası yeni bakiye: <span className="font-semibold text-yellow-500">{Math.max(0, (selectedUser.diamonds ?? 0) + diamondAdjustment)}</span> elmas. (Minimum 0)
                </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={processingAction} size="sm">İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateDiamonds} disabled={processingAction} size="sm">
              {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditPremiumDialogOpen} onOpenChange={setIsEditPremiumDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kullanıcı Premium Durumunu Düzenle</DialogTitle>
            {selectedUser && (
              <DialogDescription>
                <span className="font-medium text-foreground">{selectedUser.displayName || selectedUser.email || selectedUser.uid}</span> kullanıcısının premium durumunu değiştirin.
                Mevcut Durum: <span className="capitalize font-semibold text-yellow-500">{selectedUser.premiumStatus || 'Yok'}</span>.
                {selectedUser.premiumExpiryDate && (
                    <span> Bitiş: {formatPremiumExpiry(selectedUser.premiumExpiryDate)}</span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="premium-status-select" className="text-sm">Premium Durumu</Label>
            <Select value={newPremiumStatus} onValueChange={(value) => setNewPremiumStatus(value as 'none' | 'weekly' | 'monthly')}>
              <SelectTrigger id="premium-status-select" className="h-9">
                <SelectValue placeholder="Premium Durumu Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Yok (Premium Değil)</SelectItem>
                <SelectItem value="weekly">Haftalık Premium</SelectItem>
                <SelectItem value="monthly">Aylık Premium</SelectItem>
              </SelectContent>
            </Select>
            {newPremiumStatus !== 'none' && (
                <p className="text-xs text-muted-foreground">
                    Seçili premium tipi {newPremiumStatus === 'weekly' ? '7 gün' : '30 gün'} sonra sona erecek şekilde ayarlanacaktır.
                </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={processingAction} size="sm">İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdatePremiumStatus} disabled={processingAction} size="sm">
              {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
    
