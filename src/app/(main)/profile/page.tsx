
"use client";

import { useState, useEffect, type ChangeEvent } from "react"; // Removed useRef
import Image from "next/image"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Mail, Edit3, Save, XCircle, Loader2 } from "lucide-react"; // Removed Camera, UploadCloud
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
  // Removed selectedFile and previewImage state, and fileInputRef as photo upload is disabled

  useEffect(() => {
    document.title = 'Profilim - Sohbet Küresi';
    if (currentUser && userData) { // Ensure userData is also available
      setTempProfile({
        username: userData.displayName || currentUser.displayName || "",
        bio: "", // Assuming bio is not yet implemented or stored in userData
      });
    } else if (currentUser) { // Fallback if userData is somehow not loaded yet but currentUser is
        setTempProfile({
            username: currentUser.displayName || "",
            bio: "",
        });
    }
  }, [currentUser, userData]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      if (currentUser && userData) {
        setTempProfile({ username: userData.displayName || currentUser.displayName || "", bio: "" });
      } else if (currentUser) {
        setTempProfile({ username: currentUser.displayName || "", bio: "" });
      }
    }
    setIsEditing(!isEditing);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempProfile(prev => ({ ...prev, [name]: value }));
  };

  // handleFileChange is removed as photo upload is disabled

  const handleSave = async () => {
    if (!currentUser) return;
    
    const updates: { displayName?: string } = {}; // photoFile removed
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
    // Logic for selectedFile removed

    if (!profileChanged) {
        setIsEditing(false); 
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        return;
    }

    const success = await updateUserProfile(updates); // Pass only displayName update
    if (success) {
      setIsEditing(false);
      // Toast for success is handled by updateUserProfile in AuthContext
    }
    // Toast for failure is also handled by updateUserProfile
  };
  
  const getAvatarFallbackText = () => {
    const nameToUse = isEditing ? tempProfile.username : (userData?.displayName || currentUser?.displayName);
    if (nameToUse) return nameToUse.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "PN"; 
  };


  if (isUserLoading && !currentUser && !userData) { // Show loading if everything is still loading
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

  const displayPhotoUrl = userData?.photoURL || currentUser?.photoURL || "https://placehold.co/128x128.png";


  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
              <AvatarImage 
                src={displayPhotoUrl} 
                alt={tempProfile.username || "Kullanıcı"} 
                data-ai-hint="user portrait" 
              />
              <AvatarFallback>{getAvatarFallbackText()}</AvatarFallback>
            </Avatar>
            {/* Camera icon and file input removed */}
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
              {/* Image preview removed */}
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
