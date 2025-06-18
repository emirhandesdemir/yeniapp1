
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, Users, LockKeyhole, ShieldCheck, Eye, UsersRound, ImagePlus, ShoppingBag, Mic as MicIcon, PauseCircle, PlayCircle, Star, Trash2, Settings, Edit3, LogOutIcon, LayoutDashboard, Save, ExternalLink } from "lucide-react";
import { useAuth, type PrivacySettings, checkUserPremium } from "@/contexts/AuthContext";
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
import { format, isPast } from "date-fns";
import { tr } from "date-fns/locale";


const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'Sistem Varsayılanı' },
  { value: 'light', label: 'Açık Tema' },
  { value: 'dark', label: 'Koyu Tema' },
];

export default function SettingsPage() {
  const { currentUser, userData, updateUserProfile, isUserLoading, logOut, setIsAdminPanelOpen, isCurrentUserPremium } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    postsVisibleToFriendsOnly: false,
    activeRoomsVisibleToFriendsOnly: false,
    feedShowsEveryone: true,
  });
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micTestStream, setMicTestStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.title = 'Ayarlar - HiweWalk';
    if (userData) {
      setPrivacySettings({
        postsVisibleToFriendsOnly: userData.privacySettings?.postsVisibleToFriendsOnly ?? false,
        activeRoomsVisibleToFriendsOnly: userData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
        feedShowsEveryone: userData.privacySettings?.feedShowsEveryone ?? true,
      });
    }
  }, [userData]);

  useEffect(() => {
    return () => {
      if (micTestStream) {
        micTestStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [micTestStream]);

  const handlePrivacySettingChange = (setting: keyof PrivacySettings, value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleSavePrivacySettings = async () => {
    if (!currentUser) return;
    setIsSavingPrivacy(true);
    const success = await updateUserProfile({ privacySettings });
    if (success) {
      toast({ title: "Başarılı", description: "Gizlilik ayarları güncellendi." });
    }
    setIsSavingPrivacy(false);
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
        <p className="text-muted-foreground ml-2">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser && !isUserLoading) {
     return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Ayarları görüntülemek için giriş yapmalısınız. Yönlendiriliyor...</p>
         <Loader2 className="h-8 w-8 animate-spin text-primary ml-2" />
      </div>
    );
  }
  
  const isCurrentlyPremium = isCurrentUserPremium();

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Ayarlar</CardTitle>
          </div>
          <CardDescription>Hesap, gizlilik ve uygulama tercihlerinizi yönetin.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Hesap</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/profile/edit">
              <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle (Ad, Bio, Fotoğraf)
            </Link>
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Gizlilik Ayarları</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50">
                <Label htmlFor="postsVisibleToFriendsOnly" className="flex-1 cursor-pointer text-sm">
                    Gönderilerimi sadece arkadaşlarım görsün
                </Label>
                <Switch
                    id="postsVisibleToFriendsOnly"
                    checked={privacySettings.postsVisibleToFriendsOnly}
                    onCheckedChange={(checked) => handlePrivacySettingChange('postsVisibleToFriendsOnly', checked)}
                    disabled={isSavingPrivacy}
                />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50">
                <Label htmlFor="activeRoomsVisibleToFriendsOnly" className="flex-1 cursor-pointer text-sm">
                    Aktif odalarımı sadece arkadaşlarım görsün
                </Label>
                <Switch
                    id="activeRoomsVisibleToFriendsOnly"
                    checked={privacySettings.activeRoomsVisibleToFriendsOnly}
                    onCheckedChange={(checked) => handlePrivacySettingChange('activeRoomsVisibleToFriendsOnly', checked)}
                    disabled={isSavingPrivacy}
                />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/50">
                <Label htmlFor="feedShowsEveryone" className="flex-1 cursor-pointer text-sm">
                    Akışımda herkesin gönderilerini gör
                </Label>
                <Switch
                    id="feedShowsEveryone"
                    checked={privacySettings.feedShowsEveryone}
                    onCheckedChange={(checked) => handlePrivacySettingChange('feedShowsEveryone', checked)}
                    disabled={isSavingPrivacy}
                />
            </div>
            <div className="flex justify-end">
                <Button onClick={handleSavePrivacySettings} disabled={isSavingPrivacy} size="sm">
                    {isSavingPrivacy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Gizlilik Ayarlarını Kaydet
                </Button>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <CardTitle className="text-xl">Premium Bilgileri</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
            {isCurrentlyPremium && userData ? (
              <>
                <p className="flex items-center gap-1.5">
                  Durum: <span className="font-semibold text-yellow-500 capitalize">{userData.premiumStatus} Premium</span>
                </p>
                {userData.premiumExpiryDate && (
                  <p className="flex items-center gap-1.5">
                    Geçerlilik Tarihi: <span className="font-medium text-foreground">{format(userData.premiumExpiryDate.toDate(), "dd MMMM yyyy, HH:mm", { locale: tr })}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Şu anda aktif bir premium aboneliğiniz bulunmuyor.</p>
            )}
            <div className="pt-2">
              <Button asChild variant="outline" className="w-full sm:w-auto border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">
                <Link href="/store">
                  <ShoppingBag className="mr-2 h-4 w-4" /> {isCurrentlyPremium ? "Premium'u Yönet" : "Premium Paketleri Gör"}
                </Link>
              </Button>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MicIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Mikrofon Testi</CardTitle>
          </div>
          <CardDescription className="text-sm">Mikrofonunuzun çalışıp çalışmadığını test edin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleToggleMicTest} disabled={isUserLoading} className="w-full sm:w-auto" variant="outline">
            {isTestingMic ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            {isTestingMic ? "Testi Durdur" : "Mikrofon Testini Başlat"}
          </Button>
          <audio ref={audioPlaybackRef} autoPlay className={isTestingMic ? "block w-full mt-2 rounded-md" : "hidden"} controls={isTestingMic}></audio>
          {micError && <p className="text-xs text-destructive">{micError}</p>}
          {!micError && isTestingMic && <p className="text-xs text-muted-foreground">Sesinizi duyuyor olmalısınız.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Diğer Bağlantılar</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button asChild variant="outline" className="w-full">
                <Link href="/friends"> <Users className="mr-2 h-4 w-4" /> Arkadaşlarım</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
                <Link href="/store"><ShoppingBag className="mr-2 h-4 w-4" /> Mağaza</Link>
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Görünüm Ayarları</CardTitle>
          </div>
          <CardDescription className="text-sm">Uygulamanın temasını kişiselleştirin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="theme-select" className="text-sm font-medium">Uygulama Teması</Label>
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

      <Card className="bg-transparent border-none shadow-none">
        <CardContent className="p-0 pt-2 space-y-3">
            {userData?.role === 'admin' && (
                <Button
                variant="outline"
                className="w-full border-purple-500 text-purple-500 hover:bg-purple-500/10 hover:text-purple-600"
                onClick={() => setIsAdminPanelOpen(true)}
                disabled={isUserLoading}
                >
                <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Paneli
                </Button>
            )}
            <Button
                onClick={async () => await logOut()}
                variant="destructive"
                className="w-full"
                disabled={isUserLoading}
            >
                {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
                Çıkış Yap
            </Button>
        </CardContent>
      </Card>

    </div>
  );
}
