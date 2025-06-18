
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, checkUserPremium } from "@/contexts/AuthContext"; // checkUserPremium eklendi
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, increment, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Star } from "lucide-react"; // Star eklendi
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX_COMMENT_LENGTH = 180;

interface CommentFormProps {
  postId: string;
  onCommentAdded: () => void; 
}

export default function CommentForm({ postId, onCommentAdded }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData || !content.trim()) {
      toast({
        title: "Hata",
        description: "Yorum içeriği boş olamaz veya kullanıcı bilgileri eksik.",
        variant: "destructive",
      });
      return;
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      toast({
        title: "Hata",
        description: `Yorum en fazla ${MAX_COMMENT_LENGTH} karakter olabilir.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const userIsCurrentlyPremium = checkUserPremium(userData);

    try {
      await addDoc(collection(db, `posts/${postId}/comments`), {
        userId: currentUser.uid,
        username: userData.displayName,
        userAvatar: userData.photoURL,
        commenterIsPremium: userIsCurrentlyPremium, // Eklendi
        content: content.trim(),
        createdAt: serverTimestamp(),
      });

      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentCount: increment(1),
      });
      
      setContent("");
      onCommentAdded(); 
      toast({ title: "Başarılı", description: "Yorumunuz gönderildi!" });
    } catch (error) {
      console.error("Error creating comment:", error);
      toast({
        title: "Hata",
        description: "Yorum gönderilirken bir sorun oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "HW"; 
  };

  const remainingChars = MAX_COMMENT_LENGTH - content.length;
  const userIsCurrentlyPremium = checkUserPremium(userData);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-start space-x-2">
        <div className="relative flex-shrink-0">
            <Avatar className="h-8 w-8 mt-1">
            <AvatarImage src={userData?.photoURL || `https://placehold.co/32x32.png`} data-ai-hint="user avatar comment form" />
            <AvatarFallback>{getAvatarFallbackText(userData?.displayName)}</AvatarFallback>
            </Avatar>
            {userIsCurrentlyPremium && (
                <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />
            )}
        </div>
        <Textarea
          placeholder="Yorumunu yaz..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={MAX_COMMENT_LENGTH}
          className="flex-1 resize-none text-sm"
          disabled={isSubmitting || !currentUser}
        />
      </div>
      <div className="flex justify-between items-center">
        <p className={`text-xs ${remainingChars < 20 ? (remainingChars < 0 ? 'text-destructive' : 'text-orange-500') : 'text-muted-foreground'}`}>
          {remainingChars}
        </p>
        <Button type="submit" size="sm" disabled={isSubmitting || !content.trim() || !currentUser || remainingChars < 0}>
          {isSubmitting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Gönder
        </Button>
      </div>
    </form>
  );
}

    