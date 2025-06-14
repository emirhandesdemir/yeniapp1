"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Camera } from "lucide-react";
import type { Metadata } from 'next'; // Not usable in client components directly for dynamic titles.
import { useEffect } from 'react';

// export const metadata: Metadata = { // Static metadata can be in a layout.tsx or page.tsx (server component)
//   title: 'Profilim - Sohbet Küresi',
//   description: 'Kullanıcı profilinizi görüntüleyin ve düzenleyin.',
// };

interface UserProfile {
  username: string;
  email: string;
  bio: string;
  avatarUrl: string;
}

const initialProfile: UserProfile = {
  username: "Kullanıcı123",
  email: "kullanici123@mail.com",
  bio: "Merhaba! Ben Sohbet Küresi'nde yeni maceralar arayan biriyim. Kitap okumayı, müzik dinlemeyi ve yeni insanlarla tanışmayı severim.",
  avatarUrl: "https://placehold.co/128x128.png",
};

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [tempProfile, setTempProfile] = useState<UserProfile>(initialProfile);

  useEffect(() => {
    document.title = 'Profilim - Sohbet Küresi';
  }, []);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit
      setTempProfile(profile);
    } else {
      // Start edit
      setTempProfile(profile);
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setProfile(tempProfile);
    setIsEditing(false);
    // Add API call to save profile here
    console.log("Profile saved:", tempProfile);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5">
        <div className="h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-16">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-card shadow-lg">
              <AvatarImage src={tempProfile.avatarUrl} alt={tempProfile.username} data-ai-hint="user portrait" />
              <AvatarFallback>{tempProfile.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <label htmlFor="avatarUpload" className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-8 w-8 text-white" />
                <input type="file" id="avatarUpload" className="hidden" accept="image/*" />
              </label>
            )}
          </div>
          <CardTitle className="mt-4 text-3xl font-headline text-primary-foreground/90">{profile.username}</CardTitle>
          <CardDescription className="text-muted-foreground">{profile.email}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {isEditing ? (
            <form className="space-y-6">
              <div>
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input id="username" name="username" value={tempProfile.username} onChange={handleInputChange} className="mt-1"/>
              </div>
              <div>
                <Label htmlFor="email">E-posta (Değiştirilemez)</Label>
                <Input id="email" name="email" value={tempProfile.email} readOnly disabled className="mt-1 bg-muted/50"/>
              </div>
              <div>
                <Label htmlFor="bio">Hakkımda</Label>
                <Textarea id="bio" name="bio" value={tempProfile.bio} onChange={handleInputChange} rows={4} className="mt-1" placeholder="Kendinizden bahsedin..."/>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleEditToggle}>
                  <XCircle className="mr-2 h-4 w-4" /> Vazgeç
                </Button>
                <Button type="button" onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Save className="mr-2 h-4 w-4" /> Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-primary-foreground/80">Hakkımda</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {profile.bio || "Henüz bir biyografi eklenmemiş."}
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleEditToggle} variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Edit3 className="mr-2 h-4 w-4" /> Profili Düzenle
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for additional profile sections like activity, friends, etc. */}
      <Card>
        <CardHeader>
          <CardTitle>Aktiviteler</CardTitle>
          <CardDescription>Son aktiviteleriniz burada görünecek.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Henüz aktivite yok.</p>
        </CardContent>
      </Card>
    </div>
  );
}
