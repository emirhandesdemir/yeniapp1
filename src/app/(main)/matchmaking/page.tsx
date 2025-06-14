
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
  getDoc,
  writeBatch
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, UserPlus, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { OneOnOneChatRoom, ParticipantData } from "../random-chat/[roomId]/page";

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
  const hasNavigatedRef = useRef(false); // Yönlendirme yapılıp yapılmadığını takip et

  const resetMatchmakingState = useCallback((newStatus: "idle" | "error" | "cancelled" | "timeout" = "idle") => {
    // console.log("[MatchmakingPage] Resetting state. New status:", newStatus, "Current Room ID:", currentMatchRoomId);
    if (roomUnsubscribeRef.current) {
      roomUnsubscribeRef.current();
      roomUnsubscribeRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearInterval(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    setStatus(newStatus);
    setCurrentMatchRoomId(null);
    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    ongoingOperationRef.current = false;
    hasNavigatedRef.current = false; // Yönlendirme bayrağını da sıfırla
  }, []);


  useEffect(() => {
    // Bu effect, component yüklendiğinde veya currentUser değiştiğinde çalışır.
    // Mevcut bir 1v1 oturumu var mı diye kontrol eder veya durum değişikliklerine göre yönlendirme yapar.
    if (!currentUser || ongoingOperationRef.current || hasNavigatedRef.current) return;

    if (status === "matched" && currentMatchRoomId) {
      hasNavigatedRef.current = true;
      router.push(`/random-chat/${currentMatchRoomId}`);
      return;
    }

    if (status === "waiting_for_opponent" && currentMatchRoomId) {
      hasNavigatedRef.current = true;
      router.push(`/random-chat/${currentMatchRoomId}`);
      return;
    }
    
    if (status === "idle") { // Sadece idle durumundayken mevcut session kontrolü yap
        ongoingOperationRef.current = true;
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
            
            if (existingRoom.status === 'active' && existingRoom.participantUids.length === 2) {
                setCurrentMatchRoomId(existingRoom.id);
                setStatus("matched"); // Bu useEffect'in bir sonraki çalışmasında yönlendirecek
                return;
            } else if (existingRoom.status === 'waiting' && existingRoom.participantUids.length === 1 && existingRoom.participantUids[0] === currentUser.uid) {
                setCurrentMatchRoomId(existingRoom.id);
                setStatus("waiting_for_opponent"); // Bu useEffect'in bir sonraki çalışmasında yönlendirecek
                return;
            } else {
                if (existingRoom.status === 'waiting' && existingRoom.participantUids[0] === currentUser.uid) {
                    await deleteDoc(doc(db, "oneOnOneChats", existingRoom.id)).catch(e => console.warn("Failed to cleanup stale waiting room:", e));
                }
                resetMatchmakingState("idle"); 
            }
            }
        } catch (error) {
            console.error("Error checking existing session:", error);
            toast({ title: "Hata", description: "Mevcut oturum kontrol edilirken bir sorun oluştu.", variant: "destructive" });
            resetMatchmakingState("error");
        } finally {
            ongoingOperationRef.current = false;
        }
        };
        checkExistingSession();
    }
  }, [currentUser, status, currentMatchRoomId, router, resetMatchmakingState, toast]);


  useEffect(() => {
    // Bu effect, kullanıcının kendi oluşturduğu ve beklemede olan oda için timeout ve dinleyici yönetir.
    // Ancak, idealde kullanıcı bu sayfada "waiting_for_opponent" durumunda uzun süre kalmamalı,
    // /random-chat sayfasına yönlendirilmeli. Bu, bir fallback gibi düşünülebilir.
    if (status !== "waiting_for_opponent" || !currentMatchRoomId || !currentUser || hasNavigatedRef.current) {
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
      roomUnsubscribeRef.current = null;
      timeoutTimerRef.current = null;
      return;
    }
    
    const roomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
    roomUnsubscribeRef.current = onSnapshot(roomRef, (docSnap) => {
      if (ongoingOperationRef.current || hasNavigatedRef.current) return;

      if (docSnap.exists()) {
        const roomData = docSnap.data() as OneOnOneChatRoom;
        if (roomData.status === "active" && roomData.participantUids.length === 2) {
          // Oda aktif oldu, yönlendirme için status'u güncelle
          setStatus("matched");
        } else if (roomData.status !== "waiting" || roomData.participantUids[0] !== currentUser.uid) {
          // Oda artık bu kullanıcı için geçerli bir bekleme odası değil
          resetMatchmakingState("idle");
        }
      } else {
        resetMatchmakingState("idle");
      }
    }, (error) => {
      console.error("Error listening to own waiting room on matchmaking page:", error);
      resetMatchmakingState("error");
    });

    setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
    timeoutTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timeoutTimerRef.current!);
          timeoutTimerRef.current = null;
          if (status === "waiting_for_opponent" && currentMatchRoomId && !hasNavigatedRef.current) { 
            ongoingOperationRef.current = true;
            const waitingRoomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
            getDoc(waitingRoomRef).then(docSnap => {
              if (docSnap.exists() && docSnap.data()?.status === 'waiting' && docSnap.data()?.participantUids[0] === currentUser?.uid) {
                return deleteDoc(waitingRoomRef);
              }
            }).then(() => {
              toast({ title: "Eşleşme Bulunamadı", description: "Belirlenen sürede eşleşme bulunamadı.", variant: "destructive" });
              resetMatchmakingState("timeout");
            }).catch(e => {
              console.error("Error deleting timed out room: ", e);
              resetMatchmakingState("error");
            }).finally(() => {
                ongoingOperationRef.current = false;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (roomUnsubscribeRef.current) roomUnsubscribeRef.current();
      if (timeoutTimerRef.current) clearInterval(timeoutTimerRef.current);
    };
  }, [status, currentMatchRoomId, currentUser, resetMatchmakingState, toast]);


  const findOrCreateMatch = useCallback(async () => {
    if (!currentUser || !userData || ongoingOperationRef.current || !["idle", "timeout", "cancelled", "error"].includes(status)) {
        return;
    }

    ongoingOperationRef.current = true;
    setStatus("searching");
    hasNavigatedRef.current = false;

    try {
      const q = query(
        collection(db, "oneOnOneChats"),
        where("status", "==", "waiting"),
        limit(10) 
      );
      const querySnapshot = await getDocs(q);
      let joinedRoomId: string | null = null;

      if (!querySnapshot.empty) {
        for (const waitingRoomDoc of querySnapshot.docs) {
          const waitingRoomData = waitingRoomDoc.data() as Omit<OneOnOneChatRoom, 'id'>;
          if (waitingRoomData.participantUids[0] !== currentUser.uid && waitingRoomData.participantUids.length === 1) {
            joinedRoomId = waitingRoomDoc.id;
            const roomRef = doc(db, "oneOnOneChats", joinedRoomId);
            
            const batch = writeBatch(db);
            batch.update(roomRef, {
              participantUids: [waitingRoomData.participantUids[0], currentUser.uid],
              [`participantsData.${currentUser.uid}`]: {
                uid: currentUser.uid,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                decision: "pending",
                hasLeft: false,
              } as ParticipantData,
              status: "active",
            });
            // Karşı tarafın decision'ını da pending olarak başlatalım
             batch.update(roomRef, {
                [`participantsData.${waitingRoomData.participantUids[0]}.decision`]: "pending",
             });


            await batch.commit();
            setCurrentMatchRoomId(joinedRoomId);
            setStatus("matched"); // useEffect yönlendirecek
            ongoingOperationRef.current = false;
            return; 
          }
        }
      }
      
      const newRoomRef = await addDoc(collection(db, "oneOnOneChats"), {
        participantUids: [currentUser.uid],
        participantsData: {
          [currentUser.uid]: {
            uid: currentUser.uid,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            decision: "pending",
            hasLeft: false,
          } as ParticipantData,
        },
        status: "waiting",
        createdAt: serverTimestamp(),
      });
      setCurrentMatchRoomId(newRoomRef.id);
      setStatus("waiting_for_opponent"); // useEffect yönlendirecek
    } catch (error) {
      console.error("Error finding or creating match:", error);
      toast({ title: "Eşleşme Hatası", description: "Eşleşme sırasında bir sorun oluştu.", variant: "destructive" });
      resetMatchmakingState("error"); 
    } finally {
      ongoingOperationRef.current = false;
    }
  }, [currentUser, userData, status, toast, resetMatchmakingState]);

  const cancelMatchmaking = async () => {
    if (ongoingOperationRef.current && status !== "waiting_for_opponent") return; 
    
    const roomIdToCancel = currentMatchRoomId; 
    const currentStatus = status;
    
    resetMatchmakingState("cancelled"); 

    if (roomIdToCancel && (currentStatus === "waiting_for_opponent" || currentStatus === "searching" /* Eğer ararken iptal edilirse */ )) {
      ongoingOperationRef.current = true;
      try {
        const roomRef = doc(db, "oneOnOneChats", roomIdToCancel);
        const roomSnap = await getDoc(roomRef);
        // Sadece kendi oluşturduğu bekleme odasını silsin
        if (roomSnap.exists() && roomSnap.data()?.status === 'waiting' && roomSnap.data()?.participantUids[0] === currentUser?.uid) {
          await deleteDoc(roomRef);
        }
        toast({ title: "Eşleşme İptal Edildi", description: "Eşleşme arayışınız iptal edildi." });
      } catch (error) {
        console.error("Error cancelling matchmaking (deleting room):", error);
        // Toast'ı resetMatchmakingState zaten "cancelled" olarak ayarladığı için tekrar göstermeye gerek yok
      } finally {
        ongoingOperationRef.current = false;
         // İptal sonrası kullanıcıyı idle durumuna hemen döndürmek yerine cancelled'da bırakıp useEffect ile idle'a dönmesini bekleyebiliriz.
         // Veya burada kısa bir timeout sonrası idle'a çekebiliriz. Şimdilik reset'in içinde bu hallediliyor.
      }
    }
    // Kullanıcıyı hemen idle'a döndürmek için, eğer reset içinde yapılmıyorsa
    // setTimeout(() => { if(status === "cancelled") resetMatchmakingState("idle"); }, 1000);
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

          {(status === "searching" || status === "waiting_for_opponent") && !hasNavigatedRef.current && (
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
          
          {(status === "matched" || status === "waiting_for_opponent") && hasNavigatedRef.current && (
             <div className="space-y-3">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Sohbete yönlendiriliyorsunuz...</p>
             </div>
          )}


           {(status === "error" || status === "cancelled" || status === "timeout") && (
            <div className="space-y-3">
                <p className={`font-semibold ${status === "error" || status === "timeout" ? "text-destructive" : "text-muted-foreground"}`}>
                    {status === "error" && "Bir hata oluştu. Lütfen tekrar deneyin."}
                    {status === "cancelled" && "Eşleşme arayışı iptal edildi."}
                    {status === "timeout" && "Uygun eşleşme bulunamadı."}
                </p>
                <Button size="lg" className="w-full" onClick={() => { resetMatchmakingState("idle"); findOrCreateMatch(); }} disabled={ongoingOperationRef.current || isUserLoading}>
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
    

    