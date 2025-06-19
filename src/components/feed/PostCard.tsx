
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Timestamp, collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, serverTimestamp } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { MessageCircle, Repeat, Heart, Share, MoreHorizontal, ChevronDown, ChevronUp, Loader2, LogIn, LinkIcon as SharedRoomIcon, Trash2, Star, Flag, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, checkUserPremium } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import CommentForm from "./CommentForm";
import CommentCard, { type CommentData } from "./CommentCard";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export interface Post {
  id: string;
  userId: string;
  username: string | null;
  userAvatar: string | null;
  authorIsPremium?: boolean;
  content: string;
  createdAt: Timestamp;
  likeCount: number;
  commentCount: number;
  likedBy: string[];
  sharedRoomId?: string;
  sharedRoomName?: string;

  isRepost?: boolean;
  originalPostId?: string;
  originalPostUserId?: string;
  originalPostUsername?: string | null;
  originalPostUserAvatar?: string | null;
  originalPostAuthorIsPremium?: boolean;
  originalPostContent?: string;
  originalPostCreatedAt?: Timestamp;
  originalPostSharedRoomId?: string;
  originalPostSharedRoomName?: string;
}

interface PostCardProps {
  post: Post;
}

const heartVariants = {
  unliked: { scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  liked: { 
    scale: [1, 1.3, 0.9, 1.1, 1], 
    transition: { duration: 0.4, ease: "easeInOut" } 
  },
};


const PostCard: React.FC<PostCardProps> = React.memo(({ post }) => {
  const { currentUser, userData, reportUser, blockUser, unblockUser, checkIfUserBlocked } = useAuth();
  const { toast } = useToast();

  const [optimisticHasLiked, setOptimisticHasLiked] = useState(false);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(0);

  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(post.commentCount);

  const [isPostAuthorBlocked, setIsPostAuthorBlocked] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    setLocalCommentCount(post.commentCount);
  }, [post.commentCount]);

  useEffect(() => {
    if (currentUser) {
      setOptimisticHasLiked(post.likedBy.includes(currentUser.uid));
    } else {
      setOptimisticHasLiked(false);
    }
    setOptimisticLikeCount(post.likeCount);
  }, [post.likedBy, post.likeCount, currentUser]);

  useEffect(() => {
    if (currentUser && post.userId && currentUser.uid !== post.userId) {
      checkIfUserBlocked(post.userId).then(setIsPostAuthorBlocked);
    }
  }, [currentUser, post.userId, checkIfUserBlocked]);


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


  const getAvatarFallbackText = useCallback((name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "HW";
  }, []);

  const formattedDate = useCallback((timestamp?: Timestamp) => {
    return timestamp
    ? formatDistanceToNow(timestamp.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";
  }, []);


  const isOwnPost = currentUser?.uid === post.userId;

  const handleDeletePost = useCallback(async () => {
    if (!isOwnPost) return;
    if (!confirm("Bu gönderiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      toast({ title: "Başarılı", description: "Gönderi silindi." });
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({ title: "Hata", description: "Gönderi silinirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [isOwnPost, post.id, toast]);

  const handleLikePost = useCallback(async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Beğenmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const postRef = doc(db, "posts", post.id);
    const currentlyLiked = optimisticHasLiked;

    setOptimisticHasLiked(!currentlyLiked);
    setOptimisticLikeCount(prevCount => currentlyLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (currentlyLiked) {
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
      setOptimisticHasLiked(currentlyLiked);
      setOptimisticLikeCount(prevCount => currentlyLiked ? prevCount + 1 : prevCount - 1);
    } finally {
      setIsLiking(false);
    }
  }, [currentUser, userData, post.id, optimisticHasLiked, isLiking, toast]);

  const handleRepost = useCallback(async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Yeniden paylaşmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (isReposting) return;

    setIsReposting(true);
    const currentUserIsPremium = checkUserPremium(userData);

    const postToRepost = post.isRepost ? {
      id: post.originalPostId,
      userId: post.originalPostUserId,
      username: post.originalPostUsername,
      userAvatar: post.originalPostUserAvatar,
      authorIsPremium: post.originalPostAuthorIsPremium,
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
        authorIsPremium: currentUserIsPremium,
        createdAt: serverTimestamp(),
        isRepost: true,
        originalPostId: postToRepost.id,
        originalPostUserId: postToRepost.userId,
        originalPostUsername: postToRepost.username,
        originalPostUserAvatar: postToRepost.userAvatar,
        originalPostAuthorIsPremium: postToRepost.authorIsPremium,
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
  }, [currentUser, userData, isReposting, post, toast]);


  const handleCommentAdded = useCallback(() => {
    setLocalCommentCount(prev => prev + 1);
  }, []);

  const handleCommentDeleted = useCallback(() => {
    setLocalCommentCount(prev => Math.max(0, prev - 1));
  }, []);

  const handleReportUserConfirmation = async () => {
    if (!post.userId) return;
    setIsReportDialogOpen(false);
    await reportUser(post.userId, reportReason.trim() || `Gönderi şikayeti (${post.id})`);
    setReportReason("");
  };

  const handleBlockOrUnblockUser = async () => {
    if (!post.userId) return;
    setIsLiking(true); // Use general loading state
    if (isPostAuthorBlocked) {
        await unblockUser(post.userId);
        setIsPostAuthorBlocked(false);
    } else {
        await blockUser(post.userId);
        setIsPostAuthorBlocked(true);
    }
    setIsLiking(false);
  };

  const renderOriginalPostContent = useCallback((originalPost: Partial<Post>) => (
    <div className="mt-2 mb-1 p-3 border border-border/30 bg-muted/20 dark:bg-muted/15 shadow-inner rounded-lg">
      <header className="flex flex-row items-start gap-2.5 pb-2">
        <Link href={`/profile/${originalPost.userId}`} className="flex-shrink-0 relative">
            <Avatar className="h-8 w-8">
            <AvatarImage src={originalPost.userAvatar || `https://placehold.co/32x32.png`} data-ai-hint="original user avatar repost" />
            <AvatarFallback>{getAvatarFallbackText(originalPost.username)}</AvatarFallback>
            </Avatar>
            {originalPost.authorIsPremium && (
                <Star className="absolute -bottom-1 -right-1 h-3 w-3 text-yellow-400 fill-yellow-400 bg-muted/70 p-px rounded-full shadow" />
            )}
        </Link>
        <div className="flex-1">
            <Link href={`/profile/${originalPost.userId}`}>
                <p className="font-semibold text-xs text-foreground/80 hover:underline">{originalPost.username || "Bilinmeyen Kullanıcı"}</p>
            </Link>
          <p className="text-[10px] text-muted-foreground/70">{formattedDate(originalPost.createdAt)}</p>
        </div>
      </header>
      <div>
        <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap break-words allow-text-selection">
          {originalPost.content}
        </p>
        {originalPost.sharedRoomId && originalPost.sharedRoomName && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <Button asChild variant="outline" size="xs" className="w-full border-primary/30 text-primary/80 hover:bg-primary/10 hover:text-primary/90 text-xs h-7">
              <Link href={`/chat/${originalPost.sharedRoomId}`}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Katıl: {originalPost.sharedRoomName}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  ), [getAvatarFallbackText, formattedDate]);


  return (
    <div className="bg-card/70 dark:bg-card/50 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
      <header className="flex flex-row items-start gap-3 p-3 pb-2">
        <Link href={`/profile/${post.userId}`} className="flex-shrink-0 relative">
            <Avatar className="h-10 w-10">
            <AvatarImage src={post.userAvatar || `https://placehold.co/40x40.png`} data-ai-hint="user avatar post" />
            <AvatarFallback>{getAvatarFallbackText(post.username)}</AvatarFallback>
            </Avatar>
            {post.authorIsPremium && (
                <Star className="absolute -bottom-1 -right-1 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow" />
            )}
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
                <Link href={`/profile/${post.userId}`}>
                    <p className="font-semibold text-sm text-foreground hover:underline">{post.username || "Bilinmeyen Kullanıcı"}</p>
                </Link>
              <p className="text-xs text-muted-foreground">{formattedDate(post.createdAt)}</p>
            </div>
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwnPost ? (
                    <DropdownMenuItem onClick={handleDeletePost} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" /> Gönderiyi Sil
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => { setReportReason(""); setIsReportDialogOpen(true); }}>
                        <Flag className="mr-2 h-4 w-4 text-orange-500" /> Kullanıcıyı Şikayet Et
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBlockOrUnblockUser} className={isPostAuthorBlocked ? "text-green-600 focus:text-green-700" : "text-destructive focus:text-destructive"}>
                        <Ban className="mr-2 h-4 w-4" /> {isPostAuthorBlocked ? "Engeli Kaldır" : "Kullanıcıyı Engelle"}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
      <div className="p-3 pt-1 pb-3">
        {post.isRepost ? (
          <>
            <p className="text-sm text-muted-foreground mb-1.5">
              <Link href={`/profile/${post.userId}`} className="font-medium hover:underline">
                {post.username}
              </Link>
              {' '} yeniden paylaştı:
            </p>
            {renderOriginalPostContent({
              userId: post.originalPostUserId,
              username: post.originalPostUsername,
              userAvatar: post.originalPostUserAvatar,
              authorIsPremium: post.originalPostAuthorIsPremium,
              content: post.originalPostContent,
              createdAt: post.originalPostCreatedAt,
              sharedRoomId: post.originalPostSharedRoomId,
              sharedRoomName: post.originalPostSharedRoomName,
            })}
          </>
        ) : (
          <p className="text-sm text-foreground/95 whitespace-pre-wrap break-words allow-text-selection">
            {post.content}
          </p>
        )}

        {!post.isRepost && post.sharedRoomId && post.sharedRoomName && (
          <div className="mt-3 p-2.5 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-xs text-primary/80 mb-1.5">
              Bu gönderide bir sohbet odası paylaşıldı:
            </p>
            <Button asChild variant="outline" size="sm" className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary h-8 text-xs">
              <Link href={`/chat/${post.sharedRoomId}`}>
                <LogIn className="mr-2 h-3.5 w-3.5" />
                Katıl: {post.sharedRoomName}
              </Link>
            </Button>
          </div>
        )}
      </div>
      <footer className="p-3 pt-2 flex justify-start gap-1 sm:gap-2 border-t border-border/20">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary px-2 py-1.5"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="h-4 w-4 mr-1.5" />
          <span className="text-xs">{localCommentCount}</span>
          {showComments ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
        </Button>
        <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-green-500 px-2 py-1.5"
            onClick={handleRepost}
            disabled={isReposting || !currentUser || isOwnPost}
        >
          {isReposting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Repeat className="h-4 w-4 mr-1.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "px-2 py-1.5 group",
            optimisticHasLiked ? 'text-red-500 hover:bg-red-500/10' : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
          )}
          onClick={handleLikePost}
          disabled={isLiking || !currentUser}
        >
          <motion.div
            variants={heartVariants}
            animate={optimisticHasLiked ? "liked" : "unliked"}
            whileTap={{ scale: 0.8 }}
          >
            <Heart
              className={cn(
                "h-4 w-4 mr-1.5 transition-all duration-150",
                optimisticHasLiked
                  ? "fill-red-500 stroke-red-500"
                  : "fill-none stroke-current group-hover:stroke-red-500"
              )}
            />
          </motion.div>
          <span className="text-xs">{optimisticLikeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-blue-500 px-2 py-1.5 ml-auto" onClick={() => toast({title: "Yakında!", description:"Paylaşma özelliği yakında eklenecek."})}>
          <Share className="h-4 w-4" />
        </Button>
      </footer>

      {showComments && (
        <div className="p-3 border-t border-border/20 bg-card/50 dark:bg-background/30 rounded-b-xl">
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
       <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Şikayet Et</AlertDialogTitle>
            <AlertDialogDescription>
                {post?.username || "Bu kullanıcıyı"} şikayet etmek için bir neden belirtebilirsiniz (isteğe bağlı). Şikayetiniz incelenecektir.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Şikayet nedeni (isteğe bağlı)..."
                className="w-full p-2 border rounded-md min-h-[80px] text-sm bg-background"
            />
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason("")}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportUserConfirmation} className="bg-destructive hover:bg-destructive/90">Şikayet Et</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
PostCard.displayName = 'PostCard';
export default PostCard;

    