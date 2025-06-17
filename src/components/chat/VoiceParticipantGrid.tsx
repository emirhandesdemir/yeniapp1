
"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, UserCog, VolumeX, Crown, Plus, UserX } from "lucide-react";
import type { ActiveParticipant } from '@/app/(main)/chat/[roomId]/page'; // ActiveParticipant tipini import et
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
  participants: ActiveParticipant[];
  currentUserUid?: string;
  isCurrentUserRoomCreator: boolean;
  maxSlots: number;
  onAdminKickUser: (targetUserId: string) => void;
  onAdminToggleMuteUser: (targetUserId: string, currentMuteState?: boolean) => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onSlotClick: (participantId: string | null) => void; // null for empty slot
}

const VoiceParticipantSlot: React.FC<{
  participant: ActiveParticipant | null; // null for empty slot
  isCurrentUser: boolean;
  isRoomCreator: boolean;
  onAdminKick: () => void;
  onAdminToggleMute: () => void;
  getAvatarFallbackText: (name?: string | null) => string;
  onClick: () => void;
}> = ({ participant, isCurrentUser, isRoomCreator, onAdminKick, onAdminToggleMute, getAvatarFallbackText, onClick }) => {
  
  const MuteIcon = participant?.isMutedByAdmin ? VolumeX : (participant?.isMuted ? MicOff : Mic);
  const muteIconColor = participant?.isMutedByAdmin || participant?.isMuted ? "text-red-500" : "text-green-500";

  if (!participant) {
    return (
      <div 
        className="relative aspect-square bg-muted/30 dark:bg-muted/20 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors group border-2 border-dashed border-border hover:border-primary"
        onClick={onClick}
      >
        <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
      </div>
    );
  }

  return (
    <div 
      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center p-1.5 shadow-md transition-all duration-200 ease-in-out transform group
                  ${participant.isSpeaking ? 'border-2 border-green-500 scale-105' : 'border border-border'}
                  ${isCurrentUser ? 'bg-primary/10' : 'bg-card hover:bg-secondary/30'}`}
      onClick={onClick}
    >
      <Avatar className={`h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 mb-1 border-2 ${participant.isSpeaking ? 'border-green-400' : 'border-transparent'}`}>
        <AvatarImage src={participant.photoURL || `https://placehold.co/64x64.png`} data-ai-hint="voice chat user" />
        <AvatarFallback>{getAvatarFallbackText(participant.displayName)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium truncate w-full text-center text-foreground/80 group-hover:text-foreground">
        {participant.displayName || "Kullanıcı"}
      </p>
      
      <div className="absolute top-1 right-1 flex items-center gap-1">
        {participant.isMuted || participant.isMutedByAdmin ? (
             <MuteIcon className={`h-3.5 w-3.5 ${muteIconColor}`} />
        ) : (
             <Mic className={`h-3.5 w-3.5 ${muteIconColor}`} />
        )}
        {participant.id === isRoomCreator && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
      </div>

      {isRoomCreator && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute bottom-0 right-0 h-6 w-6 opacity-50 group-hover:opacity-100 transition-opacity">
              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAdminToggleMute(); }} disabled={participant.isMuted === undefined}>
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
  maxSlots,
  onAdminKickUser,
  onAdminToggleMuteUser,
  getAvatarFallbackText,
  onSlotClick
}) => {
  const slots = Array(maxSlots).fill(null);
  
  // Place room creator first if they are in voice chat
  let creatorParticipant: ActiveParticipant | null = null;
  let otherParticipants = [...participants];

  const creatorIndex = otherParticipants.findIndex(p => p.id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id)); // Room creator's ID from participants
  if (creatorIndex > -1) {
    creatorParticipant = otherParticipants.splice(creatorIndex, 1)[0];
  }
  
  let filledSlots = 0;
  if (creatorParticipant) {
    slots[0] = creatorParticipant;
    filledSlots++;
  }

  // Fill remaining slots with other participants
  for (let i = 0; i < otherParticipants.length && filledSlots < maxSlots; i++) {
    if (slots[filledSlots] === null) { // Find next available slot
        slots[filledSlots] = otherParticipants[i];
        filledSlots++;
    }
  }
  
  // Distribute participants into specific slot positions for Litmatch-like UI
  // Example: 1 large, then 3, then 4
  const displaySlots = Array(maxSlots).fill(null);
  let participantIndex = 0;

  // Slot 0 (Large/Host slot)
  if (participants.length > 0) {
    const host = participants.find(p => p.id === (participants.find(user => user.id === currentUserUid && isCurrentUserRoomCreator)?.id)) || // Room creator if present
                   participants.find(p => p.id === currentUserUid) || // Current user if present
                   participants[0]; // First participant otherwise
    if (host) {
      displaySlots[0] = host;
      participantIndex = participants.indexOf(host) + 1;
      if (participantIndex >= participants.length) participantIndex = 0; // Reset if we used the first one
    }
  }
  
  // Helper to get next available participant that isn't already in displaySlots[0]
  const getNextAvailableParticipant = () => {
    for (let i = 0; i < participants.length; i++) {
      const p = participants[participantIndex % participants.length];
      participantIndex++;
      if (p.id !== displaySlots[0]?.id) { // Ensure not the same as host slot
        let alreadyPlaced = false;
        for(let j=1; j<maxSlots; j++){ // Check if already placed in other slots
            if(displaySlots[j]?.id === p.id) {
                alreadyPlaced = true;
                break;
            }
        }
        if(!alreadyPlaced) return p;
      }
    }
    return null; // No more unique participants
  };


  // Slots 1-3 (First row)
  for (let i = 1; i <= 3; i++) {
    if (displaySlots[i] === null) {
      const p = getNextAvailableParticipant();
      if (p) displaySlots[i] = p;
      else break; 
    }
  }

  // Slots 4-7 (Second row)
  for (let i = 4; i <= 7; i++) {
     if (displaySlots[i] === null) {
      const p = getNextAvailableParticipant();
      if (p) displaySlots[i] = p;
      else break;
    }
  }


  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {/* Large Slot (Host) - Spans 2 columns for larger appearance */}
      <div className="col-span-2 row-span-2">
         <VoiceParticipantSlot
            participant={displaySlots[0]}
            isCurrentUser={displaySlots[0]?.id === currentUserUid}
            isRoomCreator={isCurrentUserRoomCreator && displaySlots[0]?.id === currentUserUid}
            onAdminKick={() => displaySlots[0] && onAdminKickUser(displaySlots[0].id)}
            onAdminToggleMute={() => displaySlots[0] && onAdminToggleMuteUser(displaySlots[0].id, displaySlots[0].isMutedByAdmin)}
            getAvatarFallbackText={getAvatarFallbackText}
            onClick={() => onSlotClick(displaySlots[0]?.id || null)}
          />
      </div>

      {/* Next 2 slots in the first visual row (beside large slot) */}
      {displaySlots.slice(1, 3).map((p, index) => (
        <VoiceParticipantSlot
          key={p?.id || `empty-top-${index}`}
          participant={p}
          isCurrentUser={p?.id === currentUserUid}
          isRoomCreator={false} // Only host slot can be room creator visually here
          onAdminKick={() => p && onAdminKickUser(p.id)}
          onAdminToggleMute={() => p && onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
          getAvatarFallbackText={getAvatarFallbackText}
          onClick={() => onSlotClick(p?.id || null)}
        />
      ))}
      
      {/* Next 4 slots in the second visual row */}
      {displaySlots.slice(3, maxSlots).map((p, index) => (
         <VoiceParticipantSlot
          key={p?.id || `empty-bottom-${index}`}
          participant={p}
          isCurrentUser={p?.id === currentUserUid}
          isRoomCreator={false}
          onAdminKick={() => p && onAdminKickUser(p.id)}
          onAdminToggleMute={() => p && onAdminToggleMuteUser(p.id, p.isMutedByAdmin)}
          getAvatarFallbackText={getAvatarFallbackText}
          onClick={() => onSlotClick(p?.id || null)}
        />
      ))}
    </div>
  );
};

export default VoiceParticipantGrid;
