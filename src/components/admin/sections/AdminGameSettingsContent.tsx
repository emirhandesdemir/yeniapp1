
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings2 as GameSettingsIcon, ShieldAlert, Save } from "lucide-react";

interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  isGameEnabled: false,
  questionIntervalSeconds: 180, // 3 minutes
};

export default function AdminGameSettingsContent() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as GameSettings);
        } else {
          // Eğer ayar belgesi yoksa, varsayılanlarla oluşturmayı deneyebilir veya sadece varsayılanları kullanabilir.
          // Şimdilik sadece varsayılanları kullanıyoruz, admin kaydettiğinde oluşturulacak.
          setSettings(DEFAULT_GAME_SETTINGS);
          toast({
            title: "Bilgi",
            description: "Oyun ayarları bulunamadı. Varsayılan ayarlar gösteriliyor. Kaydettiğinizde yeni ayarlar oluşturulacaktır.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error("Error fetching game settings:", error);
        toast({
          title: "Hata",
          description: "Oyun ayarları yüklenirken bir sorun oluştu.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (adminUserData?.role === 'admin') {
      fetchSettings();
    } else if (adminUserData !== undefined) {
      setLoading(false);
    }
  }, [toast, adminUserData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUserData?.role !== 'admin') {
      toast({ title: "Yetki Hatası", description: "Ayarları kaydetmek için admin yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (settings.questionIntervalSeconds < 30) {
        toast({ title: "Geçersiz Değer", description: "Soru aralığı en az 30 saniye olmalıdır.", variant: "destructive" });
        return;
    }

    setSaving(true);
    try {
      const settingsDocRef = doc(db, "appSettings", "gameConfig");
      // setDoc kullanarak belge yoksa oluşturur, varsa üzerine yazar (merge olmadan)
      await setDoc(settingsDocRef, settings); 
      toast({ title: "Başarılı", description: "Oyun ayarları kaydedildi." });
    } catch (error) {
      console.error("Error saving game settings:", error);
      toast({ title: "Hata", description: "Oyun ayarları kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (adminUserData === undefined || (adminUserData === null && loading)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Oyun ayarları yükleniyor...</p>
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
        <p className="ml-2 text-lg">Oyun ayarları yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <GameSettingsIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Oyun Sistemi Ayarları</CardTitle>
          </div>
          <CardDescription>Sohbet odalarındaki quiz oyununun ayarlarını buradan yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="flex items-center space-x-2 border p-4 rounded-md">
              <Switch
                id="isGameEnabled"
                checked={settings.isGameEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isGameEnabled: checked }))}
                disabled={saving}
              />
              <Label htmlFor="isGameEnabled" className="text-base">
                Oyun Sistemini Etkinleştir
              </Label>
            </div>
            <div className="space-y-2 border p-4 rounded-md">
              <Label htmlFor="questionIntervalSeconds" className="text-base">
                Sorular Arası Süre (saniye cinsinden)
              </Label>
              <Input
                id="questionIntervalSeconds"
                type="number"
                value={settings.questionIntervalSeconds}
                onChange={(e) => setSettings(prev => ({ ...prev, questionIntervalSeconds: parseInt(e.target.value, 10) || 0 }))}
                min="30" // Minimum 30 saniye
                disabled={saving || !settings.isGameEnabled}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Yeni bir oyun sorusunun ne kadar sürede bir sorulacağını belirler. Örn: 180 (3 dakika). Minimum 30 saniye.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || loading}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Ayarları Kaydet
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
