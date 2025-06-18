
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Loader2, Palette, Users, LockKeyhole, ShieldCheck, Eye, UsersRound, ImagePlus, ShoppingBag, Mic as MicIcon, PauseCircle, PlayCircle } from "lucide-react";
import { useAuth, type PrivacySettings } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemeSetting } from "@/contexts/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { LogOutIcon, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";


interface UserProfileForm {
  username: string;
  bio: string;
}

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'Sistem Varsayılanı' },
  { value: 'light', label: 'Açık Tema' },
  { value: 'dark', label: 'Koyu Tema' },
];

const PREDEFINED_AVATARS = [
  "https://placehold.co/128x128/ADD8E6/333333.png?text=HW1", 
  "https://placehold.co/128x128/7FFFD4/333333.png?text=HW2", 
  "https://placehold.co/128x128/F0F8FF/333333.png?text=HW3", 
  "https://placehold.co/128x128/FFB6C1/333333.png?text=HW4", 
  "https://placehold.co/128x128/90EE90/333333.png?text=HW5", 
  "https://placehold.co/128x128/FFA07A/333333.png?text=HW6", 
  "https://placehold.co/128x128/DDA0DD/333333.png?text=HW7", 
  "https://placehold.co/128x128/B0E0E6/333333.png?text=HW8", 
  null, 
];


export default function ProfilePage() {
  const { currentUser, userData, updateUserProfile, isUserLoading, logOut, setIsAdminPanelOpen } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });
  const [previewImage, setPreviewImage] = useState<string | null>(null); 

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    postsVisibleToFriendsOnly: false,
    activeRoomsVisibleToFriendsOnly: false,
    feedShowsEveryone: true,
  });

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestStream, setMicTestStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.title = 'Profilim - HiweWalk';
    if (currentUser && userData) {
      setTempProfile({
        username: userData.displayName || currentUser.displayName || "",
        bio: userData.bio || "",
      });
      setPreviewImage(userData.photoURL || currentUser.photoURL || null);
      setPrivacySettings({
        postsVisibleToFriendsOnly: userData.privacySettings?.postsVisibleToFriendsOnly ?? false,
        activeRoomsVisibleToFriendsOnly: userData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
        feedShowsEveryone: userData.privacySettings?.feedShowsEveryone ?? true,
      });
    } else if (currentUser) {
        setTempProfile({
            username: currentUser.displayName || "",
            bio: "",
        });
         setPreviewImage(currentUser.photoURL || null);
         setPrivacySettings({
            postsVisibleToFriendsOnly: false,
            activeRoomsVisibleToFriendsOnly: false,
            feedShowsEveryone: true,
         });
    }
  }, [currentUser, userData]);

  useEffect(() => {
    if (userData) {
      if (!isEditing) { 
        setPreviewImage(userData.photoURL || null);
        setTempProfile(prev => ({...prev, bio: userData.bio || ""}));
      }
      setPrivacySettings(prev => ({
          ...prev,
          postsVisibleToFriendsOnly: userData.privacySettings?.postsVisibleToFriendsOnly ?? false,
          activeRoomsVisibleToFriendsOnly: userData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
          feedShowsEveryone: userData.privacySettings?.feedShowsEveryone ?? true,
      }));
    }
  }, [userData, isEditing]);

  useEffect(() => {
    return () => {
      if (micTestStream) {
        micTestStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [micTestStream]);

  const handleEditToggle = () => {
    if (isEditing) { 
      if (currentUser && userData) {
        setTempProfile({
            username: userData.displayName || currentUser.displayName || "",
            bio: userData.bio || ""
        });
        setPreviewImage(userData.photoURL || currentUser.photoURL || null); 
        setPrivacySettings({
            postsVisibleToFriendsOnly: userData.privacySettings?.postsVisibleToFriendsOnly ?? false,
            activeRoomsVisibleToFriendsOnly: userData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
            feedShowsEveryone: userData.privacySettings?.feedShowsEveryone ?? true,
        });
      } else if (currentUser) {
        setTempProfile({ username: currentUser.displayName || "", bio: "" });
        setPreviewImage(currentUser.photoURL || null);
        setPrivacySettings({ postsVisibleToFriendsOnly: false, activeRoomsVisibleToFriendsOnly: false, feedShowsEveryone: true });
      }
    } else { 
       if (currentUser && userData) {
        setPreviewImage(userData.photoURL || currentUser.photoURL || null); 
       }
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarSelect = (avatarUrl: string | null) => {
    setPreviewImage(avatarUrl);
  };

  const handlePrivacySettingChange = (setting: keyof PrivacySettings, value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleSave = async () => {
    if (!currentUser) return;

    const updates: { displayName?: string; newPhotoURL?: string | null; bio?: string; privacySettings?: PrivacySettings } = {};
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

    const originalPhotoURL = userData?.photoURL || currentUser?.photoURL || null;
    if (previewImage !== originalPhotoURL) { 
        updates.newPhotoURL = previewImage; 
        profileChanged = true;
    }


    const currentPrivacySettings = userData?.privacySettings || {
        postsVisibleToFriendsOnly: false,
        activeRoomsVisibleToFriendsOnly: false,
        feedShowsEveryone: true,
    };

    if (privacySettings.postsVisibleToFriendsOnly !== (currentPrivacySettings.postsVisibleToFriendsOnly ?? false) ||
        privacySettings.activeRoomsVisibleToFriendsOnly !== (currentPrivacySettings.activeRoomsVisibleToFriendsOnly ?? false) ||
        privacySettings.feedShowsEveryone !== (currentPrivacySettings.feedShowsEveryone ?? true)
       ) {
        updates.privacySettings = privacySettings;
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
    }
  };

  const getAvatarFallbackText = () => {
    const nameToUse = isEditing ? tempProfile.username : (userData?.displayName || currentUser?.displayName);
    if (nameToUse) return nameToUse.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "HW";
  };

  const startMicTest = async () => {
    setMicError(null);
    if (micTestStream) { 
      micTestStream.getTracks().forEach(track => track.stop());
      setMicTestStream(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setMicTestStream(stream);
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.srcObject = stream;
      }
      setIsTestingMic(true);
      toast({ title: "Mikrofon Testi Başladı", description: "Kendi sesinizi duyuyor olmalısınız." });
    } catch (err) {
      console.error("Error starting mic test:", err);
      setMicError("Mikrofona erişilemedi. Lütfen tarayıcı izinlerini kontrol edin.");
      toast({ title: "Mikrofon Hatası", description: "Mikrofona erişilemedi.", variant: "destructive" });
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    if (micTestStream) {
      micTestStream.getTracks().forEach(track => track.stop());
    }
    setMicTestStream(null);
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.srcObject = null;
    }
    setIsTestingMic(false);
    setMicError(null);
    toast({ title: "Mikrofon Testi Durduruldu" });
  };

  const handleToggleMicTest = () => {
    if (isTestingMic) {
      stopMicTest();
    } else {
      startMicTest();
    }
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

  const displayPhotoUrlToShow = isEditing ? previewImage : (userData?.photoURL || currentUser?.photoURL || null);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10 border-none shadow-none">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
              {displayPhotoUrlToShow ? (
                  <AvatarImage
                    src={displayPhotoUrlToShow}
                    alt={tempProfile.username || "Kullanıcı"}
                    data-ai-hint="user portrait"
                    key={displayPhotoUrlToShow} 
                  />
              ) : null }
              <AvatarFallback>{getAvatarFallbackText()}</AvatarFallback>
            </Avatar>
            {isEditing && (
               <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute bottom-0 right-0 rounded-full h-8 w-8 sm:h-10 sm:w-10 bg-card hover:bg-muted shadow-md"
                onClick={() => { }}
                aria-label="Avatar seç"
                disabled={isUserLoading}
              >
                <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
          </div>
          <CardTitle className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-headline text-foreground">
            {isEditing ? tempProfile.username : (userData?.displayName || currentUser?.displayName || "Kullanıcı Adı Yok")}
          </CardTitle>
          <CardDescription className="text-foreground/80">{currentUser?.email}</CardDescription>
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
                  placeholder="Kendinizden bahsedin..."
                  disabled={isUserLoading}
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-base">Avatar Seç</Label>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3">
                  {PREDEFINED_AVATARS.map((avatarUrl, index) => (
                    <button
                      key={avatarUrl || `remove-avatar-${index}`}
                      type="button"
                      onClick={() => handleAvatarSelect(avatarUrl)}
                      className={cn(
                        "aspect-square rounded-full border-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        previewImage === avatarUrl ? "border-primary ring-2 ring-primary scale-110" : "border-transparent hover:border-primary/50",
                        !avatarUrl && "flex items-center justify-center bg-muted hover:bg-muted/80" 
                      )}
                      aria-label={avatarUrl ? `Avatar ${index + 1} seç` : "Avatarı kaldır"}
                    >
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt={`Avatar ${index + 1}`} width={64} height={64} className="rounded-full object-cover" data-ai-hint="predefined avatar choice" />
                      ) : (
                        <XCircle className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>


              <Card className="pt-4 bg-transparent border-border/50">
                <CardHeader className="p-0 px-2 pb-3">
                    <div className="flex items-center gap-2">
                        <LockKeyhole className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Gizlilik Ayarları</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 p-2">
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <Label htmlFor="postsVisibleToFriendsOnly" className="flex-1 cursor-pointer text-sm">
                            Gönderilerimi sadece arkadaşlarım görsün
                        </Label>
                        <Switch
                            id="postsVisibleToFriendsOnly"
                            checked={privacySettings.postsVisibleToFriendsOnly}
                            onCheckedChange={(checked) => handlePrivacySettingChange('postsVisibleToFriendsOnly', checked)}
                            disabled={isUserLoading}
                        />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <Label htmlFor="activeRoomsVisibleToFriendsOnly" className="flex-1 cursor-pointer text-sm">
                            Aktif odalarımı sadece arkadaşlarım görsün
                        </Label>
                        <Switch
                            id="activeRoomsVisibleToFriendsOnly"
                            checked={privacySettings.activeRoomsVisibleToFriendsOnly}
                            onCheckedChange={(checked) => handlePrivacySettingChange('activeRoomsVisibleToFriendsOnly', checked)}
                            disabled={isUserLoading}
                        />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <Label htmlFor="feedShowsEveryone" className="flex-1 cursor-pointer text-sm">
                            Akışımda herkesin gönderilerini gör
                        </Label>
                        <Switch
                            id="feedShowsEveryone"
                            checked={privacySettings.feedShowsEveryone}
                            onCheckedChange={(checked) => handlePrivacySettingChange('feedShowsEveryone', checked)}
                            disabled={isUserLoading}
                        />
                    </div>
                </CardContent>
              </Card>


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
                <h3 className="text-lg font-semibold text-foreground/90">Hakkımda</h3>
                <p className="text-foreground/90 whitespace-pre-wrap text-sm sm:text-base">
                  {userData?.bio || "Henüz bir biyografi eklenmemiş."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-4">
                {userData?.role === 'admin' && (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-purple-500 text-purple-500 hover:bg-purple-500/10"
                    onClick={() => setIsAdminPanelOpen(true)}
                    disabled={isUserLoading}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Paneli
                  </Button>
                )}
                <Button onClick={handleEditToggle} variant="outline" className="w-full sm:w-auto" disabled={isUserLoading}>
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

      <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MicIcon className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl sm:text-2xl">Mikrofon Testi</CardTitle>
          </div>
          <CardDescription>Mikrofonunuzun çalışıp çalışmadığını ve sesinizin nasıl duyulduğunu test edin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleToggleMicTest} disabled={isUserLoading || isEditing} className="w-full sm:w-auto">
            {isTestingMic ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            {isTestingMic ? "Testi Durdur" : "Mikrofon Testini Başlat"}
          </Button>
          <audio ref={audioPlaybackRef} autoPlay className={isTestingMic ? "block w-full mt-2 rounded-md" : "hidden"} controls={isTestingMic}></audio>
          {micError && <p className="text-sm text-destructive">{micError}</p>}
          {!micError && isTestingMic && <p className="text-sm text-muted-foreground">Şu anda mikrofonunuzdan gelen sesi duyuyor olmalısınız. Testi bitirmek için "Testi Durdur" butonuna basın.</p>}
           {!isTestingMic && !micError && <p className="text-sm text-muted-foreground">Mikrofonunuzu test etmek için yukarıdaki butona tıklayın.</p>}
        </CardContent>
      </Card>


      {!isEditing && (
        <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
            <CardHeader>
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl sm:text-2xl">Gizlilik Durumu</CardTitle>
            </div>
            <CardDescription>Mevcut profil gizlilik ayarlarınız.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5"><UsersRound className="h-4 w-4"/> Gönderiler: <span className="font-medium text-foreground">{privacySettings.postsVisibleToFriendsOnly ? "Sadece Arkadaşlar" : "Herkese Açık"}</span></p>
                <p className="flex items-center gap-1.5"><UsersRound className="h-4 w-4"/> Aktif Odalar: <span className="font-medium text-foreground">{privacySettings.activeRoomsVisibleToFriendsOnly ? "Sadece Arkadaşlar" : "Herkese Açık"}</span></p>
                <p className="flex items-center gap-1.5"><Eye className="h-4 w-4"/> Akış Gösterimi: <span className="font-medium text-foreground">{privacySettings.feedShowsEveryone ? "Herkes" : "Sadece Arkadaşlar"}</span></p>
            </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl sm:text-2xl">Bağlantılarım</CardTitle>
          </div>
          <CardDescription>Arkadaşlarını yönet ve yeni bağlantılar kur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/friends">
              Arkadaşlarım Sayfasına Git
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl sm:text-2xl">Mağaza</CardTitle>
          </div>
          <CardDescription>Elmas satın al veya premium özelliklere göz at.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/store">
              Mağazaya Git
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl sm:text-2xl">Görünüm Ayarları</CardTitle>
          </div>
          <CardDescription>Uygulamanın temasını kişiselleştirin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="theme-select" className="text-base">Uygulama Teması</Label>
            <Select value={theme} onValueChange={(value) => setTheme(value as ThemeSetting)}>
              <SelectTrigger id="theme-select" className="mt-1">
                <SelectValue placeholder="Tema Seçin" />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-card/50 dark:bg-card/30">
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

