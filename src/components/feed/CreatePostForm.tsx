
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, checkUserPremium } from "@/contexts/AuthContext"; // checkUserPremium eklendi
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageSquarePlus, XCircle, LinkIcon, List, Star } from "lucide-react"; // Star eklendi
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_POST_LENGTH = 280;

interface ShareableRoom {
  id: string;
  name: string;
}

interface CreatePostFormProps {
  onPostCreated?: () => void; // Optional callback
}

export default function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();

  const [userActiveRooms, setUserActiveRooms] = useState<ShareableRoom[]>([]);
  const [loadingUserRooms, setLoadingUserRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ShareableRoom | null>(null);
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);

  const fetchUserActiveRooms = useCallback(async () => {
    if (!currentUser || !isRoomSelectorOpen) return;
    setLoadingUserRooms(true);
    try {
      const q = query(
        collection(db, "chatRooms"),
        where("creatorId", "==", currentUser.uid),
        where("expiresAt", ">", Timestamp.now())
      );
      const querySnapshot = await getDocs(q);
      const rooms: ShareableRoom[] = [];
      querySnapshot.forEach((doc) => {
        rooms.push({ id: doc.id, name: doc.data().name });
      });
      setUserActiveRooms(rooms);
    } catch (error) {
      console.error("Error fetching user's active rooms:", error);
      toast({ title: "Hata", description: "Aktif odalarınız yüklenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setLoadingUserRooms(false);
    }
  }, [currentUser, isRoomSelectorOpen, toast]);

  useEffect(() => {
    if (isRoomSelectorOpen) {
      fetchUserActiveRooms();
    }
  }, [isRoomSelectorOpen, fetchUserActiveRooms]);


  const handleSelectRoom = (room: ShareableRoom) => {
    setSelectedRoom(room);
    setIsRoomSelectorOpen(false);
  };

  const handleClearSelectedRoom = () => {
    setSelectedRoom(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userData || !content.trim()) {
      toast({
        title: "Hata",
        description: "Gönderi içeriği boş olamaz veya kullanıcı bilgileri eksik.",
        variant: "destructive",
      });
      return;
    }

    if (content.length > MAX_POST_LENGTH) {
      toast({
        title: "Hata",
        description: `Gönderi en fazla ${MAX_POST_LENGTH} karakter olabilir.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const userIsCurrentlyPremium = checkUserPremium(userData);

    try {
      const postData: any = {
        userId: currentUser.uid,
        username: userData.displayName,
        userAvatar: userData.photoURL,
        authorIsPremium: userIsCurrentlyPremium, // Eklendi
        content: content.trim(),
        createdAt: serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
        likedBy: [],
      };

      if (selectedRoom) {
        postData.sharedRoomId = selectedRoom.id;
        postData.sharedRoomName = selectedRoom.name;
      }

      await addDoc(collection(db, "posts"), postData);
      setContent("");
      setSelectedRoom(null);
      toast({ title: "Başarılı", description: "Gönderiniz paylaşıldı!" });
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        title: "Hata",
        description: "Gönderi oluşturulurken bir sorun oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "HW"; 
  };

  const remainingChars = MAX_POST_LENGTH - content.length;
  const userIsCurrentlyPremium = checkUserPremium(userData);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start space-x-3">
        <div className="relative">
            <Avatar className="h-10 w-10 mt-1 flex-shrink-0">
            <AvatarImage src={userData?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar" />
            <AvatarFallback>{getAvatarFallbackText(userData?.displayName)}</AvatarFallback>
            </Avatar>
            {userIsCurrentlyPremium && (
                <Star className="absolute -bottom-1 -right-1 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow" />
            )}
        </div>
        <Textarea
          placeholder="Ne düşünüyorsun, HiweWalk'er?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4} 
          maxLength={MAX_POST_LENGTH}
          className="flex-1 resize-none bg-background focus:border-primary text-sm"
          disabled={isSubmitting || !currentUser}
        />
      </div>

      {selectedRoom && (
        <div className="p-2 bg-primary/5 dark:bg-primary/10 rounded-md flex items-center justify-between text-sm border border-primary/20">
          <div className="flex items-center gap-2 text-primary/90 dark:text-primary/80">
            <LinkIcon className="h-4 w-4" />
            <span className="font-medium truncate" title={selectedRoom.name}>Paylaşılacak Oda: {selectedRoom.name}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleClearSelectedRoom} className="h-6 w-6 text-muted-foreground hover:text-destructive">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center pt-1">
        <div className="flex items-center gap-2">
            <Dialog open={isRoomSelectorOpen} onOpenChange={setIsRoomSelectorOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={isSubmitting || !currentUser} className="text-muted-foreground hover:text-primary">
                    <MessageSquarePlus className="mr-1.5 h-4 w-4" />
                    Oda Paylaş
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                <DialogTitle>Aktif Odanı Paylaş</DialogTitle>
                <DialogDescription>
                    Gönderine eklemek için oluşturduğun aktif bir sohbet odası seç.
                </DialogDescription>
                </DialogHeader>
                {loadingUserRooms ? (
                <div className="flex justify-center items-center h-20">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
                ) : userActiveRooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Paylaşılacak aktif odanız bulunmuyor.</p>
                ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto py-2 pr-2 -mr-2">
                    {userActiveRooms.map(room => (
                    <Button
                        key={room.id}
                        variant="ghost"
                        className="w-full justify-start text-left h-auto py-1.5 px-2"
                        onClick={() => handleSelectRoom(room)}
                    >
                        <List className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0"/> 
                        <span className="truncate">{room.name}</span>
                    </Button>
                    ))}
                </div>
                )}
                <DialogFooter className="mt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Kapat</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
            </Dialog>

            <p className={cn(
              "text-xs",
              remainingChars < 0 ? "text-destructive font-medium" : 
              remainingChars < 20 ? "text-orange-500" : 
              "text-muted-foreground"
            )}>
            {remainingChars}
            </p>
        </div>
        <Button 
          type="submit" 
          disabled={isSubmitting || !content.trim() || !currentUser || remainingChars < 0}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          size="sm"
        >
          {isSubmitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          Paylaş
        </Button>
      </div>
    </form>
  );
}

    