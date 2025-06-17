
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Timestamp, collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, ChevronDown, ChevronUp, Loader2 } from "lucide-react"; 
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
import { useState, useEffect } from "react"; 
import CommentForm from "./CommentForm";
import CommentCard, { type CommentData } from "./CommentCard";

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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(post.commentCount);

  useEffect(() => {
    setLocalCommentCount(post.commentCount);
  }, [post.commentCount]);

  useEffect(() => {
    if (showComments && post.id) {
      setLoadingComments(true);
      const commentsQuery = query(
        collection(db, `posts/${post.id}/comments`),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(
        commentsQuery,
        (snapshot) => {
          const fetchedComments: CommentData[] = [];
          snapshot.forEach((doc) => {
            fetchedComments.push({ id: doc.id, ...doc.data() } as CommentData);
          });
          setComments(fetchedComments);
          setLoadingComments(false);
        },
        (error) => {
          console.error('Error fetching comments:', error);
          toast({ title: 'Hata', description: 'Yorumlar yüklenirken bir sorun oluştu.', variant: 'destructive' });
          setLoadingComments(false);
        }
      );
      return () => unsubscribe();
    } else {
      setComments([]); 
    }
  }, [showComments, post.id, toast]);


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
        await updateDoc(postRef, {
          likeCount: increment(-1),
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        await updateDoc(postRef, {
          likeCount: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
      }
    } catch (error) {
      console.error("Error liking/unliking post:", error);
      toast({ title: "Hata", description: "Beğeni işlemi sırasında bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsLiking(false);
    }
  };
  
  // Callbacks for CommentForm and CommentCard to update local count
  const handleCommentAdded = () => {
    // Firestore's increment will update post.commentCount, which should trigger a re-render.
    // If FeedList doesn't re-render PostCard with new post prop, this local update is a fallback.
    // However, onSnapshot on FeedList for posts would be better.
    // For now, we directly update the display. A parent component re-render would sync it.
    setLocalCommentCount(prev => prev + 1);
  };

  const handleCommentDeleted = () => {
    setLocalCommentCount(prev => Math.max(0, prev - 1));
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
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-primary px-2" 
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="h-4 w-4 mr-1.5" />
          <span className="text-xs">{localCommentCount}</span> {/* Display localCommentCount */}
          {showComments ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-green-500 px-2" onClick={() => toast({title: "Yakında!", description:"Yeniden paylaşma özelliği yakında eklenecek."})}>
          <Repeat className="h-4 w-4 mr-1.5" />
        </Button>
        <Button variant="ghost" size="sm" className={`px-2 ${hasLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}`} onClick={handleLikePost} disabled={isLiking || !currentUser}>
          <Heart className={`h-4 w-4 mr-1.5 ${hasLiked ? 'fill-current' : ''}`} />
          <span className="text-xs">{post.likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-blue-500 px-2 ml-auto" onClick={() => toast({title: "Yakında!", description:"Paylaşma özelliği yakında eklenecek."})}>
          <Share className="h-4 w-4" />
        </Button>
      </CardFooter>

      {showComments && (
        <div className="p-4 border-t bg-card/50 dark:bg-background/30 rounded-b-xl">
          <CommentForm postId={post.id} onCommentAdded={handleCommentAdded} />
          {loadingComments && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="ml-2 text-xs text-muted-foreground">Yorumlar yükleniyor...</p>
            </div>
          )}
          {!loadingComments && comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Henüz yorum yok. İlk yorumu sen yap!</p>
          )}
          {!loadingComments && comments.length > 0 && (
            <div className="space-y-3 mt-4">
              {comments.map((comment) => (
                <CommentCard 
                  key={comment.id} 
                  comment={comment} 
                  postId={post.id} 
                  onCommentDeleted={handleCommentDeleted}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
