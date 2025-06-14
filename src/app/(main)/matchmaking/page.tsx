
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
  getDoc
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, UserPlus, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { OneOnOneChatRoom } from "../random-chat/[roomId]/page"; // Assuming type export

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
  const ongoingOperationRef = useRef(false); 

  const resetMatchmakingState = useCallback(() => {
    // console.log("Resetting matchmaking state. Current status:", status, "Room ID:", currentMatchRoomId);
    if (roomUnsubscribeRef.current) {
      roomUnsubscribeRef.current();
      roomUnsubscribeRef.current = null;
      // console.log("Room unsubscribe cleared.");
    }
    if (timeoutTimerRef.current) {
      clearInterval(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
      // console.log("Timeout timer cleared.");
    }
    setStatus("idle");
    setCurrentMatchRoomId(null);
    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    ongoingOperationRef.current = false;
    // console.log("Matchmaking state has been reset.");
  }, []);


  useEffect(() => {
    if (!currentUser || ongoingOperationRef.current || status !== "idle") return;

    ongoingOperationRef.current = true;
    // console.log("Checking for existing 1v1 session...");
    const checkExistingSession = async () => {
      try {
        const q = query(
          collection(db, "oneOnOneChats"),
          where("participantUids", "array-contains", currentUser.uid),
          where("status", "in", ["waiting", "active"])
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const existingRoomDoc = snapshot.docs[0];
          const existingRoom = existingRoomDoc.data() as Omit<OneOnOneChatRoom, 'id'> & {id: string};
          existingRoom.id = existingRoomDoc.id;
          
          // console.log("Found existing room:", existingRoom.id, "Status:", existingRoom.status);

          if (existingRoom.status === 'active' && existingRoom.participantUids.length === 2) {
            // console.log("Redirecting to active room:", existingRoom.id);
            router.replace(`/random-chat/${existingRoom.id}`);
            return;
          } else if (existingRoom.status === 'waiting' && existingRoom.participantUids.length === 1 && existingRoom.participantUids[0] === currentUser.uid) {
            // console.log("Found own waiting room:", existingRoom.id, ". Moving to random-chat page to wait.");
            // If user has their own waiting room, they should be on the chat page waiting.
             router.replace(`/random-chat/${existingRoom.id}`);
             return;
          } else {
            // Inconsistent state or old room, try to clean up if it's an old waiting room of mine
            // console.warn("Inconsistent room state found:", existingRoom.id, "Status:", existingRoom.status);
            if (existingRoom.status === 'waiting' && existingRoom.participantUids.length === 1 && existingRoom.participantUids[0] === currentUser.uid) {
                // console.log("Deleting stale waiting room:", existingRoom.id);
                await deleteDoc(doc(db, "oneOnOneChats", existingRoom.id)).catch(e => console.warn("Failed to cleanup stale waiting room:", e));
            }
            resetMatchmakingState(); 
          }
        } else {
           // console.log("No existing relevant session found.");
           setStatus("idle"); 
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
  }, [currentUser, status, router, resetMatchmakingState, toast]);


  useEffect(() => {
    // This useEffect is for users who might somehow land on matchmaking page
    // while already having a 'waiting_for_opponent' status and a currentMatchRoomId.
    // The primary flow (create/join -> redirect to random-chat) means this listener
    // is more of a fallback or for specific edge cases where user isn't immediately redirected.
    if (status !== "waiting_for_opponent" || !currentMatchRoomId || !currentUser) {
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
      roomUnsubscribeRef.current = null;
      timeoutTimerRef.current = null;
      return;
    }
    
    // console.log(`[MatchmakingPage Effect] Status is waiting_for_opponent for room ${currentMatchRoomId}. Starting listener and timeout.`);

    const roomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
    roomUnsubscribeRef.current = onSnapshot(roomRef, (docSnap) => {
      if (ongoingOperationRef.current) return; // Avoid processing during other ops

      if (docSnap.exists()) {
        const roomData = docSnap.data() as OneOnOneChatRoom;
        // console.log(`[MatchmakingPage Listener] Room ${currentMatchRoomId} snapshot. Status: ${roomData.status}, Participants: ${roomData.participantUids.length}`);
        if (roomData.status === "active" && roomData.participantUids.length === 2) {
          if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
          if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
          roomUnsubscribeRef.current = null;
          timeoutTimerRef.current = null;
          setStatus("matched");
          toast({ title: "Eşleşme Bulundu!", description: "Sohbete yönlendiriliyorsunuz..." });
          router.push(`/random-chat/${currentMatchRoomId}`);
        } else if (roomData.status === "waiting" && roomData.participantUids.length === 1 && roomData.participantUids[0] === currentUser.uid) {
          // Still waiting, this is normal if user is on this page. Do nothing specific here.
          // The timeout will handle it if no one joins.
        } else {
          // Room is no longer valid for this user to be waiting on this page
          // (e.g. closed, taken by someone else, inconsistent state, or not my room anymore)
          // console.warn(`[MatchmakingPage Listener] Room ${currentMatchRoomId} is in an unexpected state for waiting: ${roomData.status}`);
          if (currentMatchRoomId === docSnap.id) { // Make sure we are resetting for the correct room
            toast({ title: "Eşleşme Durumu Değişti", description: "Bekleme odası artık geçerli değil.", variant: "destructive" });
            resetMatchmakingState();
          }
        }
      } else {
        // Room deleted
        // console.log(`[MatchmakingPage Listener] Room ${currentMatchRoomId} deleted.`);
        toast({ title: "Eşleşme İptal", description: "Bekleme odanız bulunamadı veya silindi.", variant: "destructive" });
        resetMatchmakingState();
      }
    }, (error) => {
      console.error("Error listening to room for opponent on matchmaking page:", error);
      toast({ title: "Dinleme Hatası", description: "Oda dinlenirken bir hata oluştu.", variant: "destructive" });
      resetMatchmakingState();
    });

    // Start timeout timer FOR THIS PAGE
    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    timeoutTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timeoutTimerRef.current!);
          timeoutTimerRef.current = null;
          // console.log(`[MatchmakingPage Timeout] Timeout for room ${currentMatchRoomId}. Current status: ${status}`);
          if (currentMatchRoomId && status === "waiting_for_opponent") { 
            const waitingRoomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
            getDoc(waitingRoomRef).then(docSnap => {
              if (docSnap.exists() && docSnap.data()?.status === 'waiting' && docSnap.data()?.participantUids[0] === currentUser?.uid) {
                // console.log(`[MatchmakingPage Timeout] Deleting timed out waiting room ${currentMatchRoomId} from matchmaking page.`);
                deleteDoc(waitingRoomRef).catch(e => console.error("Error deleting timed out room: ", e));
              }
            });
            toast({ title: "Eşleşme Bulunamadı", description: "Belirlenen sürede eşleşme bulunamadı (eşleştirme sayfasından).", variant: "destructive" });
            resetMatchmakingState(); 
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      // console.log(`[MatchmakingPage Effect Cleanup] Cleaning up for status: ${status}, room: ${currentMatchRoomId}`);
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
      roomUnsubscribeRef.current = null;
      timeoutTimerRef.current = null;
    };
  }, [status, currentMatchRoomId, router, toast, resetMatchmakingState, currentUser]);


  const findOrCreateMatch = async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Eşleşme bulmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (ongoingOperationRef.current || !["idle", "timeout", "cancelled", "error"].includes(status)) {
        // console.log("Matchmaking operation already in progress or not in a valid state to start. Status:", status);
        return;
    }

    ongoingOperationRef.current = true;
    setStatus("searching");
    // console.log("Starting findOrCreateMatch. CurrentUser:", currentUser.uid);

    try {
      const q = query(
        collection(db, "oneOnOneChats"),
        where("status", "==", "waiting"),
        limit(10) 
      );
      const querySnapshot = await getDocs(q);
      // console.log(`Found ${querySnapshot.docs.length} waiting rooms.`);

      let joinedRoomId: string | null = null;
      if (!querySnapshot.empty) {
        for (const waitingRoomDoc of querySnapshot.docs) {
          const waitingRoomData = waitingRoomDoc.data() as Omit<OneOnOneChatRoom, 'id'>;
          if (waitingRoomData.participantUids[0] !== currentUser.uid && waitingRoomData.participantUids.length === 1) {
            joinedRoomId = waitingRoomDoc.id;
            const roomRef = doc(db, "oneOnOneChats", joinedRoomId);
            // console.log(`Joining room ${joinedRoomId} for user ${currentUser.uid}. Other participant: ${waitingRoomData.participantUids[0]}`);
            await updateDoc(roomRef, {
              participantUids: [waitingRoomData.participantUids[0], currentUser.uid],
              [`participantsData.${currentUser.uid}`]: {
                uid: currentUser.uid,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                decision: "pending",
                hasLeft: false,
              },
              status: "active",
            });
            // console.log(`Room ${joinedRoomId} updated to active. Navigating to random-chat.`);
            setStatus("matched"); 
            router.push(`/random-chat/${joinedRoomId}`);
            ongoingOperationRef.current = false;
            return; 
          }
        }
      }
      
      // console.log(`No suitable room to join. Creating new room for user ${currentUser.uid}.`);
      const newRoomRef = await addDoc(collection(db, "oneOnOneChats"), {
        participantUids: [currentUser.uid],
        participantsData: {
          [currentUser.uid]: {
            uid: currentUser.uid,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            decision: "pending",
            hasLeft: false,
          },
        },
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      // console.log(`New room ${newRoomRef.id} created with status 'waiting'. Navigating to random-chat.`);
      // No need to set currentMatchRoomId here if we immediately navigate.
      // The random-chat page will handle its own state based on the room it loads.
      // Setting status for matchmaking page just before navigation.
      setStatus("waiting_for_opponent"); // Or "matched" if we consider creation a direct path to waiting on chat page
      router.push(`/random-chat/${newRoomRef.id}`);

    } catch (error) {
      console.error("Error finding or creating match:", error);
      toast({ title: "Eşleşme Hatası", description: "Eşleşme sırasında bir sorun oluştu.", variant: "destructive" });
      resetMatchmakingState(); 
    } finally {
      ongoingOperationRef.current = false;
    }
  };

  const cancelMatchmaking = async () => {
    if (ongoingOperationRef.current && status !== "waiting_for_opponent") return; 
    
    const roomIdToCancel = currentMatchRoomId; 
    const currentStatus = status;
    // console.log(`Cancelling matchmaking. Current status: ${currentStatus}, Room ID to cancel: ${roomIdToCancel}`);

    // Reset UI and local state first
    // This might clear roomUnsubscribeRef and timeoutTimerRef via resetMatchmakingState,
    // which is fine because we are cancelling.
    resetMatchmakingState(); 
    setStatus("cancelled"); 

    if (roomIdToCancel && currentStatus === "waiting_for_opponent") {
      // console.log(`Attempting to delete room ${roomIdToCancel} due to cancellation from matchmaking page.`);
      try {
        const roomRef = doc(db, "oneOnOneChats", roomIdToCancel);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists() && roomSnap.data()?.status === 'waiting' && roomSnap.data()?.participantUids[0] === currentUser?.uid) {
          await deleteDoc(roomRef);
          // console.log(`Room ${roomIdToCancel} deleted successfully.`);
        } else {
          // console.log(`Room ${roomIdToCancel} not deleted: either not found, not 'waiting', or not owned by current user.`);
        }
        toast({ title: "Eşleşme İptal Edildi", description: "Eşleşme arayışınız iptal edildi." });
      } catch (error) {
        console.error("Error cancelling matchmaking (deleting room):", error);
        toast({ title: "İptal Hatası", description: "Eşleşme iptal edilirken bir sorun oluştu.", variant: "destructive" });
      }
    }
    
    setTimeout(() => {
        if(status === "cancelled") resetMatchmakingState(); // Return to idle
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
            <Button size="lg" className="w-full animate-subtle-pulse" onClick={findOrCreateMatch} disabled={ongoingOperationRef.current || isUserLoading}>
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

          {status === "matched" && ( // This state might be very brief as user is redirected
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
                <Button size="lg" className="w-full" onClick={() => { resetMatchmakingState(); findOrCreateMatch(); }} disabled={ongoingOperationRef.current || isUserLoading}>
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
    
