
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX_POST_LENGTH = 280;

export default function CreatePostForm() {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData || !content.trim()) {
      toast({
        title: "Hata",
        description: "Gönderi içeriği boş olamaz veya kullanıcı bilgileri eksik.",
        variant: "destructive",
      });
      return;
    }

    if (content.length > MAX_POST_LENGTH) {
      toast({
        title: "Hata",
        description: `Gönderi en fazla ${MAX_POST_LENGTH} karakter olabilir.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        username: userData.displayName,
        userAvatar: userData.photoURL,
        content: content.trim(),
        createdAt: serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
        likedBy: [],
      });
      setContent("");
      toast({ title: "Başarılı", description: "Gönderiniz paylaşıldı!" });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Hata",
        description: "Gönderi oluşturulurken bir sorun oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "SK";
  };

  const remainingChars = MAX_POST_LENGTH - content.length;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-headline">Ne düşünüyorsun?</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start space-x-3">
            <Avatar className="h-10 w-10 mt-1">
              <AvatarImage src={userData?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar" />
              <AvatarFallback>{getAvatarFallbackText(userData?.displayName)}</AvatarFallback>
            </Avatar>
            <Textarea
              placeholder="Düşüncelerini paylaş..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={MAX_POST_LENGTH}
              className="flex-1 resize-none"
              disabled={isSubmitting || !currentUser}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className={`text-xs ${remainingChars < 20 ? (remainingChars < 0 ? 'text-destructive' : 'text-orange-500') : 'text-muted-foreground'}`}>
              {remainingChars} karakter kaldı
            </p>
            <Button type="submit" disabled={isSubmitting || !content.trim() || !currentUser || remainingChars < 0}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Paylaş
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
