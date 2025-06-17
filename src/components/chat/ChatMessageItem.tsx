
"use client";
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, MessageSquare, Gamepad2, ExternalLink } from "lucide-react"; // ExternalLink eklendi
import type { UserData, FriendRequest } from '@/contexts/AuthContext';
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
  isGameMessage?: boolean;
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
  onViewProfileAction: (targetUserId: string | undefined | null) => void; // Yeni prop
  getAvatarFallbackText: (name?: string | null) => string;
  currentUserPhotoURL?: string | null;
  currentUserDisplayName?: string | null;
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
  onViewProfileAction, // Kullanılıyor
  getAvatarFallbackText,
  currentUserPhotoURL,
  currentUserDisplayName,
}) => {
  if (msg.isGameMessage) {
    let icon = <Gamepad2 className="inline h-4 w-4 mr-1.5 text-primary" />;

    return (
      <div key={msg.id} className="w-full max-w-md mx-auto my-2">
        <div className="text-xs text-center text-muted-foreground p-2 rounded-md bg-gradient-to-r from-primary/10 via-secondary/20 to-accent/10 border border-border/50 shadow-sm">
           {icon}
           {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
      {!msg.isOwn && (
        <Popover open={popoverOpenForUserId === msg.senderId} onOpenChange={(isOpen) => {
            if (!isOpen) setPopoverOpenForUserId(null);
        }}>
            <PopoverTrigger asChild onClick={() => onOpenUserInfoPopover(msg.senderId)}>
                <Avatar className="h-7 w-7 cursor-pointer self-end mb-1">
                    <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                    <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
                </Avatar>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="top" align="start">
                {popoverLoading && popoverOpenForUserId === msg.senderId && <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                {!popoverLoading && popoverTargetUser && popoverOpenForUserId === msg.senderId && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Link href={`/profile/${popoverTargetUser.uid}`}>
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={popoverTargetUser.photoURL || `https://placehold.co/80x80.png`} data-ai-hint="user portrait" />
                                    <AvatarFallback>{getAvatarFallbackText(popoverTargetUser.displayName)}</AvatarFallback>
                                </Avatar>
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
                    </div>
                )}
            </PopoverContent>
        </Popover>
      )}
      <div className={`flex flex-col max-w-[70%] sm:max-w-[65%]`}>
          {!msg.isOwn && (
                <Link href={`/profile/${msg.senderId}`} className="self-start">
                    <span className="text-xs text-muted-foreground mb-0.5 px-2 cursor-pointer hover:underline">{msg.senderName}</span>
                </Link>
          )}
          <div className={`p-2.5 sm:p-3 shadow-md ${
              msg.isOwn
              ? "bg-primary text-primary-foreground rounded-t-2xl rounded-l-2xl"
              : "bg-secondary text-secondary-foreground rounded-t-2xl rounded-r-2xl"
          }`}>
          <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
          <p className={`text-[10px] sm:text-xs mt-1 px-2 ${msg.isOwn ? "text-primary-foreground/60 text-right" : "text-muted-foreground/80 text-left"}`}>
              {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Gönderiliyor..."}
          </p>
      </div>
      {msg.isOwn && (
        <Avatar className="h-7 w-7 cursor-default self-end mb-1">
            <AvatarImage src={currentUserPhotoURL || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
            <AvatarFallback>{getAvatarFallbackText(currentUserDisplayName)}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem';
export default ChatMessageItem;
