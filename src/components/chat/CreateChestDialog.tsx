
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Gem, Gift, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, serverTimestamp, writeBatch, type Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface CreateChestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomExpiresAt?: Timestamp;
  userDiamonds: number;
}

const SYSTEM_FEE_PER_WINNER = 5;

export default function CreateChestDialog({
  isOpen,
  onClose,
  roomId,
  roomExpiresAt,
  userDiamonds,
}: CreateChestDialogProps) {
  const [totalDiamonds, setTotalDiamonds] = useState(10);
  const [maxWinners, setMaxWinners] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { currentUser, userData, updateUserDiamonds } = useAuth();

  const handleClose = useCallback(() => {
    if (isCreating) return;
    setTotalDiamonds(10);
    setMaxWinners(1);
    onClose();
  }, [isCreating, onClose]);

  const systemFee = useMemo(() => {
    return Math.max(0, (maxWinners - 1) * SYSTEM_FEE_PER_WINNER);
  }, [maxWinners]);

  const totalCost = useMemo(() => {
    return totalDiamonds + systemFee;
  }, [totalDiamonds, systemFee]);

  const hasEnoughDiamonds = userDiamonds >= totalCost;

  const handleCreateChest = async () => {
    if (!currentUser || !userData || !roomExpiresAt) {
      toast({ title: "Hata", description: "Sandık oluşturulamadı. Gerekli bilgiler eksik.", variant: "destructive" });
      return;
    }
    if (totalDiamonds < maxWinners) {
        toast({ title: "Hata", description: "Elmas sayısı, kazanan sayısından az olamaz.", variant: "destructive"});
        return;
    }
    if (!hasEnoughDiamonds) {
        toast({ title: "Yetersiz Elmas", description: `Bu sandığı oluşturmak için ${totalCost} elmasa ihtiyacınız var.`, variant: "destructive"});
        return;
    }

    setIsCreating(true);
    const chestDocRef = doc(db, 'chatRooms', roomId, 'activeChest', 'current');
    const roomDocRef = doc(db, 'chatRooms', roomId);
    const userDocRef = doc(db, 'users', currentUser.uid);
    const systemMessageRef = doc(collection(db, 'chatRooms', roomId, 'messages'));
    
    try {
        const batch = writeBatch(db);

        // 1. Set the chest document
        batch.set(chestDocRef, {
            creatorId: currentUser.uid,
            creatorName: userData.displayName || 'Bir Kullanıcı',
            totalDiamonds,
            remainingDiamonds: totalDiamonds,
            maxWinners,
            winners: {},
            createdAt: serverTimestamp(),
            expiresAt: roomExpiresAt,
        });

        // 2. Update the room document
        batch.update(roomDocRef, { activeChestId: 'current' });
        
        // 3. Update user's diamonds
        batch.update(userDocRef, { diamonds: userDiamonds - totalCost });
        
        // 4. Add system message
        batch.set(systemMessageRef, {
            text: `${userData.displayName}, ${totalDiamonds} elmaslık bir hazine sandığı gönderdi! 💎 Sandığı açmak için tıkla!`,
            senderId: "system",
            senderName: "Hazine Avcısı",
            timestamp: serverTimestamp(),
            isChestMessage: true,
        });

        await batch.commit();

        // Optimistically update local user data
        updateUserDiamonds(userDiamonds - totalCost);

        toast({ title: "Başarılı!", description: "Hazine sandığı odaya gönderildi!" });
        handleClose();

    } catch (error) {
        console.error("Error creating chest:", error);
        toast({ title: "Hata", description: "Sandık oluşturulurken bir sorun oluştu.", variant: "destructive" });
    } finally {
        setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="h-6 w-6 text-primary" /> Hazine Sandığı Gönder</DialogTitle>
          <DialogDescription>
            Odadaki şanslı kişilere elmas hediye et. Toplam maliyet, elmas miktarınızdan düşülecektir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="total-diamonds">Toplam Elmas Miktarı ({totalDiamonds})</Label>
            <div className="flex items-center gap-3">
              <Gem className="h-5 w-5 text-yellow-400" />
              <Slider
                id="total-diamonds"
                min={1}
                max={Math.min(1000, userDiamonds)}
                step={1}
                value={[totalDiamonds]}
                onValueChange={(val) => setTotalDiamonds(val[0])}
                disabled={isCreating}
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="max-winners">Maksimum Kazanan Sayısı ({maxWinners})</Label>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <Slider
                id="max-winners"
                min={1}
                max={20}
                step={1}
                value={[maxWinners]}
                onValueChange={(val) => setMaxWinners(val[0])}
                disabled={isCreating}
              />
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg space-y-2 border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Sandık Tutarı:</span>
              <span className="font-semibold flex items-center gap-1">{totalDiamonds} <Gem className="h-4 w-4 text-yellow-500" /></span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Sistem Ücreti:</span>
              <span className="font-semibold flex items-center gap-1">{systemFee} <Gem className="h-4 w-4 text-yellow-500" /></span>
            </div>
            <hr className="my-1 border-border" />
            <div className="flex justify-between items-center text-base">
              <span className="font-bold text-foreground">Toplam Maliyet:</span>
              <span className="font-bold text-primary flex items-center gap-1">{totalCost} <Gem className="h-5 w-5 text-yellow-400" /></span>
            </div>
            <p className={cn("text-xs text-center pt-2", hasEnoughDiamonds ? "text-muted-foreground" : "text-destructive font-medium")}>
              Mevcut Elmasınız: {userDiamonds}
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isCreating}>
              İptal
            </Button>
          </DialogClose>
          <Button onClick={handleCreateChest} disabled={isCreating || !hasEnoughDiamonds}>
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
            Sandığı Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
