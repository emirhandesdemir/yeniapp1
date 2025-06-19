
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, LogIn, AlertCircle, Compass, Star, Gamepad2 } from "lucide-react"; // Gamepad2 eklendi
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge"; // Badge eklendi

export interface ChatRoomFeedDisplayData {
  id: string;
  name: string;
  description?: string;
  participantCount?: number;
  maxParticipants: number;
  createdAt: Timestamp;
  isPremiumRoom?: boolean;
  creatorIsPremium?: boolean;
  isGameEnabledInRoom?: boolean; // Eklendi
}

interface RoomInFeedCardProps {
  room: ChatRoomFeedDisplayData;
}

const RoomInFeedCard: React.FC<RoomInFeedCardProps> = React.memo(({ room }) => {
  const isFull = room.participantCount != null && room.participantCount >= room.maxParticipants;
  const formattedDate = room.createdAt
    ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  const gameStatusText = room.isGameEnabledInRoom ? "Oyun Aktif" : "Oyun Kapalı";
  const gameStatusColor = room.isGameEnabledInRoom ? "text-green-600 bg-green-500/10 border-green-500/30" : "text-red-600 bg-red-500/10 border-red-500/20";


  return (
    <Card className={cn(
        "shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl border group",
        room.isPremiumRoom
            ? "border-yellow-500/70 dark:border-yellow-400/70 ring-1 ring-yellow-500/30 dark:ring-yellow-400/30 bg-gradient-to-br from-yellow-500/10 via-card to-yellow-500/5 dark:from-yellow-400/15 dark:via-card dark:to-yellow-400/10"
            : "border-border/30 dark:border-border/40 bg-card hover:border-primary/40 dark:hover:border-primary/50"
    )}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={cn(
                    "p-1.5 rounded-full",
                    room.isPremiumRoom ? "bg-yellow-500/20 dark:bg-yellow-400/20" : "bg-primary/10 dark:bg-primary/15"
                )}>
                    <Compass className={cn("h-5 w-5", room.isPremiumRoom ? "text-yellow-600 dark:text-yellow-400" : "text-primary")} />
                </div>
                <CardTitle className={cn(
                    "text-base sm:text-lg font-semibold group-hover:text-primary transition-colors",
                    room.isPremiumRoom && "group-hover:text-yellow-600 dark:group-hover:text-yellow-400"
                )}>
                    {room.isPremiumRoom && <Star className="inline h-4 w-4 mb-0.5 mr-1 text-yellow-500 dark:text-yellow-400" />}
                    {room.name}
                </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2 h-8" title={room.description}>
          {room.description || "Bu sohbet odası için bir açıklama girilmemiş."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-1 pb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{room.participantCount ?? 0} / {room.maxParticipants} Katılımcı</span>
          </div>
           <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5 border", gameStatusColor)}>
              <Gamepad2 className="mr-1 h-3 w-3" />
              {gameStatusText}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-border/20 dark:border-border/25">
        <Button
          asChild
          className={cn(
            "w-full transition-transform group-hover:scale-[1.02]",
            isFull ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' :
            room.isPremiumRoom ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' :
            'bg-primary hover:bg-primary/90 text-primary-foreground'
          )}
          disabled={isFull}
          aria-disabled={isFull}
        >
          <Link href={!isFull ? `/chat/${room.id}` : '#'}>
            {isFull ? <AlertCircle className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
            {isFull ? "Oda Dolu" : "Odaya Katıl"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});
RoomInFeedCard.displayName = 'RoomInFeedCard';
export default RoomInFeedCard;
