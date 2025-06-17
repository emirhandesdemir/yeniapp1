
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, LogIn, AlertCircle } from "lucide-react";
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
  // image?: string; // Gerekirse eklenebilir
  // imageAiHint?: string; // Gerekirse eklenebilir
}

interface RoomInFeedCardProps {
  room: ChatRoomFeedDisplayData;
}

export default function RoomInFeedCard({ room }: RoomInFeedCardProps) {
  const isFull = room.participantCount != null && room.participantCount >= room.maxParticipants;
  const formattedDate = room.createdAt
    ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true, locale: tr })
    : "Yakın zamanda";

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 rounded-xl border border-blue-500/20 dark:border-blue-400/30 bg-gradient-to-br from-card via-blue-500/5 to-blue-500/10 dark:via-blue-400/10 dark:to-blue-400/15 group">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-full">
                    <MessageSquare className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <CardTitle className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
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
          <p className="text-sm font-medium text-primary">
            Katılmak ister misin?
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-blue-500/10 dark:border-blue-400/15">
        <Button
          asChild
          className={`w-full ${isFull ? 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white'}`}
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
}

    