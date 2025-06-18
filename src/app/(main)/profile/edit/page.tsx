
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, XCircle, ImagePlus, Trash2, User, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfileForm {
  username: string;
  bio: string;
}

export default function EditProfilePage() {
  const { currentUser, userData, updateUserProfile, isUserLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    document.title = 'Profil Düzenle - HiweWalk';
    if (currentUser && userData) {
      setTempProfile({
        username: userData.displayName || currentUser.displayName || "",
        bio: userData.bio || "",
      });
      setPreviewImage(userData.photoURL || currentUser.photoURL || null);
      setSelectedFile(null);
      setInitialLoad(false);
    } else if (currentUser && !userData && !isUserLoading) {
      // User is authenticated but userData might still be loading or missing
      setTempProfile({
        username: currentUser.displayName || "",
        bio: "",
      });
      setPreviewImage(currentUser.photoURL || null);
      setSelectedFile(null);
      setInitialLoad(false);
    } else if (!currentUser && !isUserLoading) {
      router.replace("/login?redirect=/profile/edit");
    }
  }, [currentUser, userData, isUserLoading, router]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Hata", description: "Lütfen bir resim dosyası seçin.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
         toast({ title: "Hata", description: "Dosya boyutu çok büyük (Maks 5MB).", variant: "destructive" });
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
        setSelectedFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePreviewImage = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    const updates: { displayName?: string; newPhotoFile?: File; removePhoto?: boolean; bio?: string } = {};
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

    const currentBio = userData?.bio || "";
    if (tempProfile.bio.trim() !== currentBio) {
        updates.bio = tempProfile.bio.trim();
        profileChanged = true;
    }
    
    if (selectedFile) {
        updates.newPhotoFile = selectedFile;
        profileChanged = true;
    } else if (previewImage === null && (userData?.photoURL || currentUser?.photoURL)) {
        updates.removePhoto = true;
        profileChanged = true;
    }

    if (!profileChanged) {
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        if (currentUser) router.push(`/profile/${currentUser.uid}`);
        return;
    }

    const success = await updateUserProfile(updates);
    if (success) {
      setSelectedFile(null);
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      if (currentUser) router.push(`/profile/${currentUser.uid}`);
    }
  };
  
  const handleCancel = () => {
    if (currentUser) {
        router.push(`/profile/${currentUser.uid}`);
    } else {
        router.push('/login');
    }
  };

  const getAvatarFallbackText = () => {
    const nameToUse = tempProfile.username || userData?.displayName || currentUser?.displayName;
    if (nameToUse) return nameToUse.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "HW";
  };

  if (isUserLoading || initialLoad) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Profil düzenleme yükleniyor...</p>
      </div>
    );
  }
  
  if (!currentUser && !isUserLoading) {
      // Bu durum useEffect'te handle ediliyor ama ekstra güvenlik için.
      return (
        <div className="flex flex-1 items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Bu sayfayı görüntülemek için giriş yapmalısınız.</p>
        </div>
      );
  }


  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-background to-primary/5 p-4">
        <div className="w-full max-w-lg">
            <Card className="shadow-xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={handleCancel} className="mr-2">
                            <ArrowLeft className="h-5 w-5"/>
                        </Button>
                        <Edit3 className="h-6 w-6 text-primary" />
                        <CardTitle className="text-2xl">Profili Düzenle</CardTitle>
                    </div>
                </div>
                <CardDescription>Kullanıcı adı, biyografi ve profil fotoğrafınızı güncelleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col items-center space-y-3">
                    <div className="relative group">
                        <Avatar className="h-32 w-32 border-4 border-muted shadow-lg">
                        {previewImage ? (
                            <AvatarImage
                                src={previewImage}
                                alt={tempProfile.username || "Kullanıcı"}
                                data-ai-hint="user portrait preview"
                            />
                        ) : null }
                        <AvatarFallback className="text-4xl">{getAvatarFallbackText()}</AvatarFallback>
                        </Avatar>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="hidden"
                            id="profile-photo-upload-edit"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute bottom-1 right-1 rounded-full h-10 w-10 bg-card hover:bg-muted shadow-md"
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Profil fotoğrafı yükle"
                            disabled={isUserLoading}
                        >
                        <ImagePlus className="h-5 w-5" />
                        </Button>
                        {previewImage && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 rounded-full h-8 w-8 opacity-80 group-hover:opacity-100 transition-opacity"
                                onClick={handleRemovePreviewImage}
                                aria-label="Profil fotoğrafını kaldır"
                                disabled={isUserLoading}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div>
                        <Label htmlFor="username-edit" className="flex items-center gap-1.5 mb-1"><User className="h-4 w-4 text-muted-foreground"/>Kullanıcı Adı</Label>
                        <Input id="username-edit" name="username" value={tempProfile.username} onChange={handleInputChange} className="mt-1" disabled={isUserLoading}/>
                    </div>
                    <div>
                        <Label htmlFor="email-edit" className="flex items-center gap-1.5 mb-1"><Mail className="h-4 w-4 text-muted-foreground"/>E-posta (Değiştirilemez)</Label>
                        <Input id="email-edit" name="email" value={currentUser?.email || ""} readOnly disabled className="mt-1 bg-muted/50 dark:bg-muted/30"/>
                    </div>
                    <div>
                        <Label htmlFor="bio-edit" className="flex items-center gap-1.5 mb-1"><User className="h-4 w-4 text-muted-foreground"/>Hakkımda</Label>
                        <Textarea
                        id="bio-edit"
                        name="bio"
                        value={tempProfile.bio}
                        onChange={handleInputChange}
                        rows={3}
                        className="mt-1"
                        placeholder="Kendinizden bahsedin..."
                        disabled={isUserLoading}
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isUserLoading} className="w-full sm:w-auto">
                        <XCircle className="mr-2 h-4 w-4" /> Vazgeç
                        </Button>
                        <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto" disabled={isUserLoading}>
                        {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Kaydet
                        </Button>
                    </div>
                </form>
            </CardContent>
            </Card>
        </div>
    </div>
  );
}
