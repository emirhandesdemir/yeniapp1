
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Timestamp, doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface CommentData {
  id: string;
  userId: string;
  username: string | null;
  userAvatar: string | null;
  content: string;
  createdAt: Timestamp;
}

interface CommentCardProps {
  comment: CommentData;
  postId: string;
  onCommentDeleted: () => void; // Callback to notify parent about deletion
}

export default function CommentCard({ comment, postId, onCommentDeleted }: CommentCardProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const formattedDate = comment.createdAt
    ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  const isOwnComment = currentUser?.uid === comment.userId;

  const handleDeleteComment = async () => {
    if (!isOwnComment) return;
    if (!confirm("Bu yorumu silmek istediğinizden emin misiniz?")) return;

    setIsDeleting(true);
    try {
      // Delete comment document
      const commentRef = doc(db, `posts/${postId}/comments`, comment.id);
      await deleteDoc(commentRef);

      // Decrement commentCount on the post document
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentCount: increment(-1),
      });
      
      onCommentDeleted(); // Notify parent
      toast({ title: "Başarılı", description: "Yorum silindi." });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({ title: "Hata", description: "Yorum silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 dark:bg-muted/20 border border-border/50">
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={comment.userAvatar || `https://placehold.co/32x32.png`} data-ai-hint="user avatar comment" />
        <AvatarFallback>{getAvatarFallbackText(comment.username)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-xs text-foreground">{comment.username || "Bilinmeyen Kullanıcı"}</p>
            <p className="text-[10px] text-muted-foreground/80">{formattedDate}</p>
          </div>
          {isOwnComment && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteComment}
              disabled={isDeleting}
              aria-label="Yorumu Sil"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
        <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
          {comment.content}
        </p>
      </div>
    </div>
  );
}
