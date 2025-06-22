
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, XCircle, ImagePlus, Trash2, User, Mail, ArrowLeft, Edit3, LogOut as LogOutIcon, Shield, Palette, Gem, Store, Sun, Moon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageCropperDialog from "@/components/profile/ImageCropperDialog"; 
import { v4 as uuidv4 } from 'uuid';
import { Switch } from "@/components/ui/switch";
import { useTheme } from '@/contexts/ThemeContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface UserProfileForm {
  username: string;
  bio: string;
}

const allBubbleStyles = [
    { id: 'default', name: 'Varsayılan' },
    { id: 'sparkle', name: 'Parıltı' },
    { id: 'neon-green', name: 'Neon Yeşil' },
];

const allAvatarFrameStyles = [
    { id: 'default', name: 'Yok' },
    { id: 'gold', name: 'Altın' },
    { id: 'neon-pink', name: 'Neon Pembe' },
];

export default function SettingsPage() {
  const { currentUser, userData, updateUserProfile, isUserLoading, logOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const [privacySettings, setPrivacySettings] = useState(userData?.privacySettings || {});
  const [selectedBubbleStyle, setSelectedBubbleStyle] = useState(userData?.bubbleStyle || 'default');
  const [selectedAvatarFrame, setSelectedAvatarFrame] = useState(userData?.avatarFrameStyle || 'default');

  useEffect(() => {
    document.title = 'Ayarlar - HiweWalk';
    if (currentUser && userData) {
      setTempProfile({
        username: userData.displayName || currentUser.displayName || "",
        bio: userData.bio || "",
      });
      setPreviewImage(userData.photoURL || currentUser.photoURL || null);
      setPrivacySettings(userData.privacySettings || {});
      setSelectedBubbleStyle(userData.bubbleStyle || 'default');
      setSelectedAvatarFrame(userData.avatarFrameStyle || 'default');
      setCroppedBlob(null); 
      setImageToCrop(null);
      setInitialLoad(false);
    } else if (!currentUser && !isUserLoading) {
      router.replace("/login?redirect=/settings");
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
        setImageToCrop(reader.result as string);
        setIsCropperOpen(true);
        setCroppedBlob(null); 
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) { 
        fileInputRef.current.value = "";
      }
    }
  };
  
  const handleCropComplete = (croppedImageBlob: Blob) => {
    setCroppedBlob(croppedImageBlob);
    setPreviewImage(URL.createObjectURL(croppedImageBlob)); 
    setIsCropperOpen(false);
    setImageToCrop(null);
  };

  const handleRemovePreviewImage = () => {
    setPreviewImage(null);
    setCroppedBlob(null);
    setImageToCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handlePrivacyChange = (key: string, value: boolean) => {
    setPrivacySettings(prev => ({...prev, [key]: value}));
  };

  const handleSave = async () => {
    if (!currentUser || !userData) return;

    const updates: Parameters<typeof updateUserProfile>[0] = {};
    let profileChanged = false;

    if (tempProfile.username.trim() !== userData.displayName) {
        if(tempProfile.username.trim().length < 3){
            toast({ title: "Hata", description: "Kullanıcı adı en az 3 karakter olmalıdır.", variant: "destructive" }); return;
        }
        updates.displayName = tempProfile.username.trim();
        profileChanged = true;
    }
    if (tempProfile.bio !== userData.bio) {
        updates.bio = tempProfile.bio;
        profileChanged = true;
    }
    if (croppedBlob) {
        updates.newPhotoBlob = croppedBlob;
        profileChanged = true;
    } else if (previewImage === null && userData.photoURL !== null) {
        updates.removePhoto = true;
        profileChanged = true;
    }
    if (JSON.stringify(privacySettings) !== JSON.stringify(userData.privacySettings)) {
        updates.privacySettings = privacySettings;
        profileChanged = true;
    }
    if (selectedBubbleStyle !== userData.bubbleStyle) {
        updates.bubbleStyle = selectedBubbleStyle;
        profileChanged = true;
    }
    if (selectedAvatarFrame !== userData.avatarFrameStyle) {
        updates.avatarFrameStyle = selectedAvatarFrame;
        profileChanged = true;
    }

    if (!profileChanged) {
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        return;
    }

    const success = await updateUserProfile(updates);
    if (success) {
      setCroppedBlob(null); 
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
      <div className="flex flex-1 flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))] text-center p-8">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground">Ayarlar Yükleniyor</h2>
        <p className="text-muted-foreground mt-2">Lütfen bekleyin...</p>
      </div>
    );
  }
  
  if (!currentUser || !userData) return null;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8">
          <header className="mb-8">
            <h1 className="text-3xl font-headline font-bold text-foreground">Ayarlar</h1>
            <p className="text-muted-foreground mt-1">Profilini, gizlilik ayarlarını ve uygulama görünümünü yönet.</p>
          </header>

          <section id="profile-settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary"/>Profil Bilgileri</CardTitle>
                <CardDescription>Görünür adın, biyografin ve profil resmin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center space-y-3">
                    <div className="relative group">
                        <Avatar className="h-28 w-28 border-4 border-muted shadow-lg">
                        {previewImage && <AvatarImage src={previewImage} alt={tempProfile.username || "Kullanıcı"} className="object-cover" />}
                        <AvatarFallback className="text-4xl">{getAvatarFallbackText()}</AvatarFallback>
                        </Avatar>
                        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" id="profile-photo-upload" />
                        <Button type="button" variant="outline" size="icon" className="absolute bottom-1 right-1 rounded-full h-8 w-8 bg-card hover:bg-muted" onClick={() => fileInputRef.current?.click()} disabled={isUserLoading}><ImagePlus className="h-4 w-4 text-primary" /></Button>
                        {previewImage && <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 rounded-full h-7 w-7 opacity-80 group-hover:opacity-100" onClick={handleRemovePreviewImage} disabled={isUserLoading}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="username-edit" className="text-xs">Kullanıcı Adı</Label>
                      <Input id="username-edit" name="username" value={tempProfile.username} onChange={handleInputChange} className="mt-1" disabled={isUserLoading}/>
                  </div>
                  <div>
                      <Label htmlFor="email-edit" className="text-xs">E-posta (Değiştirilemez)</Label>
                      <Input id="email-edit" name="email" value={currentUser?.email || ""} readOnly disabled className="mt-1 bg-muted/50"/>
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio-edit" className="text-xs">Hakkımda</Label>
                  <Textarea id="bio-edit" name="bio" value={tempProfile.bio} onChange={handleInputChange} rows={3} className="mt-1" placeholder="Kendinizden bahsedin..." disabled={isUserLoading}/>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="privacy-settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary"/>Gizlilik Ayarları</CardTitle>
                <CardDescription>Kimlerin neyi görebileceğini kontrol et.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <Label htmlFor="showOnlineStatus" className="flex-grow cursor-pointer"><p className="font-medium">Aktiflik Durumunu Göster</p><p className="text-xs text-muted-foreground">Çevrimiçi olup olmadığın ve son görülme zamanın başkaları tarafından görülsün.</p></Label>
                    <Switch id="showOnlineStatus" checked={privacySettings.showOnlineStatus} onCheckedChange={(c) => handlePrivacyChange('showOnlineStatus', c)} />
                 </div>
              </CardContent>
            </Card>
          </section>
          
          <section id="appearance-settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/>Görünüm Ayarları</CardTitle>
                <CardDescription>Uygulamanın temasını ve sohbet görünümünü kişiselleştir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <Label htmlFor="theme-selector" className="font-medium">Uygulama Teması</Label>
                    <div className="flex items-center gap-2">
                        <Button variant={resolvedTheme === 'light' ? 'default' : 'ghost'} size="icon" onClick={() => setTheme('light')}><Sun className="h-5 w-5"/></Button>
                        <Button variant={resolvedTheme === 'dark' ? 'default' : 'ghost'} size="icon" onClick={() => setTheme('dark')}><Moon className="h-5 w-5"/></Button>
                    </div>
                 </div>
                 <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="bubble-style-select">Sohbet Baloncuğu Stili</Label>
                        <Select value={selectedBubbleStyle} onValueChange={setSelectedBubbleStyle}>
                          <SelectTrigger id="bubble-style-select" className="mt-1"><SelectValue placeholder="Stil seç..." /></SelectTrigger>
                          <SelectContent>
                            {allBubbleStyles.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="avatar-frame-select">Avatar Çerçevesi</Label>
                        <Select value={selectedAvatarFrame} onValueChange={setSelectedAvatarFrame}>
                          <SelectTrigger id="avatar-frame-select" className="mt-1"><SelectValue placeholder="Çerçeve seç..." /></SelectTrigger>
                          <SelectContent>
                            {allAvatarFrameStyles.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                    </div>
                 </div>
                 <div className="flex items-center gap-4 text-sm text-muted-foreground p-3 border-dashed border rounded-lg">
                    <Gem className="h-6 w-6 text-yellow-500 flex-shrink-0"/>
                    <p>Daha fazla stil ve çerçeve seçeneği için <Link href="/store" className="text-primary hover:underline font-medium">Elmas Mağazası'nı</Link> ziyaret et!</p>
                 </div>
              </CardContent>
            </Card>
          </section>

          <section id="account-actions">
            <Card className="border-destructive/40">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5"/>Hesap İşlemleri</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button onClick={logOut} variant="destructive" className="w-full sm:w-auto" disabled={isUserLoading}>
                        {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOutIcon className="mr-2 h-4 w-4" />}
                        Çıkış Yap
                    </Button>
                </CardContent>
            </Card>
          </section>

          <div className="flex justify-end gap-2 sticky bottom-4 z-10">
            <Button onClick={handleSave} className="w-full sm:w-auto rounded-lg shadow-lg" size="lg" disabled={isUserLoading}>
              {isUserLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Değişiklikleri Kaydet
            </Button>
          </div>
      </div>
      {imageToCrop && (
        <ImageCropperDialog
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </>
  );
}

