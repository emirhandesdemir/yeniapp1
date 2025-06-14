
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  deleteDoc,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, UserPlus, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type OneOnOneChatStatus = 'waiting' | 'active' | 'closed';

interface ParticipantData {
  displayName: string | null;
  photoURL: string | null;
  decision: 'pending' | 'yes' | 'no';
  hasLeft: boolean;
}

interface OneOnOneChat {
  id: string;
  participantUids: string[];
  participantsData: { [key: string]: ParticipantData };
  status: OneOnOneChatStatus;
  createdAt: Timestamp;
}

const MATCHMAKING_TIMEOUT_SECONDS = 30;

export default function MatchmakingPage() {
  const { currentUser, userData, isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"idle" | "searching" | "waiting_for_opponent" | "matched" | "error" | "cancelled" | "timeout">(
    "idle"
  );
  const [currentMatchRoomId, setCurrentMatchRoomId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(MATCHMAKING_TIMEOUT_SECONDS);

  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roomUnsubscribeRef = useRef<(() => void) | null>(null);
  const ongoingOperationRef = useRef(false); // To prevent concurrent operations

  const resetMatchmakingState = useCallback(() => {
    setStatus("idle");
    setCurrentMatchRoomId(null);
    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    if (timeoutTimerRef.current) {
      clearInterval(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    if (roomUnsubscribeRef.current) {
      roomUnsubscribeRef.current();
      roomUnsubscribeRef.current = null;
    }
    ongoingOperationRef.current = false;
  }, []);

  // Check for existing user sessions
  useEffect(() => {
    if (!currentUser || status !== "idle" || ongoingOperationRef.current) return;

    const checkExistingSession = async () => {
      ongoingOperationRef.current = true;
      try {
        const q = query(
          collection(db, "oneOnOneChats"),
          where("participantUids", "array-contains", currentUser.uid),
          where("status", "in", ["waiting", "active"])
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existingRoomDoc = snapshot.docs[0];
          const existingRoom = existingRoomDoc.data() as Omit<OneOnOneChat, 'id'>;
          const roomId = existingRoomDoc.id;

          if (existingRoom.status === 'waiting' && existingRoom.participantUids.length === 1 && existingRoom.participantUids[0] === currentUser.uid) {
            setCurrentMatchRoomId(roomId);
            setStatus("waiting_for_opponent");
          } else if (existingRoom.status === 'active' && existingRoom.participantUids.length === 2) {
            router.replace(`/random-chat/${roomId}`);
          } else {
             // Inconsistent state, try to clean up if it's an old waiting room of mine
            if (existingRoom.status === 'waiting' && existingRoom.participantUids[0] === currentUser.uid) {
                await deleteDoc(doc(db, "oneOnOneChats", roomId)).catch(e => console.warn("Failed to cleanup stale waiting room:", e));
            }
            resetMatchmakingState(); // Allow user to start fresh
          }
        } else {
           setStatus("idle"); // No existing relevant session
        }
      } catch (error) {
        console.error("Error checking existing session:", error);
        toast({ title: "Hata", description: "Mevcut oturum kontrol edilirken bir sorun oluştu.", variant: "destructive" });
        resetMatchmakingState();
      } finally {
        ongoingOperationRef.current = false;
      }
    };

    checkExistingSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, status, router]); // Removed resetMatchmakingState as it causes loop, status change handles it.

  // Listener for when waiting for an opponent
  useEffect(() => {
    if (status !== "waiting_for_opponent" || !currentMatchRoomId) {
      if (roomUnsubscribeRef.current) {
        roomUnsubscribeRef.current();
        roomUnsubscribeRef.current = null;
      }
      if (timeoutTimerRef.current) {
        clearInterval(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      return;
    }

    const roomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
    roomUnsubscribeRef.current = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data() as OneOnOneChat;
        if (roomData.status === "active" && roomData.participantUids.length === 2) {
          if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
          if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
          setStatus("matched");
          toast({ title: "Eşleşme Bulundu!", description: "Sohbete yönlendiriliyorsunuz..." });
          router.push(`/random-chat/${currentMatchRoomId}`);
        } else if (['closed', 'closed_by_leave', 'closed_by_decline'].includes(roomData.status)) {
          toast({ title: "Eşleşme Hatası", description: "Oda beklenmedik bir şekilde kapandı.", variant: "destructive" });
          resetMatchmakingState();
        }
      } else {
        // Room deleted (likely by timeout or cancellation elsewhere)
        toast({ title: "Eşleşme İptal", description: "Bekleme odanız bulunamadı veya silindi.", variant: "destructive" });
        resetMatchmakingState();
      }
    }, (error) => {
      console.error("Error listening to room for opponent:", error);
      toast({ title: "Dinleme Hatası", description: "Oda dinlenirken bir hata oluştu.", variant: "destructive" });
      resetMatchmakingState();
    });

    // Start timeout timer
    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    timeoutTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timeoutTimerRef.current!);
          timeoutTimerRef.current = null;
          if (currentMatchRoomId && status === "waiting_for_opponent") { // Ensure still in correct state
            const waitingRoomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
            getDoc(waitingRoomRef).then(docSnap => {
              if (docSnap.exists() && docSnap.data()?.status === 'waiting') {
                deleteDoc(waitingRoomRef).catch(e => console.error("Error deleting timed out room: ", e));
              }
            });
          }
          toast({ title: "Eşleşme Bulunamadı", description: "Belirlenen sürede eşleşme bulunamadı.", variant: "destructive" });
          resetMatchmakingState(); // Reset to idle after timeout logic
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (roomUnsubscribeRef.current) {
        roomUnsubscribeRef.current();
        roomUnsubscribeRef.current = null;
      }
      if (timeoutTimerRef.current) {
        clearInterval(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
  }, [status, currentMatchRoomId, router, toast, resetMatchmakingState]);


  const findOrCreateMatch = async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Eşleşme bulmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (ongoingOperationRef.current || !["idle", "timeout", "cancelled", "error"].includes(status)) {
        // console.log("Matchmaking operation already in progress or not in a valid state to start.");
        return;
    }

    ongoingOperationRef.current = true;
    setStatus("searching");

    try {
      const q = query(
        collection(db, "oneOnOneChats"),
        where("status", "==", "waiting"),
        limit(10) // Fetch a few to increase chances and check for self-match
      );
      const querySnapshot = await getDocs(q);

      let joinedRoomId: string | null = null;
      if (!querySnapshot.empty) {
        for (const waitingRoomDoc of querySnapshot.docs) {
          const waitingRoomData = waitingRoomDoc.data() as Omit<OneOnOneChat, 'id'>;
          // Crucially, don't join your own waiting room or a full room
          if (waitingRoomData.participantUids[0] !== currentUser.uid && waitingRoomData.participantUids.length === 1) {
            joinedRoomId = waitingRoomDoc.id;
            const roomRef = doc(db, "oneOnOneChats", joinedRoomId);
            await updateDoc(roomRef, {
              participantUids: [waitingRoomData.participantUids[0], currentUser.uid],
              [`participantsData.${currentUser.uid}`]: {
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                decision: "pending",
                hasLeft: false,
              },
              status: "active",
            });
            // No need to set currentMatchRoomId here, the onSnapshot listener will handle it
            // Or, if we want immediate navigation:
             setStatus("matched"); // This will trigger navigation via useEffect if onSnapshot is too slow
             router.push(`/random-chat/${joinedRoomId}`);
            ongoingOperationRef.current = false;
            return; // Exit after joining
          }
        }
      }
      
      // If no suitable room to join, create a new one
      const newRoomRef = await addDoc(collection(db, "oneOnOneChats"), {
        participantUids: [currentUser.uid],
        participantsData: {
          [currentUser.uid]: {
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            decision: "pending",
            hasLeft: false,
          },
        },
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setCurrentMatchRoomId(newRoomRef.id);
      setStatus("waiting_for_opponent");

    } catch (error) {
      console.error("Error finding or creating match:", error);
      toast({ title: "Eşleşme Hatası", description: "Eşleşme sırasında bir sorun oluştu.", variant: "destructive" });
      resetMatchmakingState(); // Reset to idle on error
    } finally {
      ongoingOperationRef.current = false;
    }
  };

  const cancelMatchmaking = async () => {
    if (ongoingOperationRef.current && status !== "waiting_for_opponent") return; // Don't cancel if mid-search
    
    const roomIdToCancel = currentMatchRoomId; // Capture before resetting
    const currentStatus = status;

    resetMatchmakingState(); // Reset UI first
    setStatus("cancelled"); // Show cancelled state briefly

    if (roomIdToCancel && currentStatus === "waiting_for_opponent") {
      try {
        const roomRef = doc(db, "oneOnOneChats", roomIdToCancel);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists() && roomSnap.data()?.status === 'waiting') {
          await deleteDoc(roomRef);
        }
        toast({ title: "Eşleşme İptal Edildi", description: "Eşleşme arayışınız iptal edildi." });
      } catch (error) {
        console.error("Error cancelling matchmaking (deleting room):", error);
        toast({ title: "İptal Hatası", description: "Eşleşme iptal edilirken bir sorun oluştu.", variant: "destructive" });
      }
    }
    // After a brief moment, return to idle to allow retry
    setTimeout(() => {
        if(status === "cancelled") resetMatchmakingState();
    }, 1500);
  };

  if (isUserLoading && !currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 space-y-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Sparkles className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-3xl font-headline">Rastgele Eşleşme</CardTitle>
          <CardDescription>Yeni birisiyle tanışmak için eşleşme başlatın!</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "idle" && (
            <Button size="lg" className="w-full animate-subtle-pulse" onClick={findOrCreateMatch} disabled={ongoingOperationRef.current}>
              <UserPlus className="mr-2 h-5 w-5" /> Eşleşme Bul
            </Button>
          )}

          {(status === "searching" || status === "waiting_for_opponent") && (
            <div className="space-y-3">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {status === "searching" ? "Uygun bir eşleşme aranıyor..." : "Rakip bekleniyor..."}
              </p>
              {status === "waiting_for_opponent" && (
                 <p className="text-lg font-semibold text-primary">{countdown > 0 ? `${countdown} saniye kaldı` : "Zaman doldu..."}</p>
              )}
              <Button variant="outline" className="w-full" onClick={cancelMatchmaking} disabled={ongoingOperationRef.current && status !== "waiting_for_opponent"}>
                <XCircle className="mr-2 h-5 w-5" /> İptal Et
              </Button>
            </div>
          )}

          {status === "matched" && (
            <div>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-green-500" />
              <p className="text-green-600 font-semibold mt-2">Eşleşme Bulundu! Sohbete yönlendiriliyorsunuz...</p>
            </div>
          )}
           {(status === "error" || status === "cancelled" || status === "timeout") && (
            <div className="space-y-3">
                <p className={`font-semibold ${status === "error" || status === "timeout" ? "text-destructive" : "text-muted-foreground"}`}>
                    {status === "error" && "Bir hata oluştu. Lütfen tekrar deneyin."}
                    {status === "cancelled" && "Eşleşme arayışı iptal edildi."}
                    {status === "timeout" && "Uygun eşleşme bulunamadı."}
                </p>
                <Button size="lg" className="w-full" onClick={() => { resetMatchmakingState(); findOrCreateMatch(); }} disabled={ongoingOperationRef.current}>
                    <UserPlus className="mr-2 h-5 w-5" /> Tekrar Eşleşme Bul
                </Button>
            </div>
           )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground max-w-sm text-center">
        Rastgele eşleşme ile yeni insanlarla tanışabilir, sohbet edebilir ve isterseniz arkadaş olarak ekleyebilirsiniz.
      </p>
    </div>
  );
}
    