
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
import { Loader2, Gem, UserCog as AdminUserCogIcon, ShieldAlert } from "lucide-react";
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

export default function AdminUsersContent() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentUser: adminAuthUser, userData: adminUserData } = useAuth();

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [isEditDiamondsDialogOpen, setIsEditDiamondsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
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
  }, [toast, adminUserData]); 
  
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


  const getAvatarFallbackText = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "PN";
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
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AdminUserCogIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Kullanıcı Yönetimi</CardTitle>
          </div>
          <CardDescription>Uygulamadaki tüm kullanıcıları görüntüleyin ve rollerini/elmaslarını yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loading ? (
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
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditRoleDialog(user)} aria-label="Rolü Düzenle" className="hover:text-primary" disabled={user.uid === adminAuthUser?.uid || processingAction}>
                        <AdminUserCogIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDiamondsDialog(user)} aria-label="Elmasları Düzenle" className="hover:text-yellow-500" disabled={processingAction}>
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
              <Button type="button" variant="outline" disabled={processingAction}>İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateRole} disabled={processingAction}>
              {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <Button type="button" variant="outline" disabled={processingAction}>İptal</Button>
            </DialogClose>
            <Button onClick={handleUpdateDiamonds} disabled={processingAction}>
              {processingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
