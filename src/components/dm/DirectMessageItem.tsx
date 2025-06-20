
"use client";
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Timestamp } from 'firebase/firestore';
import Link from "next/link";
import { Star, Trash2, Loader2 } from 'lucide-react';
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
import { doc, deleteDoc as deleteFirestoreDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

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
  chatId: string; // DM silme işlemi için chatId gerekli
  onMessageDeleted: (messageId: string) => void; // Mesaj silindiğinde çağrılacak fonksiyon
}

const DirectMessageItem: React.FC<DirectMessageItemProps> = React.memo(({
  msg,
  getAvatarFallbackText,
  chatId,
  onMessageDeleted,
}) => {
  const { userData: currentUserData } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDeleteMessage = async () => {
    if (!msg.isOwn || !chatId || !msg.id) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const messageRef = doc(db, `directMessages/${chatId}/messages`, msg.id);
      await deleteFirestoreDoc(messageRef);
      toast({ title: "Başarılı", description: "Mesajınız silindi." });
      onMessageDeleted(msg.id); // Parent component'i bilgilendir
    } catch (error) {
      console.error("Error deleting direct message:", error);
      toast({ title: "Hata", description: "Mesaj silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <div key={msg.id} className={cn("flex items-end gap-2 my-1.5 group", msg.isOwn ? "justify-end" : "justify-start")}>
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
              "relative p-2.5 sm:p-3 shadow-md break-words",
              msg.isOwn
              ? "bg-primary text-primary-foreground rounded-t-xl rounded-l-xl sm:rounded-t-2xl sm:rounded-l-2xl"
              : "bg-secondary text-secondary-foreground rounded-t-xl rounded-r-xl sm:rounded-t-2xl sm:rounded-r-2xl"
          )}>
            <div className="allow-text-selection">
                <p className="text-sm">{msg.text}</p>
            </div>
            {msg.isOwn && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="absolute top-0 right-0 h-6 w-6 text-primary-foreground/60 hover:text-destructive-foreground hover:bg-destructive/70 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Mesajı Sil"
                    disabled={isDeleting}
                >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
            )}
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
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Mesajı Sil</AlertDialogTitle>
                <AlertDialogDescription>
                    Bu mesajı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>İptal</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteMessage}
                    className="bg-destructive hover:bg-destructive/90"
                    disabled={isDeleting}
                >
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
