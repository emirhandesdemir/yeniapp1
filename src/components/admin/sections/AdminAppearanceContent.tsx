
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Palette, ShieldAlert, Save, Brush, Framer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StyleConfig {
    [key: string]: boolean;
}

interface AppearanceConfig {
    bubbleStyles: StyleConfig;
    avatarFrameStyles: StyleConfig;
}

const allBubbleStyles = [
    { id: 'default', name: 'Varsayılan' },
    { id: 'sparkle', name: 'Parıltı' },
    { id: 'neon-green', name: 'Neon Yeşil' },
    { id: 'gradient-blue', name: 'Mavi Gradient' },
    { id: 'gradient-purple', name: 'Mor Gradient' },
    { id: 'striped', name: 'Çizgili' },
    { id: 'snake', name: 'Yılan' },
];

const allAvatarFrameStyles = [
    { id: 'default', name: 'Yok' },
    { id: 'gold', name: 'Altın' },
    { id: 'silver', name: 'Gümüş' },
    { id: 'neon-pink', name: 'Neon Pembe' },
    { id: 'angel-wings', name: 'Melek Kanatları' },
    { id: 'tech-ring', name: 'Teknoloji Halkası' },
    { id: 'snake', name: 'Yılan' },
];

export default function AdminAppearanceContent() {
  const [config, setConfig] = useState<AppearanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const configDocRef = doc(db, "appSettings", "appearanceConfig");
      const docSnap = await getDoc(configDocRef);
      if (docSnap.exists()) {
        setConfig(docSnap.data() as AppearanceConfig);
      } else {
        // Create a default config if it doesn't exist
        const defaultConfig: AppearanceConfig = {
          bubbleStyles: allBubbleStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
          avatarFrameStyles: allAvatarFrameStyles.reduce((acc, style) => ({ ...acc, [style.id]: true }), {}),
        };
        await setDoc(configDocRef, defaultConfig);
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.error("Error fetching appearance config:", error);
      toast({ title: "Hata", description: "Görünüm ayarları yüklenemedi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (adminUserData?.role === 'admin') {
      fetchConfig();
    }
  }, [adminUserData, fetchConfig]);

  const handleToggle = (type: 'bubbleStyles' | 'avatarFrameStyles', id: string, checked: boolean) => {
    setConfig(prev => {
        if (!prev) return null;
        return {
            ...prev,
            [type]: {
                ...prev[type],
                [id]: checked,
            },
        };
    });
  };

  const handleSaveChanges = async () => {
    if (!config) return;
    setSaving(true);
    try {
        const configDocRef = doc(db, "appSettings", "appearanceConfig");
        await updateDoc(configDocRef, config);
        toast({ title: "Başarılı", description: "Görünüm ayarları kaydedildi." });
    } catch (error) {
        console.error("Error saving appearance config:", error);
        toast({ title: "Hata", description: "Ayarlar kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Görünüm ayarları yükleniyor...</p>
      </div>
    );
  }

  if (adminUserData?.role !== 'admin') {
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

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Görünüm Yönetimi</CardTitle>
          </div>
          <CardDescription>Kullanıcılara sunulan sohbet baloncuklarını ve avatar çerçevelerini yönetin. Kapalı stiller ayarlarda görünmez.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Brush className="h-5 w-5 text-primary"/>
                    <CardTitle className="text-xl font-semibold">Baloncuk Stilleri</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {allBubbleStyles.map(style => (
                    <div key={style.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                        <Label htmlFor={`bubble-${style.id}`} className="font-medium text-sm">{style.name}</Label>
                        <Switch
                            id={`bubble-${style.id}`}
                            checked={config?.bubbleStyles[style.id] ?? true}
                            onCheckedChange={(checked) => handleToggle('bubbleStyles', style.id, checked)}
                            disabled={saving}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Framer className="h-5 w-5 text-primary"/>
                    <CardTitle className="text-xl font-semibold">Avatar Çerçeveleri</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {allAvatarFrameStyles.map(style => (
                    <div key={style.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                        <Label htmlFor={`frame-${style.id}`} className="font-medium text-sm">{style.name}</Label>
                        <Switch
                            id={`frame-${style.id}`}
                            checked={config?.avatarFrameStyles[style.id] ?? true}
                            onCheckedChange={(checked) => handleToggle('avatarFrameStyles', style.id, checked)}
                            disabled={saving}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveChanges} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <Save className="mr-2 h-4 w-4"/> Değişiklikleri Kaydet
        </Button>
      </div>
    </div>
  );
}
