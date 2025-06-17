
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Timestamp, collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, serverTimestamp } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, ChevronDown, ChevronUp, Loader2, LogIn, LinkIcon as SharedRoomIcon } from "lucide-react";
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
import Link from "next/link";

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
  sharedRoomId?: string;
  sharedRoomName?: string;

  // Repost specific fields
  isRepost?: boolean;
  originalPostId?: string;
  originalPostUserId?: string;
  originalPostUsername?: string | null;
  originalPostUserAvatar?: string | null;
  originalPostContent?: string;
  originalPostCreatedAt?: Timestamp;
  originalPostSharedRoomId?: string;
  originalPostSharedRoomName?: string;
}

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
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

  const formattedDate = (timestamp?: Timestamp) => {
    return timestamp
    ? formatDistanceToNow(timestamp.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";
  }


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

  const handleRepost = async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Yeniden paylaşmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (isReposting) return;

    setIsReposting(true);

    const postToRepost = post.isRepost ? { 
      id: post.originalPostId,
      userId: post.originalPostUserId,
      username: post.originalPostUsername,
      userAvatar: post.originalPostUserAvatar,
      content: post.originalPostContent,
      createdAt: post.originalPostCreatedAt,
      sharedRoomId: post.originalPostSharedRoomId,
      sharedRoomName: post.originalPostSharedRoomName,
    } : post; 

    if (!postToRepost.id || !postToRepost.userId || !postToRepost.content) {
        toast({ title: "Hata", description: "Yeniden paylaşılacak orijinal gönderi bilgileri eksik.", variant: "destructive" });
        setIsReposting(false);
        return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        userId: currentUser.uid,
        username: userData.displayName,
        userAvatar: userData.photoURL,
        createdAt: serverTimestamp(),
        isRepost: true,
        originalPostId: postToRepost.id,
        originalPostUserId: postToRepost.userId,
        originalPostUsername: postToRepost.username,
        originalPostUserAvatar: postToRepost.userAvatar,
        originalPostContent: postToRepost.content,
        originalPostCreatedAt: postToRepost.createdAt,
        originalPostSharedRoomId: postToRepost.sharedRoomId,
        originalPostSharedRoomName: postToRepost.sharedRoomName,
        likeCount: 0,
        commentCount: 0,
        likedBy: [],
      });
      toast({ title: "Başarılı!", description: "Gönderi yeniden paylaşıldı." });
    } catch (error) {
      console.error("Error reposting:", error);
      toast({ title: "Hata", description: "Gönderi yeniden paylaşılamadı.", variant: "destructive" });
    } finally {
      setIsReposting(false);
    }
  };


  const handleCommentAdded = () => {
    setLocalCommentCount(prev => prev + 1);
  };

  const handleCommentDeleted = () => {
    setLocalCommentCount(prev => Math.max(0, prev - 1));
  };

  const renderOriginalPostContent = (originalPost: Partial<Post>) => (
    <Card className="mt-2 mb-1 p-3 border-border/70 bg-muted/30 dark:bg-muted/20 shadow-inner">
      <CardHeader className="flex flex-row items-start gap-2.5 p-0 pb-2">
        <Link href={`/profile/${originalPost.userId}`} className="flex-shrink-0">
            <Avatar className="h-8 w-8">
            <AvatarImage src={originalPost.userAvatar || `https://placehold.co/32x32.png`} data-ai-hint="original user avatar repost" />
            <AvatarFallback>{getAvatarFallbackText(originalPost.username)}</AvatarFallback>
            </Avatar>
        </Link>
        <div className="flex-1">
            <Link href={`/profile/${originalPost.userId}`}>
                <p className="font-semibold text-xs text-foreground/80 hover:underline">{originalPost.username || "Bilinmeyen Kullanıcı"}</p>
            </Link>
          <p className="text-[10px] text-muted-foreground/70">{formattedDate(originalPost.createdAt)}</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">
          {originalPost.content}
        </p>
        {originalPost.sharedRoomId && originalPost.sharedRoomName && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <Button asChild variant="outline" size="xs" className="w-full border-primary/30 text-primary/80 hover:bg-primary/10 hover:text-primary/90">
              <Link href={`/chat/${originalPost.sharedRoomId}`}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Katıl: {originalPost.sharedRoomName}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );


  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 rounded-xl">
      <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
        <Link href={`/profile/${post.userId}`} className="flex-shrink-0">
            <Avatar className="h-10 w-10">
            <AvatarImage src={post.userAvatar || `https://placehold.co/40x40.png`} data-ai-hint="user avatar post" />
            <AvatarFallback>{getAvatarFallbackText(post.username)}</AvatarFallback>
            </Avatar>
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
                <Link href={`/profile/${post.userId}`}>
                    <p className="font-semibold text-sm text-foreground hover:underline">{post.username || "Bilinmeyen Kullanıcı"}</p>
                </Link>
              <p className="text-xs text-muted-foreground">{formattedDate(post.createdAt)}</p>
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
        {post.isRepost ? (
          <>
            <p className="text-xs text-muted-foreground mb-1.5">
              {/* Repost yapan kullanıcı kendi profiline yönlendirilmeli, orijinal değil */}
              <Link href={`/profile/${post.userId}`} className="font-medium hover:underline">
                {post.username}
              </Link>
              {' '} yeniden paylaştı:
            </p>
            {renderOriginalPostContent({
              userId: post.originalPostUserId, // Original user ID for link
              username: post.originalPostUsername,
              userAvatar: post.originalPostUserAvatar,
              content: post.originalPostContent,
              createdAt: post.originalPostCreatedAt,
              sharedRoomId: post.originalPostSharedRoomId,
              sharedRoomName: post.originalPostSharedRoomName,
            })}
          </>
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )}

        {!post.isRepost && post.sharedRoomId && post.sharedRoomName && (
          <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-primary/80 mb-1.5">
              Bu gönderide bir sohbet odası paylaşıldı:
            </p>
            <Button asChild variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-primary/20 hover:text-primary">
              <Link href={`/chat/${post.sharedRoomId}`}>
                <LogIn className="mr-2 h-4 w-4" />
                Katıl: {post.sharedRoomName}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-2 flex justify-start gap-2 sm:gap-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary px-2"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="h-4 w-4 mr-1.5" />
          <span className="text-xs">{localCommentCount}</span>
          {showComments ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
        <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-green-500 px-2" 
            onClick={handleRepost} 
            disabled={isReposting || !currentUser}
        >
          {isReposting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Repeat className="h-4 w-4 mr-1.5" />}
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
