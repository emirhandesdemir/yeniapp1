
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export interface MinimizedRoomInfo {
  id: string;
  name: string;
  image?: string | null;
  imageAiHint?: string | null;
  leaveRoom: () => Promise<void>; // Function to fully leave the room
}

interface MinimizedChatContextType {
  minimizedRoom: MinimizedRoomInfo | null;
  minimizeRoom: (room: MinimizedRoomInfo) => void;
  closeMinimizedRoom: () => void;
}

const MinimizedChatContext = createContext<MinimizedChatContextType | undefined>(undefined);

export function useMinimizedChat() {
  const context = useContext(MinimizedChatContext);
  if (!context) {
    throw new Error('useMinimizedChat must be used within a MinimizedChatProvider');
  }
  return context;
}

export function MinimizedChatProvider({ children }: { children: ReactNode }) {
  const [minimizedRoom, setMinimizedRoom] = useState<MinimizedRoomInfo | null>(null);

  const minimizeRoom = useCallback((room: MinimizedRoomInfo) => {
    setMinimizedRoom(room);
  }, []);

  const closeMinimizedRoom = useCallback(() => {
    setMinimizedRoom(null);
  }, []);

  const value = useMemo(() => ({
    minimizedRoom,
    minimizeRoom,
    closeMinimizedRoom,
  }), [minimizedRoom, minimizeRoom, closeMinimizedRoom]);

  return (
    <MinimizedChatContext.Provider value={value}>
      {children}
    </MinimizedChatContext.Provider>
  );
}
