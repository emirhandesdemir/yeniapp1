
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Users, Zap, MessageSquareHeart, Shuffle, XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuth, type UserData, checkUserPremium } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  setDoc,
  updateDoc,
  runTransaction,
  getDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { generateDmChatId } from "@/lib/utils";
import { addMinutes, isPast } from 'date-fns';

type SearchState = 'idle' | 'searching' | 'matched' | 'cancelled' | 'error';

interface MatchmakingQueueEntry {
  userId: string;
  displayName: string | null;
  photoURL: string | null;
  gender?: 'kadın' | 'erkek' | 'belirtilmemiş';
  joinedAt: Timestamp;
  status: 'waiting' | 'matched' | 'cancelled';
  matchedWithUserId?: string | null;
  temporaryDmChatId?: string | null;
  matchSessionExpiresAt?: Timestamp | null;
}

export default function MatchPage() {
  const [searchState, _setSearchState] = useState<SearchState>("idle");
  const searchStateRef = useRef(searchState);
  const setSearchState = (data: SearchState) => {
    searchStateRef.current = data;
    _setSearchState(data);
  };

  const [statusMessage, _setStatusMessage] = useState("Uygun bir sohbet partneri bulmak için butona tıkla.");
  const statusMessageRef = useRef(statusMessage);
  const setStatusMessage = (data: string) => {
    statusMessageRef.current = data;
    _setStatusMessage(data);
  };
  
  const [queueDocId, _setQueueDocId] = useState<string | null>(null);
  const queueDocIdRef = useRef(queueDocId);
  const setQueueDocId = (data: string | null) => {
    queueDocIdRef.current = data;
    _setQueueDocId(data);
  };

  const [errorMessage, _setErrorMessage] = useState<string | null>(null);
  const errorMessageRef = useRef(errorMessage);
  const setErrorMessage = (data: string | null) => {
    errorMessageRef.current = data;
    _setErrorMessage(data);
  };


  const { currentUser, userData, isUserLoading: authLoading, isUserDataLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const unsubscribeQueueListenerRef = useRef<() => void | null>(null);

  useEffect(() => {
    document.title = "Rastgele Eşleşme - HiweWalk";
  }, []);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace("/login?redirect=/match");
    }
  }, [currentUser, authLoading, router]);

  const cleanupListenerAndDoc = useCallback(async (currentQueueId: string | null, reason?: string) => {
    if (unsubscribeQueueListenerRef.current) {
      unsubscribeQueueListenerRef.current();
      unsubscribeQueueListenerRef.current = null;
    }
    if (currentQueueId) {
      const docRef = doc(db, "matchmakingQueue", currentQueueId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          await deleteDoc(docRef);
        }
      } catch (e) {
        console.warn(`Error deleting queue doc ${currentQueueId} on cleanup (Reason: ${reason}):`, e);
      }
    }
  }, []);
  
  const resetSearch = useCallback((message?: string) => {
    cleanupListenerAndDoc(queueDocIdRef.current, `resetSearch: ${message || 'general reset'}`);
    setQueueDocId(null); 
    setSearchState("idle");
    setStatusMessage(message || "Uygun bir sohbet partneri bulmak için butona tıkla.");
    setErrorMessage(null);
  }, [cleanupListenerAndDoc]);


  useEffect(() => {
    const currentQueueDocIdForCleanup = queueDocIdRef.current;
    const currentSearchStateForCleanup = searchStateRef.current;

    return () => {
      if (unsubscribeQueueListenerRef.current) {
        unsubscribeQueueListenerRef.current();
        unsubscribeQueueListenerRef.current = null;
      }
      if (currentQueueDocIdForCleanup && (currentSearchStateForCleanup === 'searching' || currentSearchStateForCleanup === 'idle')) {
        const docRef = doc(db, "matchmakingQueue", currentQueueDocIdForCleanup);
        deleteDoc(docRef).catch(e => console.warn("[MatchPage Unmount] Error cleaning up queue on unmount (best effort):", e));
      }
    };
  }, []);


  const handleStartSearch = useCallback(async () => {
    if (!currentUser || !userData) {
      toast({ title: "Hata", description: "Eşleşme başlatılamadı. Lütfen giriş yapın.", variant: "destructive" });
      return;
    }
    if (searchStateRef.current === 'searching') return;

    await cleanupListenerAndDoc(queueDocIdRef.current, "new search initiated by user");
    setQueueDocId(null); 

    setSearchState("searching");
    setStatusMessage("Sizin için uygun bir sohbet partneri aranıyor...");
    setErrorMessage(null);

    let currentAttemptQueueId: string | null = null;

    try {
      const queueEntry: Omit<MatchmakingQueueEntry, 'joinedAt'> & { joinedAt: any } = {
        userId: currentUser.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        gender: userData.gender || 'belirtilmemiş',
        status: 'waiting',
        joinedAt: serverTimestamp(),
      };
      const newQueueDocRef = await addDoc(collection(db, "matchmakingQueue"), queueEntry);
      currentAttemptQueueId = newQueueDocRef.id;
      setQueueDocId(currentAttemptQueueId);

      const userGender = userData.gender || 'belirtilmemiş';
      const preferredGender = userGender === 'erkek' ? 'kadın' : 'erkek';
      
      let matchedPartner: MatchmakingQueueEntry | null = null;
      let matchedPartnerDocRef: any = null;

      // 1. Try to find preferred gender match
      if (userGender !== 'belirtilmemiş') {
        const qPreferred = query(
          collection(db, "matchmakingQueue"),
          where("status", "==", "waiting"),
          where("userId", "!=", currentUser.uid), 
          where("gender", "==", preferredGender),
          orderBy("joinedAt", "asc"),
          limit(1) 
        );
        const preferredSnapshot = await getDocs(qPreferred);
        if (!preferredSnapshot.empty) {
            const doc = preferredSnapshot.docs[0];
            matchedPartner = { ...doc.data(), id: doc.id } as MatchmakingQueueEntry;
            matchedPartnerDocRef = doc.ref;
        }
      }

      // 2. If no preferred match, find anyone (including same gender)
      if (!matchedPartner) {
         const qAny = query(
          collection(db, "matchmakingQueue"),
          where("status", "==", "waiting"),
          where("userId", "!=", currentUser.uid), 
          orderBy("joinedAt", "asc"),
          limit(1) 
        );
        const anySnapshot = await getDocs(qAny);
         if (!anySnapshot.empty) {
            const doc = anySnapshot.docs[0];
            matchedPartner = { ...doc.data(), id: doc.id } as MatchmakingQueueEntry;
            matchedPartnerDocRef = doc.ref;
        }
      }

      if (matchedPartner && matchedPartnerDocRef && currentAttemptQueueId) {
        const temporaryDmChatId = generateDmChatId(currentUser.uid, matchedPartner.userId);
        const sessionExpiresAt = Timestamp.fromDate(addMinutes(new Date(), 4));

        await runTransaction(db, async (transaction) => {
          const myQueueDocInTransaction = await transaction.get(newQueueDocRef); 
          const otherUserQueueDocInTransaction = await transaction.get(matchedPartnerDocRef);

          if (!myQueueDocInTransaction.exists() || !otherUserQueueDocInTransaction.exists() ||
              myQueueDocInTransaction.data()?.status !== 'waiting' ||
              otherUserQueueDocInTransaction.data()?.status !== 'waiting') {
            throw new Error("Eşleşme adayı artık uygun değil veya zaten eşleşmiş.");
          }
          
          transaction.update(newQueueDocRef, { 
            status: 'matched',
            matchedWithUserId: matchedPartner!.userId,
            temporaryDmChatId: temporaryDmChatId,
            matchSessionExpiresAt: sessionExpiresAt,
          });
          transaction.update(matchedPartnerDocRef, { 
            status: 'matched',
            matchedWithUserId: currentUser.uid,
            temporaryDmChatId: temporaryDmChatId,
            matchSessionExpiresAt: sessionExpiresAt,
          });
        });
        
        const dmDocRef = doc(db, "directMessages", temporaryDmChatId);
        const otherUserProfile = await getDoc(doc(db, "users", matchedPartner.userId));
        let otherProfileData = { displayName: matchedPartner.displayName, photoURL: matchedPartner.photoURL, isPremium: false };
        if(otherUserProfile.exists()){
            const opData = otherUserProfile.data();
            otherProfileData.displayName = opData.displayName || matchedPartner.displayName;
            otherProfileData.photoURL = opData.photoURL || matchedPartner.photoURL;
            otherProfileData.isPremium = checkUserPremium(opData as UserData);
        }

        await setDoc(dmDocRef, {
            participantUids: [currentUser.uid, matchedPartner.userId].sort(),
            participantInfo: {
                [currentUser.uid]: { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: checkUserPremium(userData) },
                [matchedPartner.userId]: otherProfileData
            },
            createdAt: serverTimestamp(), lastMessageTimestamp: null, isMatchSession: true,
            matchSessionExpiresAt: sessionExpiresAt, matchSessionUser1Id: currentUser.uid,
            matchSessionUser2Id: matchedPartner.userId, matchSessionUser1Decision: 'pending',
            matchSessionUser2Decision: 'pending', matchSessionEnded: false,
        });
        
        setStatusMessage(`Partner bulundu: ${matchedPartner.displayName || 'Kullanıcı'}. Geçici sohbete yönlendiriliyorsunuz...`);
        setSearchState("matched");
        
        router.push(`/match/${temporaryDmChatId}`);

        await deleteDoc(newQueueDocRef); 
        setQueueDocId(null); 

      } else if (currentAttemptQueueId) {
        const selfQueueDocRef = doc(db, "matchmakingQueue", currentAttemptQueueId);
        
        if (unsubscribeQueueListenerRef.current) {
          unsubscribeQueueListenerRef.current();
        }

        unsubscribeQueueListenerRef.current = onSnapshot(selfQueueDocRef, async (docSnap) => {
          if (!docSnap.exists()) {
            if (searchStateRef.current !== 'matched' && searchStateRef.current !== 'cancelled') { 
              resetSearch("Eşleşme kaydınız bulunamadı veya beklenmedik şekilde silindi.");
            }
            return;
          }

          const data = docSnap.data() as MatchmakingQueueEntry;
          if (data?.status === 'matched' && data.temporaryDmChatId && data.matchedWithUserId) {
            if (unsubscribeQueueListenerRef.current) {
              unsubscribeQueueListenerRef.current();
              unsubscribeQueueListenerRef.current = null;
            }
            setSearchState("matched"); 
            const otherUserSnap = await getDoc(doc(db, "users", data.matchedWithUserId));
            const otherUserName = otherUserSnap.exists() ? otherUserSnap.data().displayName : "Kullanıcı";
            setStatusMessage(`Partner bulundu: ${otherUserName || 'Kullanıcı'}. Geçici sohbete yönlendiriliyorsunuz...`);
            
            try {
              router.push(`/match/${data.temporaryDmChatId}`);
              await deleteDoc(docSnap.ref); 
              setQueueDocId(null); 
            } catch (delError) {
                console.error(`[Match Listener] Error deleting own queue doc or navigating:`, delError);
                resetSearch("Eşleşme sırasında bir hata oluştu, lütfen tekrar deneyin.");
            }
          }
        }, (error) => {
          setErrorMessage("Eşleşme durumu dinlenirken bir hata oluştu.");
          resetSearch("Bir hata nedeniyle arama durduruldu.");
          setSearchState("error");
        });
      }

    } catch (error: any) {
      setErrorMessage(`Eşleşme sırasında bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
      setSearchState("error");
      if (currentAttemptQueueId) { 
        await deleteDoc(doc(db, "matchmakingQueue", currentAttemptQueueId)).catch(delErr => console.warn("Error cleaning up queue doc after main error:", delErr));
      }
      setQueueDocId(null); 
    }
  }, [currentUser, userData, toast, router, cleanupListenerAndDoc, resetSearch]);


  const handleCancelSearch = useCallback(async () => {
    const idToCancel = queueDocIdRef.current; 
    setSearchState("cancelled");
    setStatusMessage("Eşleşme arama iptal edildi. Tekrar denemek için butona tıkla.");
    setErrorMessage(null);

    if (unsubscribeQueueListenerRef.current) {
      unsubscribeQueueListenerRef.current();
      unsubscribeQueueListenerRef.current = null;
    }
    
    if (idToCancel) {
      try {
        const docRef = doc(db, "matchmakingQueue", idToCancel);
        await deleteDoc(docRef); 
      } catch (error) {
        toast({ title: "Hata", description: "Arama iptal edilirken bir sorun oluştu.", variant: "destructive" });
      }
    }
    setQueueDocId(null); 
  }, [toast]);


  if (authLoading || (currentUser && (isUserDataLoading && !userData)) ) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-semibold text-foreground">Eşleşme Sayfası Yükleniyor</h2>
            <p className="text-muted-foreground mt-2">Lütfen bekleyin...</p>
        </div>
      );
  }
  
  if (!currentUser || !userData) return null; 

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl rounded-xl border-border/40 bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
              className="mx-auto mb-4 p-3 bg-primary/20 rounded-full inline-block"
            >
              <Shuffle className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl sm:text-3xl font-headline text-foreground">
              Rastgele Eşleşme
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground mt-1">
              Yeni insanlarla tanışmak için bir sohbet partneri bul!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground text-sm min-h-[40px] flex items-center justify-center px-4">
              {statusMessage}
            </p>
            {errorMessage && (
                <motion.p 
                    initial={{opacity:0, y:10}} animate={{opacity:1, y:0}}
                    className="text-xs text-destructive bg-destructive/10 p-2 rounded-md"
                >
                    <AlertTriangle className="inline h-4 w-4 mr-1.5" /> {errorMessage}
                </motion.p>
            )}
            
            {searchState === 'idle' || searchState === 'cancelled' || searchState === 'error' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Button
                  onClick={handleStartSearch}
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground rounded-lg py-3 text-base shadow-lg hover:shadow-xl transition-all duration-300 ease-out transform hover:scale-105"
                  disabled={authLoading || isUserDataLoading}
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Sohbet Partneri Bul
                </Button>
              </motion.div>
            ) : searchState === 'searching' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center text-primary">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <Button
                  onClick={handleCancelSearch}
                  variant="outline"
                  size="lg"
                  className="w-full rounded-lg py-3 text-base border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  Aramayı İptal Et
                </Button>
              </motion.div>
            ) : searchState === 'matched' && (
                 <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-center text-green-500">
                        <CheckCircle className="h-10 w-10" />
                    </div>
                     <p className="text-sm text-green-600 font-medium">{statusMessageRef.current}</p>
                </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
