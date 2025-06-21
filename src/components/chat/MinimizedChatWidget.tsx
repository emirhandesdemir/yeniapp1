
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMinimizedChat } from '@/contexts/MinimizedChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Maximize2, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function MinimizedChatWidget() {
    const { minimizedRoom, closeMinimizedRoom } = useMinimizedChat();
    const [isLeaving, setIsLeaving] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    if (!minimizedRoom) {
        return null;
    }
    
    const handleLeave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsLeaving(true);
        try {
            await minimizedRoom.leaveRoom();
            toast({ title: "Odadan Ayrıldın", description: `${minimizedRoom.name} odasından başarıyla ayrıldınız.` });
            // closeMinimizedRoom is called inside the leaveRoom function
        } catch (error) {
            console.error("Error leaving room from widget:", error);
            toast({ title: "Hata", description: "Odadan ayrılırken bir sorun oluştu.", variant: "destructive" });
        } finally {
            setIsLeaving(false);
        }
    };
    
    const handleMaximize = (e: React.MouseEvent) => {
        e.preventDefault();
        router.push(`/chat/${minimizedRoom.id}`);
        // The chat page's own logic will handle closing the widget upon mount.
    };

    return (
        <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed bottom-4 right-4 z-50 bg-card/80 backdrop-blur-md rounded-2xl shadow-2xl border border-border/50 cursor-grab active:cursor-grabbing w-72"
        >
            <div className="flex items-center p-3 gap-3" onClick={handleMaximize}>
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 rounded-lg flex-shrink-0">
                        <AvatarImage src={minimizedRoom.image || `https://placehold.co/48x48.png`} data-ai-hint={minimizedRoom.imageAiHint || "group chat"} />
                        <AvatarFallback>{minimizedRoom.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{minimizedRoom.name}</p>
                        <p className="text-xs text-green-500">Odadasın</p>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleMaximize}>
                         <Maximize2 className="h-4 w-4"/>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLeave} className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={isLeaving}>
                       {isLeaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
