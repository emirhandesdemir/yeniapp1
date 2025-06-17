
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, UserCog, VolumeX, Crown, Plus, UserX } from "lucide-react";
import type { ActiveVoiceParticipantData } from '@/app/(main)/chat/[roomId]/page'; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VoiceParticipantGridProps {
  participants: ActiveVoiceParticipantData[];
  currentUserUid?: string;
  isCurrentUserRoomCreator: boolean;
  maxSlots: number;
  onAdminKickUser: (targetUserId: string) => void;
  onAdminToggleMuteUser: (targetUserId: string, currentMuteState?: boolean) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onSlotClick: (participantId: string | null) => void; 
}

const VoiceParticipantSlot: React.FC<{
  participant: ActiveVoiceParticipantData | null; 
  isCurrentUser: boolean;
  isHostSlot?: boolean; // To indicate if this is the main "host" slot
  isRoomCreator: boolean; // Is the logged-in user the room creator? (for admin actions)
  isParticipantCreator: boolean; // Is this specific participant the room creator? (for crown icon)
  onAdminKick: () => void;
  onAdminToggleMute: () => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onClick: () => void;
}> = ({ 
    participant, 
    isCurrentUser, 
    isHostSlot = false, 
    isRoomCreator,
    isParticipantCreator,
    onAdminKick, 
    onAdminToggleMute, 
    getAvatarFallbackText, 
    onClick 
}) => {
  
  const MuteIcon = participant?.isMutedByAdmin ? VolumeX : (participant?.isMuted ? MicOff : Mic);
  const muteIconColor = participant?.isMutedByAdmin || participant?.isMuted ? "text-red-500" : "text-green-500";

  if (!participant) {
    return (
      <div 
        className={`relative aspect-square bg-muted/30 dark:bg-muted/20 rounded-full flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors group border-2 border-dashed border-border hover:border-primary
                    ${isHostSlot ? 'col-span-2 row-span-2' : ''}`} // Host slot can be larger
        onClick={onClick}
      >
        <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
      </div>
    );
  }

  return (
    <div 
      className={`relative aspect-square rounded-full flex flex-col items-center justify-center p-1.5 shadow-md transition-all duration-200 ease-in-out transform group
                  ${participant.isSpeaking ? 'border-2 border-green-500 scale-105' : 'border border-border'}
                  ${isCurrentUser ? 'bg-primary/10' : 'bg-card hover:bg-secondary/30'}
                  ${isHostSlot ? 'col-span-2 row-span-2' : ''}`} // Host slot styling
      onClick={onClick}
    >
      <Avatar className={`${isHostSlot ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16'} mb-1 border-2 ${participant.isSpeaking ? 'border-green-400' : 'border-transparent'}`}>
        <AvatarImage src={participant.photoURL || `https://placehold.co/64x64.png`} data-ai-hint="voice chat user" />
        <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium truncate w-full text-center text-foreground/80 group-hover:text-foreground">
        {participant.displayName || "Kullanıcı"}
      </p>
      
      <div className="absolute top-1 right-1 flex items-center gap-1">
        <MuteIcon className={`h-3.5 w-3.5 ${muteIconColor}`} />
        {isParticipantCreator && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
      </div>

      {isRoomCreator && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute bottom-0 right-0 h-6 w-6 opacity-50 group-hover:opacity-100 transition-opacity">
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


const VoiceParticipantGrid: React.FC<VoiceParticipantGridProps> = ({
  participants,
  currentUserUid,
  isCurrentUserRoomCreator, // This is if the *viewer* is the room creator
  maxSlots, // This is the overall room max participants
  onAdminKickUser,
  onAdminToggleMuteUser,
  getAvatarFallbackText,
  onSlotClick
}) => {
  const actualMaxSlots = Math.min(maxSlots, 7); // Voice chat specific limit
  
  // Determine the host: Room creator if in voice, otherwise current user if in voice, otherwise first participant in voice.
  const roomCreatorInVoice = participants.find(p => p.id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id));
  const currentUserInVoice = participants.find(p => p.id === currentUserUid);
  
  let hostParticipant: ActiveVoiceParticipantData | null = null;
  if (roomCreatorInVoice) {
    hostParticipant = roomCreatorInVoice;
  } else if (currentUserInVoice) {
    hostParticipant = currentUserInVoice;
  } else if (participants.length > 0) {
    hostParticipant = participants[0];
  }

  const otherParticipants = participants.filter(p => p.id !== hostParticipant?.id);

  const gridSlots = Array(actualMaxSlots).fill(null);
  let participantIdx = 0;

  // Fill host slot
  if (hostParticipant) {
    gridSlots[0] = hostParticipant;
  }

  // Fill remaining slots
  for (let i = 1; i < actualMaxSlots; i++) {
    if (participantIdx < otherParticipants.length) {
      gridSlots[i] = otherParticipants[participantIdx];
      participantIdx++;
    } else {
      break; 
    }
  }
  
  // Litmatch-style layout: 1 large, then 2, then 4 (total 7)
  // Grid structure: col-span-2 for large, then 2 items, then 4 items
  // Requires a parent grid container with 4 columns.
  // The VoiceParticipantSlot component itself will handle col-span for the host slot.

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {/* Slot 0 (Host) */}
      <VoiceParticipantSlot
        participant={gridSlots[0]}
        isCurrentUser={gridSlots[0]?.id === currentUserUid}
        isHostSlot={true}
        isRoomCreator={isCurrentUserRoomCreator}
        isParticipantCreator={!!(gridSlots[0] && gridSlots[0].id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id))}
        onAdminKick={() => gridSlots[0] && onAdminKickUser(gridSlots[0].id)}
        onAdminToggleMute={() => gridSlots[0] && onAdminToggleMuteUser(gridSlots[0].id, gridSlots[0].isMutedByAdmin)}
        getAvatarFallbackText={getAvatarFallbackText}
        onClick={() => onSlotClick(gridSlots[0]?.id || null)}
      />

      {/* Slots 1 & 2 (Next to Host) */}
      {gridSlots.slice(1, 3).map((p, index) => (
        <VoiceParticipantSlot
          key={p?.id || `empty-row1-${index}`}
          participant={p}
          isCurrentUser={p?.id === currentUserUid}
          isRoomCreator={isCurrentUserRoomCreator}
          isParticipantCreator={!!(p && p.id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id))}
          onAdminKick={() => p && onAdminKickUser(p.id)}
          onAdminToggleMute={() => p && onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
          getAvatarFallbackText={getAvatarFallbackText}
          onClick={() => onSlotClick(p?.id || null)}
        />
      ))}
      
      {/* Slots 3, 4, 5, 6 (Second Row) - Fill up to actualMaxSlots */}
      {gridSlots.slice(3, actualMaxSlots).map((p, index) => (
         <VoiceParticipantSlot
          key={p?.id || `empty-row2-${index}`}
          participant={p}
          isCurrentUser={p?.id === currentUserUid}
          isRoomCreator={isCurrentUserRoomCreator}
          isParticipantCreator={!!(p && p.id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id))}
          onAdminKick={() => p && onAdminKickUser(p.id)}
          onAdminToggleMute={() => p && onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
          getAvatarFallbackText={getAvatarFallbackText}
          onClick={() => onSlotClick(p?.id || null)}
        />
      ))}
      {/* Render empty placeholders if needed to fill up to actualMaxSlots in the grid structure */}
      {Array(actualMaxSlots - participants.length > 0 ? Math.min(4, actualMaxSlots - participants.length) : 0)
        .fill(null)
        .map((_, index) => (
          (participants.length + index < actualMaxSlots && participants.length + index >= 3) && // only for second row empty slots if needed
          <VoiceParticipantSlot
            key={`placeholder-row2-${index}`}
            participant={null}
            isCurrentUser={false}
            isRoomCreator={isCurrentUserRoomCreator}
            isParticipantCreator={false}
            onAdminKick={() => {}}
            onAdminToggleMute={() => {}}
            getAvatarFallbackText={getAvatarFallbackText}
            onClick={() => onSlotClick(null)}
          />
      ))}
    </div>
  );
};

export default VoiceParticipantGrid;

