
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, LogIn, AlertCircle, Compass, Star, Gamepad2, RadioTower, Clock } from "lucide-react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';

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
  image?: string;
  imageAiHint?: string;
}

interface RoomInFeedCardProps {
  room: ChatRoomFeedDisplayData;
  now?: Date;
}

const RoomInFeedCard: React.FC<RoomInFeedCardProps> = React.memo(({ room, now = new Date() }) => {
  const isFull = room.participantCount != null && room.participantCount >= room.maxParticipants;
  
  const getPreciseCardExpiryInfo = (expiresAt: Timestamp | null | undefined): string => {
    // This function is not used in the current card but kept for potential future use.
    // The simplified formattedDate is used instead.
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

    if (days > 0) return `Kalan: ${days} gün ${hours} sa`;
    if (hours > 0) return `Kalan: ${hours} sa ${minutes} dk`;
    if (minutes > 0) return `Kalan: ${minutes} dk`;
    return `Kalan: <1 dk`;
  };

  const formattedDate = room.createdAt
    ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  return (
    <Card className={cn(
        "relative flex flex-col h-full overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl border group",
        room.isPremiumRoom ? 'border-yellow-500/50 dark:border-yellow-400/50' : 'border-border/30 dark:border-border/20',
        room.isActive && 'ring-2 ring-green-500/70 dark:ring-green-400/70'
    )}>
        {room.image && (
            <Image
                src={room.image}
                alt={room.name}
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                data-ai-hint={room.imageAiHint || "room background"}
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/30 z-[1]" />
        
        <div className="relative z-10 flex flex-col flex-grow text-white p-4 sm:p-5 h-full">
            <CardHeader className="p-0 flex-grow">
                 <div className="flex items-start justify-between">
                    <CardTitle
                        className="text-base sm:text-lg font-bold text-white group-hover:text-primary-foreground/90 transition-colors truncate pr-10"
                        title={room.name}
                    >
                        {room.isPremiumRoom && <Star className="inline h-4 w-4 mb-0.5 mr-1.5 text-yellow-300" />}
                        {room.name}
                    </CardTitle>
                    {room.isActive && (
                        <Badge variant="destructive" className="bg-green-500/90 text-white shadow-md border-green-300/50 animate-pulse">
                            <RadioTower className="h-3.5 w-3.5 mr-1"/> Canlı
                        </Badge>
                    )}
                 </div>
                <CardDescription className="h-10 text-xs sm:text-sm overflow-hidden text-ellipsis text-white/80 group-hover:text-white/90 transition-colors mt-1.5" title={room.description}>
                    {room.description || "Açıklama yok."}
                </CardDescription>
            </CardHeader>
            
            <div className="flex items-end justify-between mt-4">
                 <div className="flex items-center gap-2">
                     <Badge variant="secondary" className="bg-black/30 text-white/90 border-white/20 shadow-sm px-2.5 py-1 text-xs">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        {room.participantCount ?? 0} / {room.maxParticipants}
                    </Badge>
                    {room.isGameEnabledInRoom && (
                         <Badge variant="secondary" className="bg-black/30 text-white/90 border-white/20 shadow-sm px-2.5 py-1 text-xs">
                            <Gamepad2 className="h-3.5 w-3.5 mr-1.5"/> Oyun Aktif
                         </Badge>
                    )}
                 </div>
                 <Button
                    asChild
                    className={cn(
                        "h-8 px-3 text-xs sm:text-sm sm:h-9 sm:px-4 rounded-lg transition-transform group-hover:scale-105 shadow-md",
                        isFull ? 'bg-gray-500 text-gray-200 cursor-not-allowed' :
                        room.isPremiumRoom ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' :
                        'bg-primary hover:bg-primary/80 text-primary-foreground'
                    )}
                    disabled={isFull}
                    aria-disabled={isFull}
                    >
                    <Link href={!isFull ? `/chat/${room.id}` : '#'}>
                        <LogIn className="mr-2 h-4 w-4" />
                        {isFull ? "Dolu" : "Katıl"}
                    </Link>
                </Button>
            </div>
        </div>
    </Card>
  );
});
RoomInFeedCard.displayName = 'RoomInFeedCard';
export default RoomInFeedCard;
