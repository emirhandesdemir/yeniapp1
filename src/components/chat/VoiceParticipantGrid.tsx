
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, UserCog, VolumeX, Crown, UserX, Star } from "lucide-react";
import type { ActiveVoiceParticipantData } from '@/app/(main)/chat/[roomId]/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface VoiceParticipantSlotProps {
  participant: ActiveVoiceParticipantData;
  isCurrentUser: boolean;
  isRoomCreatorViewing: boolean;
  isParticipantTheRoomCreator: boolean;
  onAdminToggleMute: () => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onClick: () => void;
  isHostSlot?: boolean;
}

const VoiceParticipantSlot: React.FC<VoiceParticipantSlotProps> = React.memo(({
  participant,
  isCurrentUser,
  isRoomCreatorViewing,
  isParticipantTheRoomCreator,
  onAdminToggleMute,
  getAvatarFallbackText,
  onClick,
  isHostSlot = false,
}) => {
  const MuteIcon = participant?.isMutedByAdmin ? VolumeX : (participant?.isMuted ? MicOff : Mic);
  const muteIconColor = participant?.isMutedByAdmin || participant?.isMuted ? "text-red-500" : "text-green-500";
  const avatarSizeClass = isHostSlot ? "h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24" : "h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16";
  const nameTextSize = isHostSlot ? "text-sm" : "text-xs";
  const frameStyle = `avatar-frame-${participant.avatarFrameStyle || 'default'}`;


  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center p-1 rounded-full cursor-pointer group transition-all duration-200 ease-in-out transform hover:scale-105",
      )}
      onClick={onClick}
      animate={{ scale: participant.isSpeaking ? (isHostSlot ? 1.02 : 1.05) : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
        <div className={cn('relative', frameStyle)}>
            <Avatar className={cn(
                avatarSizeClass,
                "mb-1 border-2 transition-all duration-150",
                participant.isSpeaking ? 'border-green-500 shadow-lg ring-2 ring-green-500/50 ring-offset-2 ring-offset-card' : 'border-transparent'
            )}>
                <AvatarImage src={participant.photoURL || `https://placehold.co/96x96.png`} data-ai-hint="voice chat user large" />
                <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
            </Avatar>
            {participant.isPremium && (
                <Star className={cn(
                    "absolute -bottom-0 -right-0 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow",
                    isHostSlot ? "h-5 w-5" : "h-4 w-4"
                )} />
            )}
        </div>
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
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAdminToggleMute(); }}>
              {participant.isMutedByAdmin ? <Mic className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
              {participant.isMutedByAdmin ? "Sesini Açmasına İzin Ver" : "Kullanıcıyı Sessize Al"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.div>
  );
});
VoiceParticipantSlot.displayName = 'VoiceParticipantSlot';


const VoiceParticipantGrid: React.FC<{
  participants: ActiveVoiceParticipantData[];
  currentUserUid?: string;
  isCurrentUserRoomCreator: boolean;
  roomCreatorId?: string;
  maxSlots: number;
  onAdminKickUser: (targetUserId: string) => void; // This prop is no longer used but kept for type consistency if other parts of app expect it.
  onAdminToggleMuteUser: (targetUserId: string, currentAdminMuteState?: boolean) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onSlotClick: (participantId: string | null) => void;
}> = React.memo(({
  participants,
  currentUserUid,
  isCurrentUserRoomCreator,
  roomCreatorId,
  maxSlots,
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

  let hostParticipant: ActiveVoiceParticipantData | null = null;
  let remainingParticipants = [...participants];

  if (roomCreatorId) {
    const creatorIndex = remainingParticipants.findIndex(p => p.id === roomCreatorId);
    if (creatorIndex !== -1) {
      hostParticipant = remainingParticipants[creatorIndex];
      remainingParticipants.splice(creatorIndex, 1);
    }
  }

  if (!hostParticipant && remainingParticipants.length > 0) {
    hostParticipant = remainingParticipants.shift() || null;
  }


  const secondRowParticipants = remainingParticipants.slice(0, 2);
  const thirdRowParticipants = remainingParticipants.slice(2, 6);

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 py-2 w-full">
      {hostParticipant && (
        <div className="mb-1 sm:mb-2 transform scale-100">
          <VoiceParticipantSlot
            participant={hostParticipant}
            isCurrentUser={hostParticipant.id === currentUserUid}
            isRoomCreatorViewing={isCurrentUserRoomCreator}
            isParticipantTheRoomCreator={hostParticipant.id === roomCreatorId}
            onAdminToggleMute={() => onAdminToggleMuteUser(hostParticipant!.id, hostParticipant!.isMutedByAdmin)}
            getAvatarFallbackText={getAvatarFallbackText}
            onClick={() => onSlotClick(hostParticipant!.id)}
            isHostSlot={true}
          />
        </div>
      )}

      {secondRowParticipants.length > 0 && (
        <div className="flex justify-center items-start gap-3 sm:gap-4 w-full px-2">
          {secondRowParticipants.map(p => (
            <VoiceParticipantSlot
              key={`second-${p.id}`}
              participant={p}
              isCurrentUser={p.id === currentUserUid}
              isRoomCreatorViewing={isCurrentUserRoomCreator}
              isParticipantTheRoomCreator={p.id === roomCreatorId}
              onAdminToggleMute={() => onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
              getAvatarFallbackText={getAvatarFallbackText}
              onClick={() => onSlotClick(p.id)}
            />
          ))}
        </div>
      )}

      {thirdRowParticipants.length > 0 && (
        <div className="flex justify-center items-start gap-2 sm:gap-3 flex-wrap w-full px-1">
          {thirdRowParticipants.map(p => (
            <VoiceParticipantSlot
              key={`third-${p.id}`}
              participant={p}
              isCurrentUser={p.id === currentUserUid}
              isRoomCreatorViewing={isCurrentUserRoomCreator}
              isParticipantTheRoomCreator={p.id === roomCreatorId}
              onAdminToggleMute={() => onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
              getAvatarFallbackText={getAvatarFallbackText}
              onClick={() => onSlotClick(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
VoiceParticipantGrid.displayName = 'VoiceParticipantGrid';
export default VoiceParticipantGrid;
