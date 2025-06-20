"use client";

import React, { useEffect, useState } from 'react'; // Ensured full React import
import { motion, PanInfo } from 'framer-motion';
import { X, UserPlus, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { InAppNotificationData } from '@/contexts/InAppNotificationContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface InAppNotificationBannerProps {
  notification: InAppNotificationData;
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_DURATION = 5000;

export default function InAppNotificationBanner({ notification, onDismiss }: InAppNotificationBannerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = React.useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    onDismiss(notification.id);
  }, [isExiting, notification.id, onDismiss]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isHovered && !isExiting) {
      timer = setTimeout(() => {
        handleDismiss();
      }, AUTO_DISMISS_DURATION);
    }
    return () => clearTimeout(timer);
  }, [isHovered, isExiting, handleDismiss]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -30 || info.velocity.y < -200) {
      handleDismiss();
    }
  };
  
  const getIcon = () => {
    switch (notification.type) {
      case 'friend_request':
        return <UserPlus className="h-6 w-6 text-blue-500" />;
      case 'new_dm':
        return <MessageSquareText className="h-6 w-6 text-green-500" />;
      default:
        return <UserPlus className="h-6 w-6 text-primary" />; 
    }
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const content = (
    <motion.div
      layout
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100, transition: { duration: 0.3, ease: "easeIn" } }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }} 
      dragElastic={0.2} 
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-[150] w-[calc(100%-2rem)] max-w-md p-1 rounded-xl shadow-2xl cursor-grab active:cursor-grabbing",
        "bg-card border border-border/60 backdrop-blur-lg bg-opacity-90 dark:bg-opacity-80", 
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
      style={{ WebkitBackdropFilter: 'blur(12px)'}} 
      aria-live="assertive"
      aria-atomic="true"
      role="alertdialog"
      aria-labelledby={`notification-title-${notification.id}`}
      aria-describedby={`notification-message-${notification.id}`}
    >
      <div className="flex items-start gap-3 p-3">
        {notification.avatarUrl || notification.senderName ? (
          <Avatar className="h-10 w-10 mt-0.5 flex-shrink-0">
            <AvatarImage src={notification.avatarUrl || `https://placehold.co/40x40.png`} data-ai-hint="notification sender avatar" />
            <AvatarFallback>{getAvatarFallbackText(notification.senderName)}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="p-2 rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
        )}
        <div className="flex-grow min-w-0">
          <h3 id={`notification-title-${notification.id}`} className="text-sm font-semibold text-foreground truncate">{notification.title}</h3>
          <p id={`notification-message-${notification.id}`} className="text-xs text-muted-foreground break-words line-clamp-2">
            {notification.message}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }} 
          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0 ml-auto -mr-1 -mt-1"
          aria-label="Bildirimi kapat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isHovered && !isExiting && (
         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1/3 bg-primary/50 rounded-full mb-1.5 opacity-50 group-hover:opacity-100 transition-opacity" />
      )}
    </motion.div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={(e) => { 
          handleDismiss(); 
      }} className="focus:outline-none" draggable="false"> 
        {content}
      </Link>
    );
  }

  return content;
}
