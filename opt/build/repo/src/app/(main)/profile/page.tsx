
"use client";

import { useState, useEffect, type ChangeEvent, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, Users, LockKeyhole, ShieldCheck, Eye, UsersRound, ImagePlus, ShoppingBag, Mic as MicIcon, PauseCircle, PlayCircle, Star, Trash2, Settings, Edit3, LogOutIcon, LayoutDashboard, Save, ExternalLink, Brush, Framer, MessageSquare, CheckCircle } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { format, isPast } from "date-fns";
import { tr } from "date-fns/locale";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'Sistem Varsayılanı' },
  { value: 'light', label: 'Açık Tema' },
  { value: 'dark', label: 'Koyu Tema' },
];

const bubbleStyles = [
  { id: 'default', name: 'Varsayılan' },
  { id: 'sparkle', name: 'Parıltı' },
  { id: 'neon-green', name: 'Neon Yeşil' },
  { id: 'gradient-blue', name: 'Mavi Gradient' },
  { id: 'gradient-purple', name: 'Mor Gradient' },
  { id: 'striped', name: 'Çizgili' },
  { id: 'snake', name: 'Yılan' },
];

const avatarFrameStyles = [
  { id: 'default', name: 'Yok' },
  { id: 'gold', name: 'Altın' },
  { id: 'silver', name: 'Gümüş' },
  { id: 'neon-pink', name: 'Neon Pembe' },
  { id: 'angel-wings', name: 'Melek Kanatları' },
  { id: 'tech-ring', name: 'Teknoloji Halkası' },
  { id: 'snake', name: 'Yılan' },
];

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut",
    },
  }),
};

interface AppearanceConfig {
    bubbleStyles: { [key: string]: boolean };
    avatarFrameStyles: { [key: string]: boolean };
}

export default function SettingsPage() {
  const { currentUser, userData, updateUserProfile, isUserLoading, logOut, isCurrentUserPremium } = useAuth();
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
  
  const [selectedBubbleStyle, setSelectedBubbleStyle] = useState('default');
  const [selectedFrameStyle, setSelectedFrameStyle] = useState('default');
  
  const [appearanceConfig, setAppearanceConfig] = useState<AppearanceConfig | null>(null);
  const [loadingAppearanceConfig, setLoadingAppearanceConfig] = useState(true);

  useEffect(() => {
    const fetchAppearanceConfig = async () => {
        setLoadingAppearanceConfig(true);
        try {
            const configDocRef = doc(db, 'appSettings', 'appearanceConfig');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
                setAppearanceConfig(docSnap.data() as AppearanceConfig);
            } else {
                // If it doesn't exist, create a default where everything is enabled
                const defaultConfig: AppearanceConfig = {
                    bubbleStyles: bubbleStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
                    avatarFrameStyles: avatarFrameStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
                };
                setAppearanceConfig(defaultConfig);
            }
        } catch (error) {
            console.error("Error fetching appearance config:", error);
            // Fallback to all enabled on error
            setAppearanceConfig({
                bubbleStyles: bubbleStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
                avatarFrameStyles: avatarFrameStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
            });
        } finally {
            setLoadingAppearanceConfig(false);
        }
    };
    fetchAppearanceConfig();
  }, []);

  const enabledBubbleStyles = useMemo(() => {
    if (!appearanceConfig) return [];
    return bubbleStyles.filter(style => appearanceConfig.bubbleStyles[style.id] !== false); // default to true if not set
  }, [appearanceConfig]);

  const enabledAvatarFrameStyles = useMemo(() => {
      if (!appearanceConfig) return [];
      return avatarFrameStyles.filter(style => appearanceConfig.avatarFrameStyles[style.id] !== false); // default to true if not set
  }, [appearanceConfig]);


  useEffect(() => {
    document.title = 'Ayarlar - HiweWalk';
    if (userData) {
      setPrivacySettings({
        postsVisibleToFriendsOnly: userData.privacySettings?.postsVisibleToFriendsOnly ?? false,
        activeRoomsVisibleToFriendsOnly: userData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
        feedShowsEveryone: userData.privacySettings?.feedShowsEveryone ?? true,
      });
      setSelectedBubbleStyle(userData.bubbleStyle || 'default');
      setSelectedFrameStyle(userData.avatarFrameStyle || 'default');
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
  
  const handleAppearanceChange = useCallback(async (type: 'bubble' | 'frame', style: string) => {
    if (type === 'bubble') {
        setSelectedBubbleStyle(style);
        await updateUserProfile({ bubbleStyle: style });
    } else {
        setSelectedFrameStyle(style);
        await updateUserProfile({ avatarFrameStyle: style });
    }
    toast({ title: 'Kaydedildi!', description: `${type === 'bubble' ? 'Baloncuk stilin' : 'Avatar çerçeven'} güncellendi.` });
  }, [updateUserProfile, toast]);
  

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
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground">Ayarlar Yükleniyor</h2>
        <p className="text-muted-foreground mt-2">Kişisel tercihlerinizi getiriyoruz...</p>
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
      <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-xl rounded-xl border-border/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-7 w-7 text-primary" />
              <CardTitle className="text-2xl font-headline">Ayarlar</CardTitle>
            </div>
            <CardDescription className="text-sm">Hesap, gizlilik ve uygulama tercihlerinizi yönetin.</CardDescription>
          </CardHeader>
        </Card>
      </motion.div>

      <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Hesap</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto rounded-md hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all">
              <Link href="/profile/edit">
                <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle (Ad, Bio, Fotoğraf)
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Brush className="h-5 w-5 text-primary"/>
                    <CardTitle className="text-xl font-semibold">Sohbet Görünümü</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {loadingAppearanceConfig ? (
                    <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="bubble-style">
                        <AccordionTrigger>Baloncuk Stili</AccordionTrigger>
                        <AccordionContent>
                            <div className="p-4 bg-muted/30 rounded-md mb-3">
                                <div className="flex items-end gap-2.5">
                                    <div className={cn("relative flex-shrink-0", `avatar-frame-${selectedFrameStyle}`)}>
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={userData?.photoURL || `https://placehold.co/32x32.png`} />
                                            <AvatarFallback>{userData?.displayName?.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col max-w-[70%]">
                                        <div className={cn("relative p-2.5 shadow-md", `bubble-${selectedBubbleStyle}`)}>
                                            <p className="text-sm whitespace-pre-wrap break-words">Bu bir önizleme mesajıdır.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {enabledBubbleStyles.map(style => (
                                    <Button key={style.id} variant={selectedBubbleStyle === style.id ? 'default' : 'outline'} size="sm" onClick={() => handleAppearanceChange('bubble', style.id)}>
                                        {selectedBubbleStyle === style.id && <CheckCircle className="mr-2 h-4 w-4"/>} {style.name}
                                    </Button>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="frame-style">
                        <AccordionTrigger>Avatar Çerçevesi</AccordionTrigger>
                        <AccordionContent>
                            <div className="flex justify-center p-4 bg-muted/30 rounded-md mb-3">
                                <div className={cn("relative", `avatar-frame-${selectedFrameStyle}`)}>
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={userData?.photoURL || `https://placehold.co/64x64.png`} />
                                        <AvatarFallback>{userData?.displayName?.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {enabledAvatarFrameStyles.map(style => (
                                    <Button key={style.id} variant={selectedFrameStyle === style.id ? 'default' : 'outline'} size="sm" onClick={() => handleAppearanceChange('frame', style.id)}>
                                       {selectedFrameStyle === style.id && <CheckCircle className="mr-2 h-4 w-4"/>} {style.name}
                                    </Button>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
                )}
            </CardContent>
        </Card>
      </motion.div>
      
      <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
              <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl font-semibold">Gizlilik Ayarları</CardTitle>
              </div>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-secondary/30 dark:hover:bg-secondary/20 transition-colors">
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
              <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-secondary/30 dark:hover:bg-secondary/20 transition-colors">
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
              <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-secondary/30 dark:hover:bg-secondary/20 transition-colors">
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
              <div className="flex justify-end pt-2">
                  <Button onClick={handleSavePrivacySettings} disabled={isSavingPrivacy} size="sm" className="rounded-md">
                      {isSavingPrivacy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" /> Gizlilik Ayarlarını Kaydet
                  </Button>
              </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <CardTitle className="text-xl font-semibold">Premium Bilgileri</CardTitle>
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
                <Button asChild variant="outline" className="w-full sm:w-auto border-yellow-500/70 text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-500 rounded-md transition-all">
                  <Link href="/store">
                    <ShoppingBag className="mr-2 h-4 w-4" /> {isCurrentlyPremium ? "Premium'u Yönet" : "Premium Paketleri Gör"}
                  </Link>
                </Button>
              </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={5} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MicIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Mikrofon Testi</CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Mikrofonunuzun çalışıp çalışmadığını test edin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleToggleMicTest} disabled={isUserLoading} className="w-full sm:w-auto rounded-md" variant="outline">
              {isTestingMic ? <PauseCircle className="mr-2 h-4 w-4 text-red-500" /> : <PlayCircle className="mr-2 h-4 w-4 text-green-500" />}
              {isTestingMic ? "Testi Durdur" : "Mikrofon Testini Başlat"}
            </Button>
            <audio ref={audioPlaybackRef} autoPlay className={isTestingMic ? "block w-full mt-2 rounded-md" : "hidden"} controls={isTestingMic}></audio>
            {micError && <p className="text-xs text-destructive">{micError}</p>}
            {!micError && isTestingMic && <p className="text-xs text-muted-foreground">Sesinizi duyuyor olmalısınız.</p>}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={6} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
              <div className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl font-semibold">Diğer Bağlantılar</CardTitle>
              </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button asChild variant="outline" className="w-full rounded-md hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all">
                  <Link href="/friends"> <Users className="mr-2 h-4 w-4" /> Arkadaşlarım</Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-md hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-all">
                  <Link href="/store"><ShoppingBag className="mr-2 h-4 w-4" /> Mağaza</Link>
              </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div custom={7} variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="shadow-lg rounded-xl border-border/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Görünüm Ayarları</CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground">Uygulamanın temasını kişiselleştirin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="theme-select" className="text-sm font-medium">Uygulama Teması</Label>
              <Select value={theme} onValueChange={(value) => setTheme(value as ThemeSetting)}>
                <SelectTrigger id="theme-select" className="mt-1 rounded-md">
                  <SelectValue placeholder="Tema Seçin" />
                </SelectTrigger>
                <SelectContent className="rounded-md">
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
      </motion.div>

      <motion.div custom={8} variants={sectionVariants} initial="hidden" animate="visible" className="pt-2">
          {userData?.role === 'admin' && (
              <Button
                asChild
                variant="outline"
                className="w-full border-purple-500/70 text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 hover:border-purple-600 rounded-md mb-3 transition-all"
                disabled={isUserLoading}
              >
                <Link href="/admin/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Paneli
                </Link>
              </Button>
          )}
          <Button
              onClick={async () => await logOut()}
              variant="destructive"
              className="w-full rounded-md"
              disabled={isUserLoading}
          >
              {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
              Çıkış Yap
          </Button>
      </motion.div>

    </div>
  );
}
