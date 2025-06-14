
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import Image from "next/image"; // next/image import edildi
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Camera, Loader2, UploadCloud } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserProfileForm {
  username: string;
  bio: string;
}

export default function ProfilePage() {
  const { currentUser, userData, updateUserProfile, isUserLoading } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Profilim - Sohbet Küresi';
    if (currentUser) {
      setTempProfile({
        username: userData?.displayName || currentUser.displayName || "",
        bio: "", 
      });
      setPreviewImage(userData?.photoURL || currentUser.photoURL || null);
    }
  }, [currentUser, userData]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      if (currentUser) {
        setTempProfile({ username: userData?.displayName || currentUser.displayName || "", bio: "" });
        setPreviewImage(userData?.photoURL || currentUser.photoURL || null);
        setSelectedFile(null);
      }
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
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Dosya Çok Büyük", description: "Lütfen 5MB'den küçük bir resim seçin.", variant: "destructive"});
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir resim dosyası (JPEG, PNG, GIF, WebP) seçin.", variant: "destructive"});
        return;
      }
      setSelectedFile(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      toast({ title: "Hata", description: "Profil kaydedilemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return;
    }
    
    const updates: { displayName?: string, photoFile?: File | null } = {};
    let profileChanged = false;

    if (tempProfile.username.trim() !== (userData?.displayName || currentUser.displayName || "")) {
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
        setIsEditing(false); // No changes, just exit editing mode
        return;
    }

    try {
      await updateUserProfile(updates);
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      setIsEditing(false);
      setSelectedFile(null); // Reset selected file after successful save
      // previewImage will be updated by useEffect when userData changes
    } catch (error: any) {
      // Errors are typically handled within updateUserProfile, but a generic one here if needed.
      // toast({ title: "Profil Güncelleme Hatası", description: error.message || "Bilinmeyen bir hata oluştu.", variant: "destructive" });
    }
  };
  
  const getAvatarFallbackText = () => {
    const nameToUse = tempProfile.username || userData?.displayName || currentUser?.displayName;
    if (nameToUse) return nameToUse.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "PN"; 
  };


  if (!currentUser && isUserLoading) {
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


  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
              <AvatarImage 
                src={previewImage || "https://placehold.co/128x128.png"} // Use previewImage
                alt={tempProfile.username || "Kullanıcı"} 
                data-ai-hint="user portrait" 
              />
              <AvatarFallback>{getAvatarFallbackText()}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button 
                type="button"
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 rounded-full h-8 w-8 sm:h-10 sm:w-10 bg-background/80 hover:bg-background border-2 border-primary/50 hover:border-primary text-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUserLoading}
                aria-label="Profil fotoğrafını değiştir"
              >
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept="image/jpeg,image/png,image/gif,image/webp" 
              onChange={handleFileChange}
              disabled={!isEditing || isUserLoading}
            />
          </div>
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
                  disabled // Şimdilik bio düzenleme devre dışı
                />
              </div>
              {selectedFile && previewImage && (
                <div className="space-y-2">
                    <Label>Yeni Profil Fotoğrafı Önizlemesi</Label>
                    <div className="flex justify-center">
                        <Image src={previewImage} alt="Profil fotoğrafı önizlemesi" width={128} height={128} className="rounded-md border object-cover" data-ai-hint="profile preview"/>
                    </div>
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
              <div className="flex justify-end pt-4">
                <Button onClick={handleEditToggle} variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
                  <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle
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
