
"use client";
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Timestamp } from 'firebase/firestore';

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
}

interface DirectMessageItemProps {
  msg: DirectMessage;
  currentUserPhotoURL?: string | null;
  currentUserDisplayName?: string | null;
  getAvatarFallbackText: (name?: string | null) => string;
}

const DirectMessageItem: React.FC<DirectMessageItemProps> = React.memo(({
  msg,
  currentUserPhotoURL,
  currentUserDisplayName,
  getAvatarFallbackText,
}) => {
  return (
    <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
      {!msg.isOwn && (
          <Avatar className="h-7 w-7 self-end mb-1">
              <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
              <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
          </Avatar>
      )}
      <div className={`flex flex-col max-w-[70%] sm:max-w-[65%]`}>
          <div className={`p-2.5 sm:p-3 shadow-md ${
              msg.isOwn
              ? "bg-primary text-primary-foreground rounded-t-2xl rounded-l-2xl"
              : "bg-secondary text-secondary-foreground rounded-t-2xl rounded-r-2xl"
          }`}>
          <div className="allow-text-selection">
            <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
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
DirectMessageItem.displayName = 'DirectMessageItem';
export default DirectMessageItem;
