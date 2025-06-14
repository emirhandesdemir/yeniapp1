"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserProfileForm {
  username: string;
  bio: string;
  // email and avatarUrl will be handled by auth context or a future backend
}

export default function ProfilePage() {
  const { currentUser, updateUserProfile, isUserLoading } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfileForm>({ username: "", bio: "" });

  useEffect(() => {
    document.title = 'Profilim - Sohbet Küresi';
    if (currentUser) {
      setTempProfile({
        username: currentUser.displayName || "",
        bio: "", // Bio needs to be fetched from a DB in a real app
      });
    }
  }, [currentUser]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit, revert to current user's data
      if (currentUser) {
        setTempProfile({ username: currentUser.displayName || "", bio: "" });
      }
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!currentUser) {
      toast({ title: "Hata", description: "Profil kaydedilemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return;
    }
    try {
      await updateUserProfile({ displayName: tempProfile.username });
      // photoURL update would go here if we had avatar upload
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      setIsEditing(false);
    } catch (error: any) {
      toast({ title: "Profil Güncelleme Hatası", description: error.message, variant: "destructive" });
    }
  };
  
  const getAvatarFallbackText = () => {
    if (currentUser?.displayName) return currentUser.displayName.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "PN"; // Profile Name
  };


  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Profil yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5">
        <div className="h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-16">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-card shadow-lg">
              <AvatarImage src={currentUser.photoURL || "https://placehold.co/128x128.png"} alt={currentUser.displayName || "Kullanıcı"} data-ai-hint="user portrait" />
              <AvatarFallback>{getAvatarFallbackText()}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <label htmlFor="avatarUpload" className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-8 w-8 text-white" />
                <input 
                  type="file" 
                  id="avatarUpload" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={() => toast({description: "Avatar yükleme özelliği yakında eklenecektir."})}
                  disabled // Placeholder for future functionality
                />
              </label>
            )}
          </div>
          <CardTitle className="mt-4 text-3xl font-headline text-primary-foreground/90">
            {isEditing ? tempProfile.username : currentUser.displayName || "Kullanıcı Adı Yok"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">{currentUser.email}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {isEditing ? (
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div>
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input id="username" name="username" value={tempProfile.username} onChange={handleInputChange} className="mt-1" disabled={isUserLoading}/>
              </div>
              <div>
                <Label htmlFor="email">E-posta (Değiştirilemez)</Label>
                <Input id="email" name="email" value={currentUser.email || ""} readOnly disabled className="mt-1 bg-muted/50"/>
              </div>
              <div>
                <Label htmlFor="bio">Hakkımda</Label>
                <Textarea 
                  id="bio" 
                  name="bio" 
                  value={tempProfile.bio} 
                  onChange={handleInputChange} 
                  rows={4} 
                  className="mt-1" 
                  placeholder="Kendinizden bahsedin... (Bu özellik yakında eklenecektir)"
                  disabled // Placeholder for future functionality
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleEditToggle} disabled={isUserLoading}>
                  <XCircle className="mr-2 h-4 w-4" /> Vazgeç
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isUserLoading}>
                  {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-primary-foreground/80">Hakkımda</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {tempProfile.bio || "Henüz bir biyografi eklenmemiş. Bu özellik yakında eklenecektir."}
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
