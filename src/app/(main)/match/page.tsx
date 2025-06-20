
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Users, Zap, MessageSquareHeart, Shuffle, XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { generateDmChatId } from "@/lib/utils";

type SearchState = 'idle' | 'searching' | 'matched' | 'cancelled' | 'error';

interface MatchmakingQueueEntry {
  userId: string;
  displayName: string | null;
  photoURL: string | null;
  gender?: 'kadın' | 'erkek' | 'belirtilmemiş';
  joinedAt: Timestamp;
  status: 'waiting' | 'matched' | 'cancelled';
  matchedWithUserId?: string | null;
  dmChatId?: string | null;
}

export default function MatchPage() {
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [statusMessage, setStatusMessage] = useState("Uygun bir sohbet partneri bulmak için butona tıkla.");
  const [queueDocId, setQueueDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (unsubscribeQueueListenerRef.current) {
        unsubscribeQueueListenerRef.current();
      }
      if (queueDocId && searchState === 'searching') {
        // If user navigates away while searching, remove from queue
        const docRef = doc(db, "matchmakingQueue", queueDocId);
        deleteDoc(docRef).catch(e => console.warn("Error cleaning up queue on unmount:", e));
      }
    };
  }, [queueDocId, searchState]);


  const resetSearch = () => {
    if (unsubscribeQueueListenerRef.current) {
      unsubscribeQueueListenerRef.current();
      unsubscribeQueueListenerRef.current = null;
    }
    if (queueDocId) {
        const docRef = doc(db, "matchmakingQueue", queueDocId);
        deleteDoc(docRef).catch(err => console.warn("Failed to delete queue doc on reset:", err));
        setQueueDocId(null);
    }
    setSearchState("idle");
    setStatusMessage("Uygun bir sohbet partneri bulmak için butona tıkla.");
    setErrorMessage(null);
  };


  const handleStartSearch = useCallback(async () => {
    if (!currentUser || !userData) {
      toast({ title: "Hata", description: "Eşleşme başlatılamadı. Lütfen giriş yapın.", variant: "destructive" });
      return;
    }
    if (searchState === 'searching') return;

    setSearchState("searching");
    setStatusMessage("Sizin için uygun bir sohbet partneri aranıyor...");
    setErrorMessage(null);
    if (unsubscribeQueueListenerRef.current) unsubscribeQueueListenerRef.current();

    try {
      // 1. Add current user to the queue
      const queueEntry: Omit<MatchmakingQueueEntry, 'joinedAt'> & { joinedAt: any } = {
        userId: currentUser.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        gender: userData.gender || 'belirtilmemiş',
        status: 'waiting',
        joinedAt: serverTimestamp(),
      };
      const newQueueDocRef = await addDoc(collection(db, "matchmakingQueue"), queueEntry);
      setQueueDocId(newQueueDocRef.id);

      // 2. Try to find an immediate match
      const q = query(
        collection(db, "matchmakingQueue"),
        where("status", "==", "waiting"),
        where("userId", "!=", currentUser.uid), // Exclude self
        orderBy("joinedAt", "asc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const otherUserDoc = querySnapshot.docs[0];
        const otherUserData = otherUserDoc.data() as MatchmakingQueueEntry;

        const dmChatId = generateDmChatId(currentUser.uid, otherUserData.userId);

        // Transaction to match both users
        await runTransaction(db, async (transaction) => {
          const myQueueDocInTransaction = await transaction.get(newQueueDocRef);
          const otherUserQueueDocInTransaction = await transaction.get(otherUserDoc.ref);

          if (!myQueueDocInTransaction.exists() || !otherUserQueueDocInTransaction.exists() || 
              myQueueDocInTransaction.data()?.status !== 'waiting' || 
              otherUserQueueDocInTransaction.data()?.status !== 'waiting') {
            // One of the users is no longer available or waiting
            throw new Error("Eşleşme adayı artık uygun değil.");
          }

          transaction.update(newQueueDocRef, {
            status: 'matched',
            matchedWithUserId: otherUserData.userId,
            dmChatId: dmChatId
          });
          transaction.update(otherUserDoc.ref, {
            status: 'matched',
            matchedWithUserId: currentUser.uid,
            dmChatId: dmChatId
          });
        });

        // Create DM document if it doesn't exist (optional, can be created on first message too)
        const dmDocRef = doc(db, "directMessages", dmChatId);
        const dmDocSnap = await getDoc(dmDocRef);
        if (!dmDocSnap.exists()) {
            const otherUserProfile = await getDoc(doc(db, "users", otherUserData.userId));
            let otherProfileData = { displayName: otherUserData.displayName, photoURL: otherUserData.photoURL, isPremium: false };
            if(otherUserProfile.exists()) {
                const opData = otherUserProfile.data();
                otherProfileData.displayName = opData.displayName || otherUserData.displayName;
                otherProfileData.photoURL = opData.photoURL || otherUserData.photoURL;
                otherProfileData.isPremium = !!(opData.premiumStatus && opData.premiumStatus !== 'none' && (!opData.premiumExpiryDate || !isPast(opData.premiumExpiryDate.toDate())));
            }

            await setDoc(dmDocRef, {
                participantUids: [currentUser.uid, otherUserData.userId].sort(),
                participantInfo: {
                    [currentUser.uid]: { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: !!(userData.premiumStatus && userData.premiumStatus !== 'none' && (!userData.premiumExpiryDate || !isPast(userData.premiumExpiryDate.toDate()))) },
                    [otherUserData.userId]: otherProfileData
                },
                createdAt: serverTimestamp(),
                lastMessageTimestamp: null,
            });
        }


        setStatusMessage(`Partner bulundu: ${otherUserData.displayName || 'Kullanıcı'}. Yönlendiriliyorsunuz...`);
        setSearchState("matched");
        // Listener will pick this up if successful, or if this user got matched by someone else first.
        // For direct match, redirect here:
        router.push(`/dm/${dmChatId}`);
        // Clean up self from queue after redirection or based on listener.
        await deleteDoc(newQueueDocRef);
        setQueueDocId(null);

      } else {
        // No immediate match, set up listener on my queue document
        unsubscribeQueueListenerRef.current = onSnapshot(newQueueDocRef, (docSnap) => {
          const data = docSnap.data();
          if (data?.status === 'matched' && data.dmChatId && data.matchedWithUserId) {
            if (unsubscribeQueueListenerRef.current) unsubscribeQueueListenerRef.current();
            setSearchState("matched");
            setStatusMessage(`Partner bulundu! ${data.matchedWithUserId} ile eşleştin. Yönlendiriliyorsunuz...`);
            router.push(`/dm/${data.dmChatId}`);
            deleteDoc(docSnap.ref).catch(err => console.warn("Error deleting matched queue doc:", err));
            setQueueDocId(null);
          } else if (data?.status === 'cancelled') {
            if (unsubscribeQueueListenerRef.current) unsubscribeQueueListenerRef.current();
            resetSearch(); // Or set to cancelled state
            setStatusMessage("Eşleşme arama iptal edildi (başka bir yerden).");
          } else if (!data) { // Document deleted (e.g. by self cancellation)
            if (unsubscribeQueueListenerRef.current) unsubscribeQueueListenerRef.current();
            // resetSearch() will be called by handleCancelSearch
          }
        }, (error) => {
          console.error("Error listening to queue document:", error);
          setErrorMessage("Eşleşme durumu dinlenirken bir hata oluştu.");
          setSearchState("error");
        });
      }

    } catch (error: any) {
      console.error("Error starting search or matching:", error);
      setErrorMessage(`Eşleşme sırasında bir hata oluştu: ${error.message}`);
      setSearchState("error");
      if (queueDocId) {
        await deleteDoc(doc(db, "matchmakingQueue", queueDocId));
        setQueueDocId(null);
      }
    }
  }, [currentUser, userData, toast, router, searchState, queueDocId]);


  const handleCancelSearch = useCallback(async () => {
    if (unsubscribeQueueListenerRef.current) {
      unsubscribeQueueListenerRef.current();
      unsubscribeQueueListenerRef.current = null;
    }
    if (queueDocId) {
      try {
        await deleteDoc(doc(db, "matchmakingQueue", queueDocId));
        setQueueDocId(null);
      } catch (error) {
        console.error("Error cancelling search (deleting queue doc):", error);
        toast({ title: "Hata", description: "Arama iptal edilirken bir sorun oluştu.", variant: "destructive" });
      }
    }
    setSearchState("cancelled");
    setStatusMessage("Eşleşme arama iptal edildi. Tekrar denemek için butona tıkla.");
    setErrorMessage(null);
  }, [queueDocId, toast]);


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
                     <p className="text-sm text-green-600 font-medium">Eşleşme bulundu, sohbete yönlendiriliyorsunuz!</p>
                </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

