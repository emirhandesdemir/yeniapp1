
"use client";
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";
import { Star } from 'lucide-react'; 
import { useAuth, checkUserPremium, type UserData } from '@/contexts/AuthContext'; // UserData import edildi
import { cn } from '@/lib/utils'; // cn import edildi

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
  getAvatarFallbackText: (name?: string | null) => string;
}

const DirectMessageItem: React.FC<DirectMessageItemProps> = React.memo(({
  msg,
  getAvatarFallbackText,
}) => {
  const { userData: currentUserData } = useAuth();

  const getDisplayAvatar = () => {
    if (msg.isOwn) return currentUserData?.photoURL;
    return msg.senderAvatar;
  };

  const getDisplayName = () => {
    if (msg.isOwn) return currentUserData?.displayName || "Siz";
    return msg.senderName;
  };

  const getIsPremium = () => {
    if (msg.isOwn) return checkUserPremium(currentUserData);
    return msg.senderIsPremium;
  };

  const displayAvatarSrc = getDisplayAvatar();
  const displayNameText = getDisplayName();
  const displayIsPremium = getIsPremium();

  return (
    <div key={msg.id} className={cn("flex items-end gap-2 my-1.5", msg.isOwn ? "justify-end" : "justify-start")}>
      {!msg.isOwn && (
          <Link href={`/profile/${msg.senderId}`} className="self-end mb-1 relative flex-shrink-0 transition-transform hover:scale-110">
            <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={msg.senderAvatar || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "person talking"} />
                <AvatarFallback>{getAvatarFallbackText(msg.senderName)}</AvatarFallback>
            </Avatar>
            {msg.senderIsPremium && <Star className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
          </Link>
      )}
      <div className={cn(
          "flex flex-col max-w-[75%] sm:max-w-[70%]",
          msg.isOwn ? "items-end" : "items-start"
      )}>
          <div className={cn(
              "p-2.5 sm:p-3 shadow-md break-words",
              msg.isOwn
              ? "bg-primary text-primary-foreground rounded-t-xl rounded-l-xl sm:rounded-t-2xl sm:rounded-l-2xl"
              : "bg-secondary text-secondary-foreground rounded-t-xl rounded-r-xl sm:rounded-t-2xl sm:rounded-r-2xl"
          )}>
            <div className="allow-text-selection">
                <p className="text-sm">{msg.text}</p>
            </div>
          </div>
          <p className={cn(
              "text-[10px] sm:text-xs mt-1 px-1",
              msg.isOwn ? "text-muted-foreground/70 text-right" : "text-muted-foreground/80 text-left"
          )}>
              {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Gönderiliyor..."}
          </p>
      </div>
      {msg.isOwn && (
        <div className="relative self-end mb-1 cursor-default flex-shrink-0">
            <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={displayAvatarSrc || `https://placehold.co/40x40.png`} data-ai-hint={msg.userAiHint || "user avatar"} />
                <AvatarFallback>{getAvatarFallbackText(displayNameText)}</AvatarFallback>
            </Avatar>
            {displayIsPremium && <Star className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
        </div>
      )}
    </div>
  );
});
DirectMessageItem.displayName = 'DirectMessageItem';
export default DirectMessageItem;
    
