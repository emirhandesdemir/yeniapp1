
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal } from "lucide-react"; 
import { Button } from "@/components/ui/button"; 
import { useAuth } from "@/contexts/AuthContext"; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; 
import { useToast } from "@/hooks/use-toast"; 
import { db } from "@/lib/firebase"; 
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore"; 
import { useState } from "react"; 

export interface Post {
  id: string;
  userId: string;
  username: string | null;
  userAvatar: string | null;
  content: string;
  createdAt: Timestamp;
  likeCount: number;
  commentCount: number;
  likedBy: string[];
}

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();
  const [isLiking, setIsLiking] = useState(false);

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "SK";
  };

  const formattedDate = post.createdAt
    ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  const isOwnPost = currentUser?.uid === post.userId;
  const hasLiked = currentUser ? post.likedBy.includes(currentUser.uid) : false;

  const handleDeletePost = async () => {
    if (!isOwnPost) return;
    if (!confirm("Bu gönderiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      toast({ title: "Başarılı", description: "Gönderi silindi." });
      // Note: UI'dan kaldırma işlemi FeedList tarafından yönetilecek (onSnapshot sayesinde)
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({ title: "Hata", description: "Gönderi silinirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const handleLikePost = async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Beğenmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const postRef = doc(db, "posts", post.id);

    try {
      if (hasLiked) {
        // Unlike
        await updateDoc(postRef, {
          likeCount: increment(-1),
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        // Like
        await updateDoc(postRef, {
          likeCount: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
      }
      // UI güncellemesi onSnapshot ile FeedList tarafından yapılacak.
    } catch (error) {
      console.error("Error liking/unliking post:", error);
      toast({ title: "Hata", description: "Beğeni işlemi sırasında bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 rounded-xl">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.userAvatar || `https://placehold.co/40x40.png`} data-ai-hint="user avatar post" />
          <AvatarFallback>{getAvatarFallbackText(post.username)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-foreground">{post.username || "Bilinmeyen Kullanıcı"}</p>
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            </div>
            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDeletePost} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    Gönderiyi Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1 pb-3">
        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-2 flex justify-start gap-2 sm:gap-4 border-t">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary px-2" onClick={() => toast({title: "Yakında!", description:"Yorum yapma özelliği yakında eklenecek."})}>
          <MessageCircle className="h-4 w-4 mr-1.5" />
          <span className="text-xs">{post.commentCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-green-500 px-2" onClick={() => toast({title: "Yakında!", description:"Yeniden paylaşma özelliği yakında eklenecek."})}>
          <Repeat className="h-4 w-4 mr-1.5" />
          {/* <span className="text-xs">0</span>  Retweet count eklenebilir */}
        </Button>
        <Button variant="ghost" size="sm" className={`px-2 ${hasLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}`} onClick={handleLikePost} disabled={isLiking || !currentUser}>
          <Heart className={`h-4 w-4 mr-1.5 ${hasLiked ? 'fill-current' : ''}`} />
          <span className="text-xs">{post.likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-blue-500 px-2 ml-auto" onClick={() => toast({title: "Yakında!", description:"Paylaşma özelliği yakında eklenecek."})}>
          <Share className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
