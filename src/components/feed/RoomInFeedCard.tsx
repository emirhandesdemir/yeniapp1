
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, LogIn, AlertCircle, Compass, Star, Gamepad2, RadioTower } from "lucide-react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ChatRoomFeedDisplayData {
  id: string;
  name: string;
  description?: string;
  participantCount?: number;
  maxParticipants: number;
  createdAt: Timestamp;
  isPremiumRoom?: boolean;
  creatorIsPremium?: boolean;
  isGameEnabledInRoom?: boolean;
  isActive?: boolean;
  activeSince?: Timestamp;
}

interface RoomInFeedCardProps {
  room: ChatRoomFeedDisplayData;
  now?: Date; // Optional 'now' for consistent time-based calculations
}

const RoomInFeedCard: React.FC<RoomInFeedCardProps> = React.memo(({ room, now = new Date() }) => {
  const isFull = room.participantCount != null && room.participantCount >= room.maxParticipants;
  
  const formattedDate = room.createdAt
    ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";
  
  const getPreciseCardExpiryInfo = (expiresAt: Timestamp | null | undefined): string => {
    if (!expiresAt) return "Süre bilgisi yok";
    const expiryDate = expiresAt.toDate();
    if (isPast(expiryDate, now)) {
      return "Süresi Doldu";
    }

    const diffSecondsTotal = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

    if (diffSecondsTotal < 0) return "Süresi Doldu";

    const days = Math.floor(diffSecondsTotal / 86400);
    const hours = Math.floor((diffSecondsTotal % 86400) / 3600);
    const minutes = Math.floor((diffSecondsTotal % 3600) / 60);

    if (days > 0) {
      return `Kalan: ${days} gün ${hours} sa`;
    }
    if (hours > 0) {
      return `Kalan: ${hours} sa ${minutes} dk`;
    }
    if (minutes > 0) {
      return `Kalan: ${minutes} dk`;
    }
    return `Kalan: <1 dk`;
  };

  const gameStatusText = room.isGameEnabledInRoom ? "Oyun Aktif" : "Oyun Kapalı";
  const gameStatusColor = room.isGameEnabledInRoom ? "text-green-600 bg-green-500/10 border-green-500/30" : "text-red-600 bg-red-500/10 border-red-500/20";


  return (
    <Card className={cn(
        "flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl border hover:border-primary/50 dark:hover:border-primary/60 group",
        room.isPremiumRoom ? 'border-yellow-500 dark:border-yellow-400 ring-1 ring-yellow-500/50 dark:ring-yellow-400/50 bg-gradient-to-br from-yellow-500/5 via-card to-yellow-500/10 dark:from-yellow-400/10 dark:via-card dark:to-yellow-400/15' : 'border-border/30 dark:border-border/20',
        room.isActive && 'border-green-500 dark:border-green-400 ring-2 ring-green-500/70 dark:ring-green-400/70 bg-gradient-to-br from-green-500/5 via-card to-green-500/10 dark:from-green-400/10 dark:via-card dark:to-green-400/15'
    )}>
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-start justify-between">
            <CardTitle
            className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate pr-10"
            title={room.name}
            >
            {room.isPremiumRoom && <Star className="inline h-4 w-4 mb-0.5 mr-1.5 text-yellow-500 dark:text-yellow-400" />}
            {room.name}
            </CardTitle>
            {room.isActive && (
                <Badge variant="destructive" className="bg-green-500 text-white animate-pulse">
                    <RadioTower className="h-3.5 w-3.5 mr-1"/> Canlı
                </Badge>
            )}
        </div>
        <CardDescription className="h-10 text-xs sm:text-sm overflow-hidden text-ellipsis text-muted-foreground/80 group-hover:text-muted-foreground transition-colors mt-1.5" title={room.description}>
          {room.description || "Açıklama yok."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2 pb-3 sm:pb-4 p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <Badge variant="secondary" className="flex items-center justify-center gap-1.5 shadow-sm px-2.5 py-1">
            <Users className="h-3.5 w-3.5 text-primary/80" />
            <span className="font-medium">{room.participantCount ?? 0} / {room.maxParticipants}</span>
          </Badge>
          <Badge 
              variant={room.expiresAt && isPast(room.expiresAt.toDate()) ? 'destructive' : 'outline'} 
              className="flex items-center gap-1.5 shadow-sm px-2.5 py-1"
          >
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">{getPreciseCardExpiryInfo(room.expiresAt)}</span>
          </Badge>
        </div>
        <div className="flex items-center justify-start text-xs text-muted-foreground mb-1">
          <Badge className={cn("flex items-center gap-1.5 shadow-sm px-2 py-0.5 border", gameStatusColor)}>
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="font-medium">{gameStatusText}</span>
          </Badge>
        </div>
        
      </CardContent>
      <CardFooter className="p-3 sm:p-4 border-t bg-muted/20 dark:bg-card/30 mt-auto">
        <Button
          asChild
          className={cn(
            "w-full text-sm py-2.5 rounded-lg transition-transform group-hover:scale-105",
            isFull ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' :
            room.isPremiumRoom ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' :
            'bg-primary hover:bg-primary/80 text-primary-foreground'
          )}
          disabled={isFull}
          aria-disabled={isFull}
        >
          <Link href={!isFull ? `/chat/${room.id}` : '#'}>
            <LogIn className="mr-2 h-4 w-4" />
            {isFull ? "Oda Dolu" : "Sohbete Katıl"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});
RoomInFeedCard.displayName = 'RoomInFeedCard';
export default RoomInFeedCard;
