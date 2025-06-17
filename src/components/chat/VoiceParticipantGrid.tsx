
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, UserCog, VolumeX, Crown, UserX } from "lucide-react";
import type { ActiveVoiceParticipantData } from '@/app/(main)/chat/[roomId]/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface VoiceParticipantSlotProps {
  participant: ActiveVoiceParticipantData;
  isCurrentUser: boolean;
  isRoomCreatorViewing: boolean; // The person viewing the grid is the room creator
  isParticipantTheRoomCreator: boolean; // This specific participant is the room creator for the room they are in.
  onAdminKick: () => void;
  onAdminToggleMute: () => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onClick: () => void;
  isHostSlot?: boolean; // To make the avatar potentially larger
}

const VoiceParticipantSlot: React.FC<VoiceParticipantSlotProps> = ({
  participant,
  isCurrentUser,
  isRoomCreatorViewing,
  isParticipantTheRoomCreator,
  onAdminKick,
  onAdminToggleMute,
  getAvatarFallbackText,
  onClick,
  isHostSlot = false,
}) => {
  const MuteIcon = participant?.isMutedByAdmin ? VolumeX : (participant?.isMuted ? MicOff : Mic);
  const muteIconColor = participant?.isMutedByAdmin || participant?.isMuted ? "text-red-500" : "text-green-500";
  const avatarSizeClass = isHostSlot ? "h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24" : "h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16";
  const nameTextSize = isHostSlot ? "text-sm" : "text-xs";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-1 rounded-full cursor-pointer group transition-all duration-200 ease-in-out transform hover:scale-105",
        participant.isSpeaking && !isHostSlot ? 'scale-105' : '',
        participant.isSpeaking && isHostSlot ? 'scale-102' : '',
      )}
      onClick={onClick}
    >
      <Avatar className={cn(
        avatarSizeClass,
        "mb-1 border-2",
        participant.isSpeaking ? 'border-green-500 shadow-lg' : 'border-transparent'
      )}>
        <AvatarImage src={participant.photoURL || `https://placehold.co/96x96.png`} data-ai-hint="voice chat user large" />
        <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
      </Avatar>
      <p className={cn(
        nameTextSize,
        "font-medium truncate w-full text-center text-foreground/80 group-hover:text-foreground max-w-[70px] sm:max-w-[80px]",
        isHostSlot && "sm:max-w-[100px]"
      )}>
        {participant.displayName || "Kullanıcı"}
      </p>

      <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-card/50 p-0.5 rounded-full backdrop-blur-sm">
        <MuteIcon className={`h-3 w-3 ${muteIconColor}`} />
        {isParticipantTheRoomCreator && <Crown className="h-3 w-3 text-yellow-500" />}
      </div>

      {isRoomCreatorViewing && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={cn("absolute bottom-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity", isHostSlot && "h-7 w-7")}>
              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
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

const VoiceParticipantGrid: React.FC<{
  participants: ActiveVoiceParticipantData[];
  currentUserUid?: string;
  isCurrentUserRoomCreator: boolean; // Person VIEWING is the room creator
  roomCreatorId?: string; // Actual creatorId of the room for crown icon
  maxSlots: number; // Max capacity of the room
  onAdminKickUser: (targetUserId: string) => void;
  onAdminToggleMuteUser: (targetUserId: string, currentMuteState?: boolean) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onSlotClick: (participantId: string | null) => void;
}> = ({
  participants,
  currentUserUid,
  isCurrentUserRoomCreator,
  roomCreatorId,
  maxSlots, // Note: We will use this conceptually for layout but only render active participants
  onAdminKickUser,
  onAdminToggleMuteUser,
  getAvatarFallbackText,
  onSlotClick
}) => {

  if (!participants || participants.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground bg-transparent rounded-lg">
        Sesli sohbette kimse yok.
      </div>
    );
  }

  // Litmatch-style participant distribution
  const hostParticipant = participants.length > 0 ? participants[0] : null;
  const secondRowParticipants = participants.slice(1, 3); // Max 2
  const thirdRowParticipants = participants.slice(3, 7);  // Max 4 (total 1+2+4 = 7 for maxSlots=7)

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 py-2 w-full">
      {/* Host Slot */}
      {hostParticipant && (
        <div className="mb-1 sm:mb-2 transform scale-100">
          <VoiceParticipantSlot
            participant={hostParticipant}
            isCurrentUser={hostParticipant.id === currentUserUid}
            isRoomCreatorViewing={isCurrentUserRoomCreator}
            isParticipantTheRoomCreator={hostParticipant.id === roomCreatorId}
            onAdminKick={() => onAdminKickUser(hostParticipant.id)}
            onAdminToggleMute={() => onAdminToggleMuteUser(hostParticipant.id, hostParticipant.isMutedByAdmin)}
            getAvatarFallbackText={getAvatarFallbackText}
            onClick={() => onSlotClick(hostParticipant.id)}
            isHostSlot={true}
          />
        </div>
      )}

      {/* Second Row (2 slots) */}
      {secondRowParticipants.length > 0 && (
        <div className="flex justify-center items-start gap-3 sm:gap-4 w-full px-2">
          {secondRowParticipants.map(p => (
            <VoiceParticipantSlot
              key={`second-${p.id}`}
              participant={p}
              isCurrentUser={p.id === currentUserUid}
              isRoomCreatorViewing={isCurrentUserRoomCreator}
              isParticipantTheRoomCreator={p.id === roomCreatorId}
              onAdminKick={() => onAdminKickUser(p.id)}
              onAdminToggleMute={() => onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
              getAvatarFallbackText={getAvatarFallbackText}
              onClick={() => onSlotClick(p.id)}
            />
          ))}
        </div>
      )}

      {/* Third Row (up to 4 slots) */}
      {thirdRowParticipants.length > 0 && (
        <div className="flex justify-center items-start gap-2 sm:gap-3 flex-wrap w-full px-1">
          {thirdRowParticipants.map(p => (
            <VoiceParticipantSlot
              key={`third-${p.id}`}
              participant={p}
              isCurrentUser={p.id === currentUserUid}
              isRoomCreatorViewing={isCurrentUserRoomCreator}
              isParticipantTheRoomCreator={p.id === roomCreatorId}
              onAdminKick={() => onAdminKickUser(p.id)}
              onAdminToggleMute={() => onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
              getAvatarFallbackText={getAvatarFallbackText}
              onClick={() => onSlotClick(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceParticipantGrid;
