
"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";
import { Star, Trash2, Loader2, Edit2, ThumbsUp, Heart, Laugh, PartyPopper, HelpCircle, Copy, Smile as SmileIcon } from 'lucide-react';
import { useAuth, checkUserPremium, type UserData } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
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
import { db } from '@/lib/firebase';
import { doc, deleteDoc as deleteFirestoreDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNowStrict } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean;
  senderBubbleStyle?: string;
  senderAvatarFrameStyle?: string;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  editedAt?: Timestamp | null;
  reactions?: { [key: string]: string[] };
}

interface DirectMessageItemProps {
  msg: DirectMessage;
  getAvatarFallbackText: (name?: string | null) => string;
  chatId: string;
  onStartEdit: (messageId: string, currentText: string) => void;
  isMatchSession?: boolean;
}

const PREDEFINED_REACTIONS = [
    { emoji: "👍", name: "Beğen", icon: <ThumbsUp className="h-4 w-4" /> },
    { emoji: "❤️", name: "Sevgi", icon: <Heart className="h-4 w-4" /> },
    { emoji: "😂", name: "Gülme", icon: <Laugh className="h-4 w-4" /> },
    { emoji: "🎉", name: "Kutlama", icon: <PartyPopper className="h-4 w-4" /> },
    { emoji: "🤔", name: "Düşünme", icon: <HelpCircle className="h-4 w-4" /> },
];

const DirectMessageItem: React.FC<DirectMessageItemProps> = React.memo(({
  msg,
  getAvatarFallbackText,
  chatId,
  onStartEdit,
  isMatchSession,
}) => {
  const { userData: currentUserData, currentUser } = useAuth();
  const { toast } = useToast();

  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout>();

  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      setIsMenuOpen(true);
    }, 500);
  };
  
  const handlePointerUp = () => {
    clearTimeout(pressTimer.current);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(true);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(msg.text);
    toast({ title: "Kopyalandı", description: "Mesaj panoya kopyalandı." });
    setIsMenuOpen(false);
  };

  const handleEditMessage = () => {
    onStartEdit(msg.id, msg.text);
    setIsMenuOpen(false);
  };

  const bubbleStyle = msg.isOwn ? (currentUserData?.bubbleStyle || 'default') : (msg.senderBubbleStyle || 'default');
  const frameStyle = msg.isOwn ? (currentUserData?.avatarFrameStyle || 'default') : (msg.senderAvatarFrameStyle || 'default');
  const displayAvatarSrc = msg.isOwn ? currentUserData?.photoURL : msg.senderAvatar;
  const displayNameText = msg.isOwn ? currentUserData?.displayName || "Siz" : msg.senderName;
  const displayIsPremium = msg.isOwn ? checkUserPremium(currentUserData) : msg.senderIsPremium;

  const handleDeleteMessage = async () => {
    if (!msg.isOwn || !chatId || !msg.id) return;
    setIsProcessingDelete(true);
    setShowDeleteConfirm(false);
    try {
      const messageRef = doc(db, `directMessages/${chatId}/messages`, msg.id);
      await deleteFirestoreDoc(messageRef);
      toast({ title: "Başarılı", description: "Mesajınız silindi." });
    } catch (error) {
      console.error("Error deleting direct message:", error);
      toast({ title: "Hata", description: "Mesaj silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUser || !chatId || !msg.id || isMatchSession) return;

    const messageRef = doc(db, `directMessages/${chatId}/messages`, msg.id);
    const currentReactions = { ...(msg.reactions || {}) };
    let userPreviousReactionEmoji: string | null = null;

    for (const e in currentReactions) {
        if (currentReactions[e]?.includes(currentUser.uid)) {
            userPreviousReactionEmoji = e;
            break;
        }
    }

    if (userPreviousReactionEmoji === emoji) {
        currentReactions[emoji] = (currentReactions[emoji] || []).filter(uid => uid !== currentUser.uid);
        if (currentReactions[emoji].length === 0) {
            delete currentReactions[emoji];
        }
    } else {
        if (userPreviousReactionEmoji) {
            currentReactions[userPreviousReactionEmoji] = (currentReactions[userPreviousReactionEmoji] || []).filter(uid => uid !== currentUser.uid);
            if (currentReactions[userPreviousReactionEmoji].length === 0) {
                delete currentReactions[userPreviousReactionEmoji];
            }
        }
        currentReactions[emoji] = [...(currentReactions[emoji] || []), currentUser.uid];
    }

    try {
      await updateDoc(messageRef, { reactions: currentReactions });
    } catch (error) {
      console.error("Error updating reactions:", error);
      toast({ title: "Hata", description: "Tepki verilirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const AvatarContainer: React.FC<{children: React.ReactNode, isLink: boolean, userId: string, currentFrameStyle: string}> = ({ children, isLink, userId, currentFrameStyle }) => {
    const className = cn('self-end mb-1 relative flex-shrink-0 transition-transform hover:scale-110', `avatar-frame-${currentFrameStyle}`);
    if (isLink) {
      return <Link href={`/profile/${userId}`} className={className}>{children}</Link>;
    }
    return <div className={className}>{children}</div>;
  };


  return (
    <>
    <div key={msg.id} className={cn("flex items-end gap-2 my-1.5 group", msg.isOwn ? "justify-end" : "justify-start")}>
      {!msg.isOwn && (
          <AvatarContainer isLink={!isMatchSession} userId={msg.senderId} currentFrameStyle={frameStyle}>
            <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
            </Avatar>
            {msg.senderIsPremium && <Star className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
          </AvatarContainer>
      )}
      <div className={cn(
          "flex flex-col max-w-[75%] sm:max-w-[70%]",
          msg.isOwn ? "items-end" : "items-start"
      )}>
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <div
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onContextMenu={handleContextMenu}
                className={cn(
                    "relative p-2.5 sm:p-3 shadow-md break-words group/bubble cursor-pointer",
                    `bubble-${bubbleStyle}`,
                    msg.isOwn
                    ? "bg-primary text-primary-foreground rounded-t-xl rounded-l-xl sm:rounded-t-2xl sm:rounded-l-2xl"
                    : "bg-secondary text-secondary-foreground rounded-t-xl rounded-r-xl sm:rounded-t-2xl sm:rounded-r-2xl"
                )}
                >
                <div className="allow-text-selection">
                    <p className="text-sm">{msg.text}</p>
                    {msg.editedAt && <span className="text-[10px] opacity-70 ml-1.5 italic">(düzenlendi)</span>}
                </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={msg.isOwn ? "end" : "start"} className="w-48">
              {!isMatchSession && (
                  <DropdownMenuSub>
                      <DropdownMenuSubTrigger><SmileIcon className="mr-2 h-4 w-4" /> Tepki Ver</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-1">
                          <div className="flex gap-1">
                          {PREDEFINED_REACTIONS.map(reaction => {
                              const userHasReactedWithThis = (msg.reactions?.[reaction.emoji] || []).includes(currentUser?.uid || "");
                              return (
                                  <Button
                                      key={reaction.emoji}
                                      variant="ghost"
                                      size="icon"
                                      className={cn("h-7 w-7 rounded-full hover:bg-primary/10", userHasReactedWithThis ? "text-primary" : "text-muted-foreground")}
                                      onClick={() => { handleReaction(reaction.emoji); setIsMenuOpen(false); }}
                                      disabled={!currentUser}
                                      title={reaction.name}
                                  >
                                      {React.cloneElement(reaction.icon as React.ReactElement, { className: cn("h-5 w-5", userHasReactedWithThis && "fill-primary/20") })}
                                  </Button>
                              );
                          })}
                          </div>
                      </DropdownMenuSubContent>
                  </DropdownMenuSub>
              )}
              <DropdownMenuItem onClick={handleCopyText}><Copy className="mr-2 h-4 w-4" /> Metni Kopyala</DropdownMenuItem>
              {msg.isOwn && !isMatchSession && (
                  <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleEditMessage} disabled={isProcessingDelete}>
                          <Edit2 className="mr-2 h-4 w-4" /> Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={isProcessingDelete}>
                          <Trash2 className="mr-2 h-4 w-4" /> Sil
                      </DropdownMenuItem>
                  </>
              )}
          </DropdownMenuContent>
        </DropdownMenu>

           {/* Reactions Display */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={cn("mt-1 flex flex-wrap gap-1", msg.isOwn ? "justify-end" : "justify-start", "px-1")}>
                {Object.entries(msg.reactions).map(([emoji, users]) => {
                    if (!users || users.length === 0) return null;
                    const userHasReacted = users.includes(currentUser?.uid || "");
                    return (
                    <Button
                        key={emoji}
                        variant="outline"
                        size="xs"
                        className={cn(
                            "h-6 px-1.5 py-0.5 text-xs rounded-full border-border/50 hover:border-primary/50",
                            userHasReacted && "bg-primary/10 border-primary/60 text-primary"
                        )}
                        onClick={() => !isMatchSession && handleReaction(emoji)}
                        disabled={!currentUser || isMatchSession}
                    >
                        <span className="mr-0.5">{emoji}</span>
                        <span>{users.length}</span>
                    </Button>
                    );
                })}
                </div>
            )}
          <p className={cn(
              "text-[10px] sm:text-xs mt-1 px-1",
              msg.isOwn ? "text-muted-foreground/70 text-right" : "text-muted-foreground/80 text-left"
          )}>
              {msg.timestamp ? formatDistanceToNowStrict(msg.timestamp.toDate(), { addSuffix: true, locale: tr }) : "Gönderiliyor..."}
          </p>
      </div>
      {msg.isOwn && (
        <AvatarContainer isLink={false} userId={msg.senderId} currentFrameStyle={frameStyle}>
            <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={displayAvatarSrc || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(displayNameText)}</AvatarFallback>
            </Avatar>
            {displayIsPremium && <Star className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
        </AvatarContainer>
      )}
    </div>
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Mesajı Sil</AlertDialogTitle>
                <AlertDialogDescription>
                    Bu mesajı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isProcessingDelete}>İptal</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteMessage}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={isProcessingDelete}
                >
                    {isProcessingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sil
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
});
DirectMessageItem.displayName = 'DirectMessageItem';
export default DirectMessageItem;
