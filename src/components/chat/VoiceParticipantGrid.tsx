
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, UserCog, VolumeX, Crown, UserX } from "lucide-react"; // Plus kaldırıldı
import type { ActiveVoiceParticipantData } from '@/app/(main)/chat/[roomId]/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface VoiceParticipantGridProps {
  participants: ActiveVoiceParticipantData[];
  currentUserUid?: string;
  isCurrentUserRoomCreator: boolean;
  maxSlots: number; // Bu hala genel oda kapasitesi için kullanılabilir, ancak UI artık boş slot göstermeyecek
  onAdminKickUser: (targetUserId: string) => void;
  onAdminToggleMuteUser: (targetUserId: string, currentMuteState?: boolean) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onSlotClick: (participantId: string | null) => void;
}

const VoiceParticipantSlot: React.FC<{
  participant: ActiveVoiceParticipantData; // Artık null olamaz, sadece aktif katılımcılar için render edilecek
  isCurrentUser: boolean;
  isRoomCreator: boolean; // The viewer is the room creator
  isParticipantCreator: boolean; // This specific participant is the room creator
  onAdminKick: () => void;
  onAdminToggleMute: () => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onClick: () => void;
}> = ({
    participant,
    isCurrentUser,
    isRoomCreator,
    isParticipantCreator,
    onAdminKick,
    onAdminToggleMute,
    getAvatarFallbackText,
    onClick
}) => {

  const MuteIcon = participant?.isMutedByAdmin ? VolumeX : (participant?.isMuted ? MicOff : Mic);
  const muteIconColor = participant?.isMutedByAdmin || participant?.isMuted ? "text-red-500" : "text-green-500";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-1.5 rounded-lg cursor-pointer group transition-all duration-200 ease-in-out transform hover:bg-secondary/30",
        participant.isSpeaking ? 'scale-105' : '',
        isCurrentUser ? 'bg-primary/5' : ''
      )}
      onClick={onClick}
    >
      <Avatar className={cn(
        "h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 mb-1 border-2",
        participant.isSpeaking ? 'border-green-500' : 'border-transparent'
      )}>
        <AvatarImage src={participant.photoURL || `https://placehold.co/64x64.png`} data-ai-hint="voice chat user" />
        <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium truncate w-full text-center text-foreground/80 group-hover:text-foreground max-w-[60px] sm:max-w-[70px]">
        {participant.displayName || "Kullanıcı"}
      </p>

      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        <MuteIcon className={`h-3 w-3 ${muteIconColor}`} />
        {isParticipantCreator && <Crown className="h-3 w-3 text-yellow-500" />}
      </div>

      {isRoomCreator && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute bottom-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <UserCog className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAdminToggleMute(); }} disabled={participant.isMuted === undefined && participant.isMutedByAdmin === undefined}>
              {participant.isMutedByAdmin ? <Mic className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
              {participant.isMutedByAdmin ? "Sesi Açmasına İzin Ver" : "Kullanıcıyı Sessize Al"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAdminKick(); }} className="text-destructive focus:text-destructive">
              <UserX className="mr-2 h-4 w-4" />
              Sohbetten At
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};


const VoiceParticipantGrid: React.FC<VoiceParticipantGridProps> = ({
  participants,
  currentUserUid,
  isCurrentUserRoomCreator,
  onAdminKickUser,
  onAdminToggleMuteUser,
  getAvatarFallbackText,
  onSlotClick
}) => {

  // Oda kurucusunu bul (isCurrentUserRoomCreator, odayı görüntüleyenin kurucu olup olmadığını söyler)
  // Gerçek oda kurucusunun ID'si, participants listesindeki bir kullanıcıya ait olmalı
  // veya roomDetails'den creatorId alınabilir. Burada participants listesini kullanıyoruz.
  // Ancak, participants listesi sadece sesli sohbette olanları içerir.
  // Odanın asıl kurucusunu belirlemek için roomDetails.creatorId daha doğru olur.
  // Bu bileşene roomCreatorId prop'u ekleyebiliriz veya isParticipantCreator mantığını
  // dışarıdan gelen roomDetails.creatorId ile karşılaştırarak yapabiliriz.
  // Şimdilik, isCurrentUserRoomCreator'a göre admin yetkisi veriyoruz.

  if (!participants || participants.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground bg-muted/20 rounded-lg">
        Sesli sohbette kimse yok.
      </div>
    );
  }

  return (
    <div className="flex flex-row flex-wrap items-start justify-center gap-2 sm:gap-x-3 sm:gap-y-2 py-1">
      {participants.map((p) => (
        <VoiceParticipantSlot
          key={p.id}
          participant={p}
          isCurrentUser={p.id === currentUserUid}
          isRoomCreator={isCurrentUserRoomCreator} // Viewer is the room creator
          isParticipantCreator={p.id === participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id } // TODO: Bu mantık hatalı olabilir, oda kurucusunun ID'si prop olarak gelmeli
          onAdminKick={() => onAdminKickUser(p.id)}
          onAdminToggleMute={() => onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
          getAvatarFallbackText={getAvatarFallbackText}
          onClick={() => onSlotClick(p.id)}
        />
      ))}
    </div>
  );
};

export default VoiceParticipantGrid;
