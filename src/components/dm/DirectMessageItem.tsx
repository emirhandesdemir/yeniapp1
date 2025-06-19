
"use client";
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";
import { Star } from 'lucide-react'; 
import { useAuth, checkUserPremium } from '@/contexts/AuthContext'; // AuthContext import edildi

interface DirectMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderIsPremium?: boolean; 
  timestamp: Timestamp | null;
  isOwn?: boolean;
  userAiHint?: string;
}

interface DirectMessageItemProps {
  msg: DirectMessage;
  // currentUserPhotoURL?: string | null; // Kaldırıldı
  // currentUserDisplayName?: string | null; // Kaldırıldı
  // currentUserIsPremium?: boolean; // Kaldırıldı
  getAvatarFallbackText: (name?: string | null) => string;
}

const DirectMessageItem: React.FC<DirectMessageItemProps> = React.memo(({
  msg,
  // currentUserPhotoURL, // Kaldırıldı
  // currentUserDisplayName, // Kaldırıldı
  // currentUserIsPremium, // Kaldırıldı
  getAvatarFallbackText,
}) => {
  const { userData: currentUserData } = useAuth(); // currentUserData, AuthContext'ten alındı

  const currentUsersActualPhoto = currentUserData?.photoURL;
  const currentUsersActualDisplayName = currentUserData?.displayName;
  const currentUsersActualIsPremium = checkUserPremium(currentUserData);

  return (
    <div key={msg.id} className={`flex items-end gap-2.5 my-1 ${msg.isOwn ? "justify-end" : ""}`}>
      {!msg.isOwn && (
          <Link href={`/profile/${msg.senderId}`} className="self-end mb-1 relative">
            <Avatar className="h-7 w-7">
                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
            </Avatar>
            {msg.senderIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
          </Link>
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
        <div className="relative self-end mb-1 cursor-default">
            <Avatar className="h-7 w-7">
                <AvatarImage src={currentUsersActualPhoto || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(currentUsersActualDisplayName)}</AvatarFallback>
            </Avatar>
            {currentUsersActualIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
        </div>
      )}
    </div>
  );
});
DirectMessageItem.displayName = 'DirectMessageItem';
export default DirectMessageItem;

    