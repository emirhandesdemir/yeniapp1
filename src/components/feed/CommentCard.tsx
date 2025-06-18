
"use client";

import React, { useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Timestamp, doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Trash2, Loader2, Star } from "lucide-react"; // Star eklendi
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export interface CommentData {
  id: string;
  userId: string;
  username: string | null;
  userAvatar: string | null;
  commenterIsPremium?: boolean; // Eklendi
  content: string;
  createdAt: Timestamp;
}

interface CommentCardProps {
  comment: CommentData;
  postId: string;
  onCommentDeleted: () => void;
}

const CommentCard: React.FC<CommentCardProps> = React.memo(({ comment, postId, onCommentDeleted }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const getAvatarFallbackText = useCallback((name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "HW";
  }, []);

  const formattedDate = comment.createdAt
    ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  const isOwnComment = currentUser?.uid === comment.userId;

  const handleDeleteComment = useCallback(async () => {
    if (!isOwnComment) return;
    if (!confirm("Bu yorumu silmek istediğinizden emin misiniz?")) return;

    setIsDeleting(true);
    try {
      const commentRef = doc(db, `posts/${postId}/comments`, comment.id);
      await deleteDoc(commentRef);

      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentCount: increment(-1),
      });

      onCommentDeleted();
      toast({ title: "Başarılı", description: "Yorum silindi." });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({ title: "Hata", description: "Yorum silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [isOwnComment, postId, comment.id, onCommentDeleted, toast]);

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 dark:bg-muted/20 border border-border/50">
      <Link href={`/profile/${comment.userId}`} className="flex-shrink-0 mt-0.5 relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.userAvatar || `https://placehold.co/32x32.png`} data-ai-hint="user avatar comment" />
          <AvatarFallback>{getAvatarFallbackText(comment.username)}</AvatarFallback>
        </Avatar>
        {comment.commenterIsPremium && (
            <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-muted/70 p-px rounded-full shadow" />
        )}
      </Link>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <Link href={`/profile/${comment.userId}`}>
                <p className="font-semibold text-xs text-foreground hover:underline">{comment.username || "Bilinmeyen Kullanıcı"}</p>
            </Link>
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
});
CommentCard.displayName = 'CommentCard';
export default CommentCard;

    