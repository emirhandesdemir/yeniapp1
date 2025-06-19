
"use client";
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, MessageSquare, Gamepad2, ExternalLink, LogOut, Star, Flag, Ban, Sparkles } from "lucide-react";
import type { UserData, FriendRequest } from '@/contexts/AuthContext';
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';
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


interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  isGameMessage?: boolean;
  mentionedUserIds?: string[];
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
  currentUserPhotoURL?: string | null;
  currentUserDisplayName?: string | null;
  currentUserIsPremium?: boolean;
  isCurrentUserRoomCreator: boolean;
  onKickParticipantFromTextChat?: (targetUserId: string, targetUsername?: string) => void;
}

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
  currentUserPhotoURL,
  currentUserDisplayName,
  currentUserIsPremium,
  isCurrentUserRoomCreator,
  onKickParticipantFromTextChat,
}) => {
  const { reportUser, blockUser, unblockUser, checkIfUserBlocked } = useAuth();
  const [isTargetUserBlocked, setIsTargetUserBlocked] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  React.useEffect(() => {
    if (popoverOpenForUserId === msg.senderId && popoverTargetUser && currentUserUid !== msg.senderId) {
      checkIfUserBlocked(msg.senderId).then(setIsTargetUserBlocked);
    }
  }, [popoverOpenForUserId, msg.senderId, popoverTargetUser, currentUserUid, checkIfUserBlocked]);


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
        await blockUser(popoverTargetUser.uid);
        setIsTargetUserBlocked(true);
    }
    setActionLoading(false);
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


  if (msg.isGameMessage && msg.senderId === "system") {
    let icon = <Gamepad2 className="inline h-4 w-4 mr-1.5 text-primary" />;
    if (msg.text.toLowerCase().includes("tebrikler")) {
        icon = <Star className="inline h-4 w-4 mr-1.5 text-yellow-400" />;
    } else if (msg.text.toLowerCase().includes("ipucu")) {
        icon = <Sparkles className="inline h-4 w-4 mr-1.5 text-accent" />;
    }

    return (
      <div key={msg.id} className="w-full max-w-md mx-auto my-2">
        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-gradient-to-r from-primary/10 via-secondary/20 to-accent/10 border border-border/50 shadow-sm">
           {icon}
           <span className="font-medium text-foreground/80">{msg.senderName}: </span>
           {msg.text}
        </div>
      </div>
    );
  }


  const isMentioned = msg.mentionedUserIds && msg.mentionedUserIds.includes(currentUserUid || '');

  let bubbleClasses = msg.isOwn
    ? "bg-primary text-primary-foreground rounded-t-2xl rounded-l-2xl"
    : "bg-secondary text-secondary-foreground rounded-t-2xl rounded-r-2xl";

  let textClasses = "text-sm whitespace-pre-wrap break-words";

  if (isMentioned) {
    if (msg.isOwn) {
      bubbleClasses = "bg-primary/90 text-primary-foreground rounded-t-2xl rounded-l-2xl ring-2 ring-offset-1 ring-offset-card ring-amber-400 dark:ring-amber-500 shadow-lg scale-[1.01] transform";
      textClasses = "text-sm font-medium whitespace-pre-wrap break-words";
    } else {
      bubbleClasses = "bg-amber-400 dark:bg-amber-500 text-black dark:text-amber-950 rounded-t-2xl rounded-r-2xl ring-2 ring-offset-1 ring-offset-card ring-amber-600 dark:ring-amber-700 shadow-lg scale-[1.02] transform transition-transform duration-150 ease-out";
      textClasses = "text-sm font-semibold whitespace-pre-wrap break-words";
    }
  }


  return (
    <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
      {!msg.isOwn && (
        <Popover open={popoverOpenForUserId === msg.senderId} onOpenChange={(isOpen) => {
            if (!isOpen) setPopoverOpenForUserId(null);
        }}>
            <PopoverTrigger asChild>
                <Link href={`/profile/${msg.senderId}`} className="relative self-end mb-1 cursor-pointer">
                    <Avatar className="h-7 w-7">
                        <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                        <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
                    </Avatar>
                    {msg.senderIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
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
          <div className={cn(`p-2.5 sm:p-3 shadow-md`, bubbleClasses)}>
              <p className={cn(textClasses, "allow-text-selection")}>
                {renderMessageWithMentions(msg.text, currentUserDisplayName)}
              </p>
          </div>
          <p className={`text-[10px] sm:text-xs mt-1 px-2 ${msg.isOwn ? "text-primary-foreground/60 text-right" : "text-muted-foreground/80 text-left"}`}>
              {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Gönderiliyor..."}
          </p>
      </div>
      {msg.isOwn && (
        <div className="relative self-end mb-1 cursor-default">
            <Avatar className="h-7 w-7">
                <AvatarImage src={currentUserPhotoURL || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(currentUserDisplayName)}</AvatarFallback>
            </Avatar>
            {currentUserIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
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
    </div>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem';
export default ChatMessageItem;
