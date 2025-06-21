
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gift, Clock, Loader2, User } from 'lucide-react';
import type { ActiveChest } from '@/app/(main)/chat/[roomId]/page';
import { type Timestamp } from 'firebase/firestore';
import { differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActiveChestDisplayProps {
  chest: ActiveChest;
  roomExpiresAt: Timestamp;
  onOpenChest: () => void;
  isOpening: boolean;
}

const ActiveChestDisplay: React.FC<ActiveChestDisplayProps> = ({
  chest,
  roomExpiresAt,
  onOpenChest,
  isOpening,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiry = roomExpiresAt.toDate(); // Sandık oda süresiyle biter
      const secondsLeft = differenceInSeconds(expiry, now);
      setTimeLeft(Math.max(0, secondsLeft));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [roomExpiresAt]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const winnerCount = Object.keys(chest.winners).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: -100 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -100 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed top-1/2 -translate-y-1/2 left-3 z-30"
    >
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenChest}
              disabled={isOpening}
              className={cn(
                "w-20 h-24 rounded-2xl bg-card/70 dark:bg-card/50 backdrop-blur-md border-2 border-yellow-500/50 flex flex-col items-center justify-center p-2 space-y-1 shadow-lg cursor-pointer transition-all hover:border-yellow-400 hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isOpening && 'cursor-wait'
              )}
            >
              <div className="relative">
                {isOpening ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <Gift className="h-8 w-8 text-yellow-500 animate-chest-pulse" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Clock className="h-3 w-3" />
                <span>{formatTime(timeLeft)}</span>
              </div>
              <span className="text-[10px] text-center text-muted-foreground truncate w-full">
                {chest.creatorName}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-semibold text-sm">Hazine Sandığı</p>
            <p className="text-xs text-muted-foreground">{chest.remainingDiamonds} / {chest.totalDiamonds} Elmas Kaldı</p>
            <p className="text-xs text-muted-foreground">{winnerCount} / {chest.maxWinners} kişi kazandı</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
};

export default React.memo(ActiveChestDisplay);
