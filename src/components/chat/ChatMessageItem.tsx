
"use client";
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, MessageSquare, Gamepad2, ExternalLink, LogOut, Star, Flag, Ban, Sparkles, Trash2, AlertTriangle, Edit2, ThumbsUp, Heart, Laugh, PartyPopper, HelpCircle, Copy, Smile as SmileIcon, Check } from "lucide-react";
import type { UserData, FriendRequest } from '@/contexts/AuthContext';
import { Timestamp, doc, deleteDoc as deleteFirestoreDoc, updateDoc } from 'firebase/firestore';
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth, checkUserPremium } from '@/contexts/AuthContext';
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
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNowStrict } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";


interface Message {
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
  isGameMessage?: boolean;
  isChestMessage?: boolean;
  mentionedUserIds?: string[];
  editedAt?: Timestamp | null;
  reactions?: { [key: string]: string[] };
}

interface ChatMessageItemProps {
  msg: Message;
  currentUserUid?: string;
  popoverOpenForUserId: string | null;
  onOpenUserInfoPopover: (senderId: string) => void;
  setPopoverOpenForUserId: (userId: string | null) => void;
  popoverLoading: boolean;
  popoverTargetUser: UserData | null;
  friendshipStatus: "friends" | "request_sent" | "request_received" | "none";
  relevantFriendRequest: FriendRequest | null;
  onAcceptFriendRequestPopover: () => void;
  onSendFriendRequestPopover: () => void;
  onDmAction: (targetUserId: string | undefined | null) => void;
  onViewProfileAction: (targetUserId: string | undefined | null) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  isCurrentUserRoomCreator: boolean;
  onKickParticipantFromTextChat?: (targetUserId: string, targetUsername?: string) => void;
  roomId: string;
  isActiveParticipant: boolean;
  onStartEdit: (messageId: string, currentText: string) => void;
  onMessageDeleted: (messageId: string) => void;
  onMessageEdited: (messageId: string, newText: string, editedAt: Timestamp) => void;
}

const PREDEFINED_REACTIONS = [
    { emoji: "👍", name: "Beğen", icon: <ThumbsUp className="h-4 w-4" /> },
    { emoji: "❤️", name: "Sevgi", icon: <Heart className="h-4 w-4" /> },
    { emoji: "😂", name: "Gülme", icon: <Laugh className="h-4 w-4" /> },
    { emoji: "🎉", name: "Kutlama", icon: <PartyPopper className="h-4 w-4" /> },
    { emoji: "🤔", name: "Düşünme", icon: <HelpCircle className="h-4 w-4" /> },
];

const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(({
  msg,
  currentUserUid,
  popoverOpenForUserId,
  onOpenUserInfoPopover,
  setPopoverOpenForUserId,
  popoverLoading,
  popoverTargetUser,
  friendshipStatus,
  relevantFriendRequest,
  onAcceptFriendRequestPopover,
  onSendFriendRequestPopover,
  onDmAction,
  onViewProfileAction,
  getAvatarFallbackText,
  isCurrentUserRoomCreator,
  onKickParticipantFromTextChat,
  roomId,
  isActiveParticipant,
  onStartEdit,
  onMessageDeleted
}) => {
  const { reportUser, blockUser, unblockUser, checkIfUserBlocked, userData: currentUserData, currentUser } = useAuth();
  const { toast } = useToast();
  const [isTargetUserBlocked, setIsTargetUserBlocked] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout>();


  useEffect(() => {
    if (popoverOpenForUserId === msg.senderId && popoverTargetUser && currentUserUid !== msg.senderId) {
      checkIfUserBlocked(msg.senderId).then(setIsTargetUserBlocked);
    }
  }, [popoverOpenForUserId, msg.senderId, popoverTargetUser, currentUserUid, checkIfUserBlocked]);
  
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
    setIsMenuOpen(false); // Close menu when editing starts
  };

  const handleReportUserConfirmation = async () => {
    if (!popoverTargetUser) return;
    setIsReportDialogOpen(false);
    await reportUser(popoverTargetUser.uid, reportReason.trim() || `Sohbet odası mesajı şikayeti (${msg.id})`);
    setReportReason("");
  };

  const handleBlockOrUnblockUserFromPopover = async () => {
    if (!popoverTargetUser) return;
    setActionLoading(true);
    if (isTargetUserBlocked) {
        await unblockUser(popoverTargetUser.uid);
        setIsTargetUserBlocked(false);
    } else {
        await blockUser(popoverTargetUser.uid, popoverTargetUser.displayName, popoverTargetUser.photoURL);
        setIsTargetUserBlocked(true);
    }
    setActionLoading(false);
  };

  const handleDeleteMessage = async () => {
    if (!msg.isOwn || !roomId || !msg.id) return;
    setIsProcessingDelete(true);
    setShowDeleteConfirm(false);
    try {
      const messageRef = doc(db, `chatRooms/${roomId}/messages`, msg.id);
      await deleteFirestoreDoc(messageRef);
      // Let onSnapshot handle the UI update
      toast({ title: "Başarılı", description: "Mesajınız silindi." });
    } catch (error) {
      console.error("Error deleting chat message:", error);
      toast({ title: "Hata", description: "Mesaj silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsProcessingDelete(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!currentUser || !roomId || !msg.id) return;

    const messageRef = doc(db, `chatRooms/${roomId}/messages`, msg.id);
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


  const renderMessageWithMentions = React.useCallback((text: string, currentUsername?: string | null) => {
    const parts = text.split(/(@[\w.-]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        if (username === currentUsername) {
          return <strong key={index} className="text-yellow-300 dark:text-yellow-400 bg-yellow-500/20 dark:bg-yellow-600/30 px-1 rounded">{part}</strong>;
        }
        return <strong key={index} className="text-blue-400 dark:text-blue-300">{part}</strong>;
      }
      return part;
    });
  }, []);


  const getSystemMessageContent = (message: Message) => {
    let icon = <Gamepad2 className="inline h-4 w-4 mr-1.5 text-primary" />;
    if (message.text.toLowerCase().includes("tebrikler")) {
        icon = <Star className="inline h-4 w-4 mr-1.5 text-yellow-400" />;
    } else if (message.text.toLowerCase().includes("ipucu")) {
        icon = <Sparkles className="inline h-4 w-4 mr-1.5 text-accent" />;
    } else if (message.isChestMessage) {
        icon = <Sparkles className="inline h-4 w-4 mr-1.5 text-yellow-400" />;
    }
    return (
        <>
            {icon}
            <span className="font-medium text-foreground/80">{message.senderName}: </span>
            {message.text}
        </>
    );
};

if ((msg.isGameMessage || msg.isChestMessage) && msg.senderId === "system") {
    return (
      <div key={msg.id} className="w-full max-w-md mx-auto my-2">
        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-gradient-to-r from-primary/10 via-secondary/20 to-accent/10 border border-border/50 shadow-sm">
           {getSystemMessageContent(msg)}
        </div>
      </div>
    );
  }

  const currentUsersActualPhoto = currentUserData?.photoURL;
  const currentUsersActualDisplayName = currentUserData?.displayName;
  const currentUsersActualIsPremium = checkUserPremium(currentUserData);
  
  const bubbleStyle = msg.isOwn ? (currentUserData?.bubbleStyle || 'default') : (msg.senderBubbleStyle || 'default');
  const frameStyle = msg.isOwn ? (currentUserData?.avatarFrameStyle || 'default') : (msg.senderAvatarFrameStyle || 'default');
  
  const isMentioned = msg.mentionedUserIds && msg.mentionedUserIds.includes(currentUserUid || '');

  let baseBubbleClasses = msg.isOwn
    ? "bg-primary text-primary-foreground rounded-t-2xl rounded-l-2xl"
    : "bg-secondary text-secondary-foreground rounded-t-2xl rounded-r-2xl";
  
  let bubbleClasses = cn(baseBubbleClasses, `bubble-${bubbleStyle}`);
  
  let textClasses = "text-sm whitespace-pre-wrap break-words";

  if (isMentioned) {
    if (msg.isOwn) {
      bubbleClasses = cn(baseBubbleClasses, `bubble-${bubbleStyle}`, "ring-2 ring-offset-1 ring-offset-card ring-amber-400 dark:ring-amber-500 shadow-lg scale-[1.01] transform");
      textClasses = "text-sm font-medium whitespace-pre-wrap break-words";
    } else {
      bubbleClasses = cn(baseBubbleClasses, `bubble-${bubbleStyle}`, "ring-2 ring-offset-1 ring-offset-card ring-amber-600 dark:ring-amber-700 shadow-lg scale-[1.02] transform transition-transform duration-150 ease-out");
      if(bubbleStyle === 'default'){
        bubbleClasses = cn(bubbleClasses, "bg-amber-400 dark:bg-amber-500 text-black dark:text-amber-950");
      }
      textClasses = "text-sm font-semibold whitespace-pre-wrap break-words";
    }
  }


  return (
    <div key={msg.id} className={`flex items-end gap-2.5 my-1 group ${msg.isOwn ? "justify-end" : ""}`}>
      {!msg.isOwn && (
        <Popover open={popoverOpenForUserId === msg.senderId} onOpenChange={(isOpen) => {
            if (!isOpen) setPopoverOpenForUserId(null);
            else if (msg.senderId !== currentUserUid) onOpenUserInfoPopover(msg.senderId);
        }}>
            <PopoverTrigger asChild>
                <Link href={`/profile/${msg.senderId}`} className="self-end mb-1 cursor-pointer">
                    <div className={cn('relative flex-shrink-0', `avatar-frame-${frameStyle}`)}>
                        <Avatar className="h-7 w-7">
                            <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                            <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
                        </Avatar>
                        {isActiveParticipant && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-card shadow" title="Odada Aktif"></div>}
                        {msg.senderIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
                    </div>
                </Link>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="top" align="start">
                {popoverLoading && popoverOpenForUserId === msg.senderId && <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                {!popoverLoading && popoverTargetUser && popoverOpenForUserId === msg.senderId && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Link href={`/profile/${popoverTargetUser.uid}`} className="relative">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={popoverTargetUser.photoURL || `https://placehold.co/80x80.png`} data-ai-hint="user portrait" />
                                    <AvatarFallback>{getAvatarFallbackText(popoverTargetUser.displayName)}</AvatarFallback>
                                </Avatar>
                                {popoverTargetUser.isPremium && <Star className="absolute -bottom-1 -right-1 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow" />}
                            </Link>
                            <div>
                                <Link href={`/profile/${popoverTargetUser.uid}`}>
                                <p className="text-sm font-semibold truncate hover:underline">{popoverTargetUser.displayName || "Kullanıcı"}</p>
                                </Link>
                                <p className="text-xs text-muted-foreground truncate">{popoverTargetUser.email}</p>
                            </div>
                        </div>
                        <hr className="my-2"/>
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onViewProfileAction(popoverTargetUser?.uid)}>
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Profili Görüntüle
                        </Button>
                        {friendshipStatus === "friends" && <p className="text-xs text-green-600 text-center py-1 px-2 rounded bg-green-500/10">Arkadaşsınız.</p>}
                        {friendshipStatus === "request_sent" && <p className="text-xs text-blue-600 text-center py-1 px-2 rounded bg-blue-500/10">Arkadaşlık isteği gönderildi.</p>}
                        {friendshipStatus === "request_received" && relevantFriendRequest && (
                            <Button size="sm" className="w-full text-xs" onClick={onAcceptFriendRequestPopover} disabled={popoverLoading}>
                                <UserCircle className="mr-1.5 h-3.5 w-3.5" /> İsteği Kabul Et
                            </Button>
                        )}
                        {friendshipStatus === "none" && (
                            <Button size="sm" variant="outline" className="w-full text-xs" onClick={onSendFriendRequestPopover} disabled={popoverLoading}>
                                <UserCircle className="mr-1.5 h-3.5 w-3.5" /> Arkadaş Ekle
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onDmAction(popoverTargetUser?.uid)} >
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> DM Gönder
                        </Button>
                        <hr className="my-1"/>
                        <Button size="sm" variant="outline" className="w-full text-xs text-orange-600 border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-700" onClick={() => setIsReportDialogOpen(true)}>
                            <Flag className="mr-1.5 h-3.5 w-3.5" /> Şikayet Et
                        </Button>
                        <Button
                            size="sm"
                            variant={isTargetUserBlocked ? "secondary" : "destructive"}
                            className="w-full text-xs"
                            onClick={handleBlockOrUnblockUserFromPopover}
                            disabled={actionLoading}
                        >
                            {actionLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Ban className="mr-1.5 h-3.5 w-3.5" />}
                            {isTargetUserBlocked ? "Engeli Kaldır" : "Engelle"}
                        </Button>
                        {isCurrentUserRoomCreator && msg.senderId !== currentUserUid && onKickParticipantFromTextChat && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full text-xs mt-1"
                            onClick={() => onKickParticipantFromTextChat(msg.senderId, popoverTargetUser?.displayName || "Kullanıcı")}
                            disabled={popoverLoading}
                          >
                            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Odadan At
                          </Button>
                        )}
                    </div>
                )}
            </PopoverContent>
        </Popover>
      )}
      <div className={cn(`flex flex-col max-w-[70%] sm:max-w-[65%]`, isMentioned && !msg.isOwn && 'max-w-[75%] sm:max-w-[70%]')}>
          {!msg.isOwn && (
                <Link href={`/profile/${msg.senderId}`} className="self-start">
                    <span className="text-xs text-muted-foreground mb-0.5 px-2 cursor-pointer hover:underline">{msg.senderName}</span>
                </Link>
          )}
           <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
                <div
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onContextMenu={handleContextMenu}
                    className={cn("relative p-2.5 sm:p-3 shadow-md group/bubble cursor-pointer", bubbleClasses)}
                >
                    <p className={cn(textClasses, "allow-text-selection")}>
                        {renderMessageWithMentions(msg.text, currentUsersActualDisplayName)}
                        {msg.editedAt && <span className="text-[10px] opacity-70 ml-1.5 italic">(düzenlendi)</span>}
                    </p>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={msg.isOwn ? "end" : "start"} className="w-48">
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
                <DropdownMenuItem onClick={handleCopyText}><Copy className="mr-2 h-4 w-4" /> Metni Kopyala</DropdownMenuItem>
                {msg.isOwn && (
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
                        onClick={() => handleReaction(emoji)}
                        disabled={!currentUser}
                    >
                        <span className="mr-0.5">{emoji}</span>
                        <span>{users.length}</span>
                    </Button>
                    );
                })}
                </div>
            )}
          <p className={`text-[10px] sm:text-xs mt-1 px-2 ${msg.isOwn ? "text-primary-foreground/60 text-right" : "text-muted-foreground/80 text-left"}`}>
              {msg.timestamp ? formatDistanceToNowStrict(msg.timestamp.toDate(), { addSuffix: true, locale: tr }) : "Gönderiliyor..."}
          </p>
      </div>
      {msg.isOwn && (
        <div className={cn('relative self-end mb-1 cursor-default', `avatar-frame-${frameStyle}`)}>
            <Avatar className="h-7 w-7">
                <AvatarImage src={currentUsersActualPhoto || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(currentUsersActualDisplayName)}</AvatarFallback>
            </Avatar>
            {isActiveParticipant && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-card shadow" title="Odada Aktif"></div>}
            {currentUsersActualIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
        </div>
      )}
       <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Şikayet Et</AlertDialogTitle>
            <AlertDialogDescription>
                {popoverTargetUser?.displayName || "Bu kullanıcıyı"} şikayet etmek için bir neden belirtebilirsiniz (isteğe bağlı). Şikayetiniz incelenecektir.
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
    </div>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem';
export default ChatMessageItem;
