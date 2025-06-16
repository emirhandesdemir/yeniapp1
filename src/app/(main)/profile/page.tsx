
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react"; 
import Image from "next/image"; 
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Loader2, Camera, Trash2, LogOutIcon, LayoutDashboard } from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserProfileForm {
  username: string;
  bio: string;
}

export default function ProfilePage() {
  const { currentUser, userData, updateUserProfile, isUserLoading, logOut } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Profilim - Sohbet Küresi';
    if (currentUser && userData) {
      setTempProfile({
        username: userData.displayName || currentUser.displayName || "",
        bio: "", 
      });
      setPreviewImage(userData.photoURL || currentUser.photoURL); 
    } else if (currentUser) {
        setTempProfile({
            username: currentUser.displayName || "",
            bio: "",
        });
         setPreviewImage(currentUser.photoURL);
    }
  }, [currentUser, userData]);
  
  useEffect(() => {
    if (userData?.photoURL) {
      setPreviewImage(userData.photoURL);
    }
  }, [userData?.photoURL]);


  const handleEditToggle = () => {
    if (isEditing) {
      if (currentUser && userData) {
        setTempProfile({ username: userData.displayName || currentUser.displayName || "", bio: "" }); 
        setPreviewImage(userData.photoURL || currentUser.photoURL);
      } else if (currentUser) {
        setTempProfile({ username: currentUser.displayName || "", bio: "" });
        setPreviewImage(currentUser.photoURL);
      }
      setSelectedFile(null); 
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Hata", description: "Dosya boyutu 5MB'den büyük olamaz.", variant: "destructive" });
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: "Hata", description: "Sadece JPG, PNG, GIF veya WEBP formatında resim yükleyebilirsiniz.", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };
  
  const handleRemoveProfilePicture = async () => {
    if (!currentUser || !userData?.photoURL) {
        toast({ title: "Bilgi", description: "Kaldırılacak bir profil fotoğrafı bulunmuyor." });
        return;
    }
    if (!confirm("Profil fotoğrafınızı kaldırmak istediğinizden emin misiniz?")) return;

    const success = await updateUserProfile({ photoFile: null }); 
    if (success) {
      setPreviewImage(null); 
      setSelectedFile(null);
    }
  };


  const handleSave = async () => {
    if (!currentUser) return;
    
    const updates: { displayName?: string; photoFile?: File | null } = {};
    let profileChanged = false;

    const currentDisplayName = userData?.displayName || currentUser.displayName || "";
    if (tempProfile.username.trim() !== currentDisplayName) {
        if(tempProfile.username.trim().length < 3){
            toast({ title: "Hata", description: "Kullanıcı adı en az 3 karakter olmalıdır.", variant: "destructive" });
            return;
        }
        updates.displayName = tempProfile.username.trim();
        profileChanged = true;
    }

    if (selectedFile) {
        updates.photoFile = selectedFile;
        profileChanged = true;
    }

    if (!profileChanged) {
        setIsEditing(false); 
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        return;
    }

    const success = await updateUserProfile(updates);
    if (success) {
      setIsEditing(false);
      setSelectedFile(null); 
    }
  };
  
  const getAvatarFallbackText = () => {
    const nameToUse = isEditing ? tempProfile.username : (userData?.displayName || currentUser?.displayName);
    if (nameToUse) return nameToUse.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "PN"; 
  };

  if (isUserLoading && !currentUser && !userData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Profil yükleniyor...</p>
      </div>
    );
  }
  
  if (!currentUser && !isUserLoading) { 
     return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Giriş yapmış kullanıcı bulunamadı. Yönlendiriliyor...</p>
         <Loader2 className="h-8 w-8 animate-spin text-primary ml-2" />
      </div>
    );
  }
  
  const displayPhotoUrl = isEditing 
    ? (previewImage || userData?.photoURL || currentUser?.photoURL) 
    : (userData?.photoURL || currentUser?.photoURL);


  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
              <AvatarImage 
                src={displayPhotoUrl || "https://placehold.co/128x128.png"} 
                alt={tempProfile.username || "Kullanıcı"} 
                data-ai-hint="user portrait" 
                key={displayPhotoUrl} 
              />
              <AvatarFallback>{getAvatarFallbackText()}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 rounded-full h-8 w-8 sm:h-10 sm:w-10 bg-card hover:bg-muted shadow-md"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Profil fotoğrafı seç"
                disabled={isUserLoading}
              >
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/gif, image/webp"
              className="hidden"
              disabled={isUserLoading || !isEditing}
            />
          </div>
           {isEditing && userData?.photoURL && (
            <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs text-destructive hover:text-destructive-foreground hover:bg-destructive/90"
                onClick={handleRemoveProfilePicture}
                disabled={isUserLoading}
            >
                <Trash2 className="mr-1 h-3 w-3"/> Fotoğrafı Kaldır
            </Button>
           )}
          <CardTitle className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-headline text-primary-foreground/90">
            {isEditing ? tempProfile.username : (userData?.displayName || currentUser?.displayName || "Kullanıcı Adı Yok")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">{currentUser?.email}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {isEditing ? (
            <form className="space-y-4 sm:space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div>
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input id="username" name="username" value={tempProfile.username} onChange={handleInputChange} className="mt-1" disabled={isUserLoading}/>
              </div>
              <div>
                <Label htmlFor="email">E-posta (Değiştirilemez)</Label>
                <Input id="email" name="email" value={currentUser?.email || ""} readOnly disabled className="mt-1 bg-muted/50 dark:bg-muted/30"/>
              </div>
              <div>
                <Label htmlFor="bio">Hakkımda</Label>
                <Textarea 
                  id="bio" 
                  name="bio" 
                  value={tempProfile.bio} 
                  onChange={handleInputChange} 
                  rows={3} 
                  className="mt-1" 
                  placeholder="Kendinizden bahsedin... (Bu özellik yakında eklenecektir)"
                  disabled 
                />
              </div>
              {previewImage && selectedFile && ( 
                <div className="my-4">
                    <Label>Yeni Fotoğraf Önizlemesi</Label>
                    <Image src={previewImage} alt="Profil fotoğrafı önizlemesi" width={128} height={128} className="rounded-md mt-1 object-cover h-32 w-32 border" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 sm:pt-4">
                <Button type="button" variant="outline" onClick={handleEditToggle} disabled={isUserLoading} className="w-full sm:w-auto">
                  <XCircle className="mr-2 h-4 w-4" /> Vazgeç
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto" disabled={isUserLoading}>
                  {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-primary-foreground/80">Hakkımda</h3>
                <p className="text-muted-foreground whitespace-pre-wrap text-sm sm:text-base">
                  {tempProfile.bio || "Henüz bir biyografi eklenmemiş. Bu özellik yakında eklenecektir."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-4">
                {userData?.role === 'admin' && (
                  <Button asChild variant="outline" className="w-full sm:w-auto border-purple-500 text-purple-500 hover:bg-purple-500/10">
                    <Link href="/admin/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Paneli
                    </Link>
                  </Button>
                )}
                <Button onClick={handleEditToggle} variant="outline" className="w-full sm:w-auto">
                  <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle
                </Button>
                <Button
                  onClick={async () => await logOut()}
                  variant="destructive"
                  className="w-full sm:w-auto"
                  disabled={isUserLoading}
                >
                  {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
                  Çıkış Yap
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Aktiviteler</CardTitle>
          <CardDescription>Son aktiviteleriniz burada görünecek.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Henüz aktivite yok.</p>
        </CardContent>
      </Card>
    </div>
  );
}

