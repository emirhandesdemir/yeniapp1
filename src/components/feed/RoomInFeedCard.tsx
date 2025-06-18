
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, LogIn, AlertCircle, Compass } from "lucide-react";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export interface ChatRoomFeedDisplayData {
  id: string;
  name: string;
  description?: string;
  participantCount?: number;
  maxParticipants: number;
  createdAt: Timestamp;
}

interface RoomInFeedCardProps {
  room: ChatRoomFeedDisplayData;
}

const RoomInFeedCard: React.FC<RoomInFeedCardProps> = React.memo(({ room }) => {
  const isFull = room.participantCount != null && room.participantCount >= room.maxParticipants;
  const formattedDate = room.createdAt
    ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl border border-accent/20 dark:border-accent/30 bg-gradient-to-br from-card via-accent/5 to-accent/10 dark:via-accent/10 dark:to-accent/15 group">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent/20 rounded-full">
                    <Compass className="h-5 w-5 text-accent dark:text-accent" />
                </div>
                <CardTitle className="text-base sm:text-lg font-semibold text-accent dark:text-accent group-hover:text-accent/80 dark:group-hover:text-accent/80 transition-colors">
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
          <p className="text-xs font-medium text-accent/90">
            Yeni bir maceraya atıl!
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-accent/10 dark:border-accent/15">
        <Button
          asChild
          className={`w-full ${isFull ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' : 'bg-accent hover:bg-accent/80 text-accent-foreground'}`}
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
