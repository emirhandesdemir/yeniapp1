
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Users, AlertTriangle, SendHorizontal, Search, Phone, Star, UserPlus } from "lucide-react";
import { useAuth, type UserData, checkUserPremium } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, Timestamp, doc, getDoc, setDoc, serverTimestamp, getDocs, updateDoc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateDmChatId, cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DirectMessageConversation {
  id: string; 
  participantUids: string[];
  participantInfo: {
    [key: string]: {
      displayName: string | null;
      photoURL: string | null;
      isPremium?: boolean;
    }
  };
  lastMessageTimestamp: Timestamp | null;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  otherParticipant?: UserData; 
  unreadCount?: number;
}

const listItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.4,
      ease: "easeOut",
    },
  }),
};

const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.05,
    },
  },
};


export default function DirectMessagesPage() {
  const { currentUser, userData, isUserLoading: isAuthLoading, isCurrentUserPremium } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<DirectMessageConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [performingCallAction, setPerformingCallAction] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Direkt Mesajlar - HiweWalk';
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!currentUser?.uid || isAuthLoading) {
      if (!isAuthLoading) setLoadingConversations(false);
      return;
    }

    setLoadingConversations(true);
    try {
      const dmQuery = query(
        collection(db, "directMessages"),
        where("participantUids", "array-contains", currentUser.uid),
        orderBy("lastMessageTimestamp", "desc")
      );
      
      const unsubscribe = onSnapshot(dmQuery, async (snapshot) => {
        if (snapshot.empty) {
          setConversations([]);
          setLoadingConversations(false); 
          return;
        }

        const convPromises = snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data() as DirectMessageConversation;
          data.id = docSnapshot.id;

          const otherUid = data.participantUids.find(uid => uid !== currentUser.uid);
          let otherParticipantData: UserData | undefined;

          if (otherUid && data.participantInfo && data.participantInfo[otherUid]) {
              otherParticipantData = {
                  uid: otherUid,
                  displayName: data.participantInfo[otherUid].displayName,
                  photoURL: data.participantInfo[otherUid].photoURL,
                  isPremium: data.participantInfo[otherUid].isPremium || false,
                  email: null, 
                  diamonds: 0, 
                  createdAt: Timestamp.now(), 
              };
          } else if (otherUid) {
              try {
                  const userDocRef = doc(db, "users", otherUid);
                  const userSnap = await getDoc(userDocRef);
                  if (userSnap.exists()) {
                      otherParticipantData = { uid: userSnap.id, ...userSnap.data() } as UserData;
                      otherParticipantData.isPremium = checkUserPremium(otherParticipantData);
                  }
              } catch (error) {
                  console.error("Error fetching other participant details:", error);
              }
          }

          return { ...data, otherParticipant: otherParticipantData };
        });

        const resolvedConversations = (await Promise.all(convPromises))
            .filter(conv => conv.otherParticipant !== undefined) as DirectMessageConversation[];
        setConversations(resolvedConversations);
        setLoadingConversations(false); 
      }, (error) => {
        console.error("Error fetching DM conversations with onSnapshot:", error);
        toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive"});
        setLoadingConversations(false);
      });

      return unsubscribe; 

    } catch (error) { 
        console.error("Error setting up DM conversations listener:", error);
        toast({ title: "Hata", description: "Mesajlar dinlenirken bir sorun oluştu.", variant: "destructive"});
        setLoadingConversations(false);
    }
  }, [currentUser?.uid, isAuthLoading, toast]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const setupListener = async () => {
        const unsub = await fetchConversations();
        if (typeof unsub === 'function') {
            unsubscribe = unsub;
        }
    }
    setupListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchConversations]);


  const getAvatarFallback = useCallback((name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "PN";
  }, []);

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) {
      return conversations;
    }
    return conversations.filter(conv =>
      conv.otherParticipant?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [conversations, searchTerm]);

  const handleInitiateCall = useCallback(async (targetDmConv: DirectMessageConversation) => {
    if (!currentUser || !userData || !targetDmConv.otherParticipant) {
      toast({ title: "Hata", description: "Arama başlatılamadı. Kullanıcı bilgileri eksik.", variant: "destructive" });
      return;
    }
    setPerformingCallAction(targetDmConv.id);
    const callId = doc(collection(db, "directCalls")).id;
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();

    try {
      const callDocRef = doc(db, "directCalls", callId);
      await setDoc(callDocRef, {
        callId: callId,
        callerId: currentUser.uid,
        callerName: userData.displayName,
        callerAvatar: userData.photoURL,
        callerIsPremium: currentUserIsCurrentlyPremium, 
        calleeId: targetDmConv.otherParticipant.uid,
        calleeName: targetDmConv.otherParticipant.displayName,
        calleeAvatar: targetDmConv.otherParticipant.photoURL,
        calleeIsPremium: targetDmConv.otherParticipant.isPremium, 
        status: "initiating",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Arama Başlatılıyor...", description: `${targetDmConv.otherParticipant.displayName || 'Kullanıcı'} aranıyor.` });
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error("Error initiating call from DM list:", error);
      toast({ title: "Arama Hatası", description: "Arama başlatılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setPerformingCallAction(null);
    }
  }, [currentUser, userData, router, toast, isCurrentUserPremium]);


  if (isAuthLoading && !currentUser) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground">Kullanıcı Bilgileri Yükleniyor</h2>
        <p className="text-muted-foreground mt-2">Lütfen bekleyin...</p>
      </div>
    );
  }

  if (!currentUser && !isAuthLoading) {
     return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md text-center p-6 shadow-xl rounded-xl bg-card/90">
            <CardHeader>
                <Users className="mx-auto h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl font-semibold">Giriş Gerekli</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Mesajlarınızı görmek için lütfen <Link href="/login?redirect=/direct-messages" className="text-primary hover:underline font-medium">giriş yapın</Link>.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-xl border-border/40 bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/15 dark:bg-primary/20 rounded-lg">
                    <SendHorizontal className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-headline text-foreground">Direkt Mesajlar</CardTitle>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Sohbetleri ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 rounded-md bg-background/70 dark:bg-background/50 focus:bg-background"
                />
                </div>
                <Button asChild variant="outline" size="icon" className="h-9 w-9 flex-shrink-0 rounded-md border-primary/60 text-primary hover:bg-primary/10 hover:border-primary">
                    <Link href="/friends" aria-label="Arkadaş Bul">
                        <UserPlus className="h-5 w-5"/>
                    </Link>
                </Button>
            </div>
          </div>
          <CardDescription className="pt-2 text-sm text-muted-foreground">Arkadaşlarınızla olan özel yazışmalarınız burada listelenir.</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-3 pb-3">
          {loadingConversations && conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Mesajlarınız Yükleniyor</p>
              <p className="text-sm text-muted-foreground">Lütfen sabırla bekleyiniz...</p>
            </div>
          ) : conversations.length === 0 ? (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
            >
              <MessageSquare className="mx-auto h-20 w-20 text-primary/60 mb-6" />
              <p className="text-xl font-semibold text-foreground mb-2">Henüz Direkt Mesajınız Yok</p>
              <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                <Link href="/friends" className="text-primary hover:underline font-medium">Arkadaşlarınızla</Link> sohbet etmeye başlayarak burayı canlandırın!
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-3 text-base shadow-md hover:shadow-lg transition-shadow">
                <Link href="/friends"><UserPlus className="mr-2 h-5 w-5"/> Arkadaş Bul</Link>
              </Button>
            </motion.div>
          ) : searchTerm && filteredConversations.length === 0 ? (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
            >
              <Search className="mx-auto h-20 w-20 text-muted-foreground/50 mb-6" />
              <p className="text-xl font-semibold text-muted-foreground mb-2">Arama Sonucu Bulunamadı</p>
              <p className="text-sm text-muted-foreground">
                Farklı bir anahtar kelimeyle tekrar deneyin veya tüm sohbetlerinize geri dönün.
              </p>
            </motion.div>
          ) : (
            <motion.ul 
                className="space-y-2 sm:space-y-3"
                variants={cardContainerVariants}
                initial="hidden"
                animate="visible"
            >
              {filteredConversations.map((conv, index) => {
                const otherParticipant = conv.otherParticipant;
                if (!otherParticipant) return null;

                const lastMessagePrefix = conv.lastMessageSenderId === currentUser?.uid ? "Siz: " : "";

                return (
                  <motion.li 
                    key={conv.id}
                    custom={index}
                    variants={listItemVariants}
                  >
                    <div className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/30 dark:hover:bg-secondary/20 rounded-xl shadow-sm border border-border/40 hover:border-primary/50 dark:hover:border-primary/60 transition-all duration-200 ease-out group transform hover:scale-[1.015]">
                      <Link href={`/dm/${conv.id}`} className="flex items-center gap-3 min-w-0 flex-grow">
                        <div className="relative">
                            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-transparent group-hover:border-primary/40 transition-colors duration-200 rounded-full">
                            <AvatarImage src={otherParticipant.photoURL || `https://placehold.co/48x48.png`} data-ai-hint="person avatar dm list"/>
                            <AvatarFallback className="rounded-full">{getAvatarFallback(otherParticipant.displayName)}</AvatarFallback>
                            </Avatar>
                            {otherParticipant.isPremium && <Star className="absolute bottom-0 -right-1 h-4 w-4 text-yellow-400 fill-yellow-400 bg-card p-0.5 rounded-full shadow-md" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate text-foreground group-hover:text-primary transition-colors">
                            {otherParticipant.displayName || "Bilinmeyen Kullanıcı"}
                          </p>
                          {conv.lastMessageText && (
                              <p className="text-xs sm:text-sm text-muted-foreground truncate group-hover:text-foreground/80 transition-colors">
                                  {lastMessagePrefix}{conv.lastMessageText}
                              </p>
                          )}
                        </div>
                      </Link>
                      <div className="flex items-center flex-shrink-0 ml-2 space-x-1">
                        {conv.lastMessageTimestamp && (
                           <div className="text-[10px] sm:text-xs text-muted-foreground/80 whitespace-nowrap mr-1.5 hidden sm:block group-hover:text-foreground/70 transition-colors">
                            {formatDistanceToNow(conv.lastMessageTimestamp.toDate(), { addSuffix: true, locale: tr })}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-9 sm:w-9 text-green-500 hover:text-green-600 hover:bg-green-500/10 rounded-full transition-transform group-hover:scale-110"
                          onClick={() => handleInitiateCall(conv)}
                          disabled={performingCallAction === conv.id || isAuthLoading}
                          aria-label="Sesli Ara"
                        >
                          {performingCallAction === conv.id ? (
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin"/>
                          ) : (
                            <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

