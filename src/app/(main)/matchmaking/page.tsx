
"use client";

import { useEffect, useState } from "react";
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
  writeBatch
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

const MATCHMAKING_TIMEOUT_SECONDS = 30; // 30 saniye bekleme süresi

export default function MatchmakingPage() {
  const { currentUser, userData, isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "searching" | "waiting_for_opponent" | "matched" | "error" | "cancelled" | "timeout">(
    "idle"
  );
  const [currentMatchRoomId, setCurrentMatchRoomId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(MATCHMAKING_TIMEOUT_SECONDS);

  // Kullanıcının mevcut bir 'waiting' odası var mı diye kontrol et
  useEffect(() => {
    if (!currentUser || status !== "idle") return;

    const checkExistingSession = async () => {
        const q = query(
            collection(db, "oneOnOneChats"),
            where("participantUids", "array-contains", currentUser.uid),
            where("status", "in", ["waiting", "active"]) // Sadece bekleyen veya aktif odaları kontrol et
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const existingRoom = snapshot.docs[0].data() as Omit<OneOnOneChat, 'id'>;
            const roomId = snapshot.docs[0].id;
            if (existingRoom.status === 'waiting' && existingRoom.participantUids.length === 1 && existingRoom.participantUids[0] === currentUser.uid) {
                // Kullanıcı zaten bir oda oluşturmuş ve bekliyor
                setCurrentMatchRoomId(roomId);
                setStatus("waiting_for_opponent");
            } else if (existingRoom.status === 'active' && existingRoom.participantUids.length === 2) {
                // Kullanıcı zaten aktif bir 1v1 sohbette
                router.replace(`/random-chat/${roomId}`);
                return;
            }
        }
    };
    checkExistingSession();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentUser, status, router]);


  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timer: NodeJS.Timeout | undefined;

    if (status === "waiting_for_opponent" && currentMatchRoomId) {
      const roomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
      unsubscribe = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
          const roomData = docSnap.data() as OneOnOneChat;
          if (roomData.status === "active" && roomData.participantUids.length === 2) {
            setStatus("matched");
            toast({ title: "Eşleşme Bulundu!", description: "Sohbete yönlendiriliyorsunuz..." });
            router.push(`/random-chat/${currentMatchRoomId}`);
          } else if (roomData.status === 'closed') {
             setStatus("error");
             toast({ title: "Eşleşme Hatası", description: "Oda beklenmedik bir şekilde kapandı.", variant: "destructive" });
             setCurrentMatchRoomId(null);
          }
        } else {
            // Oda silinmişse (belki timeout ile başka bir client sildi)
            setStatus("timeout");
            toast({ title: "Eşleşme Zaman Aşımı", description: "Eşleşme bulunamadı ve bekleme odanız kapatıldı.", variant: "destructive" });
            setCurrentMatchRoomId(null);
        }
      });

      // Eşleşme zaman aşımı sayacı
      setCountdown(MATCHMAKING_TIMEOUT_SECONDS);
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Zaman aşımı gerçekleşti, odayı sil ve durumu güncelle
            if (currentMatchRoomId) {
                const waitingRoomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
                getDoc(waitingRoomRef).then(docSnap => {
                    if (docSnap.exists() && docSnap.data()?.status === 'waiting') {
                        deleteDoc(waitingRoomRef).catch(e => console.error("Error deleting timed out room: ", e));
                    }
                });
            }
            setStatus("timeout");
            toast({ title: "Eşleşme Bulunamadı", description: "Belirlenen sürede eşleşme bulunamadı. Tekrar deneyebilirsiniz.", variant: "destructive" });
            setCurrentMatchRoomId(null); // Oda ID'sini temizle
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } else if (status === "searching") {
        // 'searching' durumunda herhangi bir timer veya listener yok, doğrudan findOrCreateMatch çağrılır.
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [status, currentMatchRoomId, router, toast]);

  const findOrCreateMatch = async () => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Eşleşme bulmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    setStatus("searching");

    try {
      const q = query(
        collection(db, "oneOnOneChats"),
        where("status", "==", "waiting"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const waitingRoomDoc = querySnapshot.docs[0];
        const waitingRoomData = waitingRoomDoc.data() as Omit<OneOnOneChat, 'id'>;

        // Kendisiyle eşleşmesini engelle
        if (waitingRoomData.participantUids[0] === currentUser.uid) {
          // Bu aslında kullanıcının zaten bir 'waiting' odası olduğu anlamına gelir.
          // Yukarıdaki useEffect bu durumu yakalamalıydı.
          // Güvenlik için, yeni bir oda oluşturmasına izin verelim, eskiyi timeout silebilir.
           createNewMatchRoom();
          return;
        }
        
        setCurrentMatchRoomId(waitingRoomDoc.id);
        const roomRef = doc(db, "oneOnOneChats", waitingRoomDoc.id);
        await updateDoc(roomRef, {
          participantUids: [...waitingRoomData.participantUids, currentUser.uid],
          [`participantsData.${currentUser.uid}`]: {
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            decision: "pending",
            hasLeft: false,
          },
          status: "active",
        });
        setStatus("matched"); // Bu durum onSnapshot tarafından yakalanıp yönlendirme yapacak.
      } else {
        await createNewMatchRoom();
      }
    } catch (error) {
      console.error("Error finding or creating match:", error);
      toast({ title: "Eşleşme Hatası", description: "Eşleşme sırasında bir sorun oluştu.", variant: "destructive" });
      setStatus("error");
    }
  };

  const createNewMatchRoom = async () => {
    if (!currentUser || !userData) return; // Zaten findOrCreateMatch'te kontrol edildi.
    try {
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
        console.error("Error creating new match room:", error);
        toast({ title: "Oda Oluşturma Hatası", description: "Eşleşme odası oluşturulurken bir sorun oluştu.", variant: "destructive" });
        setStatus("error");
    }
  };

  const cancelMatchmaking = async () => {
    setStatus("cancelled");
    if (currentMatchRoomId) {
      try {
        // Sadece 'waiting' durumundaki odayı sil, 'active' durumdaysa zaten eşleşmiş demektir.
        const roomRef = doc(db, "oneOnOneChats", currentMatchRoomId);
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
    setCurrentMatchRoomId(null);
  };

  if (isUserLoading || !currentUser) {
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
            <Button size="lg" className="w-full animate-subtle-pulse" onClick={findOrCreateMatch}>
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
              <Button variant="outline" className="w-full" onClick={cancelMatchmaking}>
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
                <Button size="lg" className="w-full" onClick={() => { setStatus("idle"); setCurrentMatchRoomId(null); findOrCreateMatch(); }}>
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
