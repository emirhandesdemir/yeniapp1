
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, Compass, PlusCircle, Sparkles, Globe, MessageSquare, Users, Target, Edit3, RefreshCw, Star, Gamepad2, MessageSquarePlus, RadioTower } from "lucide-react";
import { useAuth, checkUserPremium } from '@/contexts/AuthContext';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import CreatePostForm from "@/components/feed/CreatePostForm";
import PostCard, { type Post } from "@/components/feed/PostCard";
import RoomInFeedCard, { type ChatRoomFeedDisplayData as RoomInFeedCardData } from "@/components/feed/RoomInFeedCard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, Timestamp, where, limit, getDocs } from "firebase/firestore";
import { isPast } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


const cardVariants = {
  hidden: { opacity: 0, y: -20, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    marginBottom: '1.5rem',
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 0.5
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.2 } },
};

const buttonsContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const buttonItemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 5 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 12 } },
};

const feedItemEntryVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};


const SCROLL_HIDE_THRESHOLD = 100;
const WELCOME_CARD_SESSION_KEY = 'welcomeCardHiddenPermanently_v1_hiwewalk';
const POSTS_FETCH_LIMIT = 15;
const ROOMS_FETCH_LIMIT = 5;
const REFRESH_BUTTON_TIMER_MS = 1 * 60 * 1000;

export type FeedDisplayItem = (Post & { feedItemType: 'post' }) | (RoomInFeedCardData & { feedItemType: 'room' });


export default function FeedPage() {
  const router = useRouter();
  const { currentUser, userData, loading: authLoading, isUserDataLoading, checkIfUserBlocked } = useAuth();

  const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(true);
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [activeRooms, setActiveRooms] = useState<RoomInFeedCardData[]>([]);
  const [combinedFeedItems, setCombinedFeedItems] = useState<FeedDisplayItem[]>([]);

  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  const [friends, setFriends] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(true);


  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const refreshButtonTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isLoadingPostsRef = useRef(isLoadingPosts);
  const isLoadingRoomsRef = useRef(isLoadingRooms);
  const isRefreshingFeedRef = useRef(isRefreshingFeed);
  useEffect(() => {
    isLoadingPostsRef.current = isLoadingPosts;
    isLoadingRoomsRef.current = isLoadingRooms;
    isRefreshingFeedRef.current = isRefreshingFeed;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPreference = sessionStorage.getItem(WELCOME_CARD_SESSION_KEY);
      if (storedPreference === 'true') {
        setIsWelcomeCardVisible(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isWelcomeCardVisible) return;
    const handleScroll = () => {
      if (window.scrollY > SCROLL_HIDE_THRESHOLD && isWelcomeCardVisible) {
        setIsWelcomeCardVisible(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isWelcomeCardVisible]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  const startRefreshButtonTimer = useCallback(() => {
    if (refreshButtonTimerRef.current) {
      clearTimeout(refreshButtonTimerRef.current);
    }
    refreshButtonTimerRef.current = setTimeout(() => {
      if (!isLoadingPostsRef.current && !isLoadingRoomsRef.current && !isRefreshingFeedRef.current) {
        setShowRefreshButton(true);
      }
    }, REFRESH_BUTTON_TIMER_MS);
  }, []);

  const fetchActiveRooms = useCallback(async (isManualRefresh = false) => {
    if (!currentUser) {
      setActiveRooms([]);
      setIsLoadingRooms(false);
      if (isManualRefresh) setIsRefreshingFeed(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshingFeed(true);
    } else {
      setIsLoadingRooms(true);
    }

    if (isManualRefresh) {
        setShowRefreshButton(false);
        if (refreshButtonTimerRef.current) {
        clearTimeout(refreshButtonTimerRef.current);
        }
    }

    try {
      const now = Timestamp.now();
      const roomsQuery = query(
        collection(db, "chatRooms"),
        where("expiresAt", ">", now),
        orderBy("expiresAt", "asc"),
        limit(ROOMS_FETCH_LIMIT)
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      const fetchedRoomsData: RoomInFeedCardData[] = [];
      roomsSnapshot.forEach((doc) => {
        const roomData = doc.data();
        if (roomData.expiresAt && !isPast(roomData.expiresAt.toDate())) {
          fetchedRoomsData.push({
            id: doc.id,
            name: roomData.name,
            description: roomData.description,
            participantCount: roomData.participantCount,
            maxParticipants: roomData.maxParticipants,
            createdAt: roomData.createdAt as Timestamp,
            isPremiumRoom: roomData.isPremiumRoom || false,
            creatorIsPremium: roomData.creatorIsPremium || false,
            isGameEnabledInRoom: roomData.isGameEnabledInRoom ?? (roomData.gameInitialized ?? false),
            isActive: roomData.isActive || false,
            image: roomData.image,
            imageAiHint: roomData.imageAiHint,
          } as RoomInFeedCardData);
        }
      });
      setActiveRooms(fetchedRoomsData);

    } catch (error) {
      console.error("Error fetching active rooms: ", error);
    } finally {
      setIsLoadingRooms(false);
      if (isManualRefresh) {
        setIsRefreshingFeed(false);
        startRefreshButtonTimer();
      }
    }
  }, [currentUser, startRefreshButtonTimer]);

  const fetchPosts = useCallback(async (isManualRefresh = false) => {
    if (!currentUser) {
      setAllPosts([]);
      setIsLoadingPosts(false);
      if (isManualRefresh) setIsRefreshingFeed(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshingFeed(true);
      setShowRefreshButton(false);
      if (refreshButtonTimerRef.current) {
        clearTimeout(refreshButtonTimerRef.current);
      }
    } else {
      setIsLoadingPosts(true);
    }

    try {
      const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(POSTS_FETCH_LIMIT));
      const snapshot = await getDocs(postsQuery);
      const fetchedPostsData: Post[] = [];
      snapshot.forEach((doc) => {
        fetchedPostsData.push({ id: doc.id, ...doc.data() } as Post);
      });
      setAllPosts(fetchedPostsData);
    } catch (error) {
      console.error("Error fetching posts with getDocs: ", error);
    } finally {
      setIsLoadingPosts(false);
      if (isManualRefresh) {
        setIsRefreshingFeed(false);
        startRefreshButtonTimer();
      }
    }
  }, [currentUser, startRefreshButtonTimer]);


  useEffect(() => {
    if (currentUser) {
      fetchActiveRooms();
      fetchPosts();
      startRefreshButtonTimer();
    } else {
      setIsLoadingRooms(false);
      setActiveRooms([]);
      setIsLoadingPosts(false);
      setAllPosts([]);
    }
  }, [currentUser, fetchActiveRooms, fetchPosts, startRefreshButtonTimer]);


  useEffect(() => {
    if (currentUser) {
      if (userData?.privacySettings?.feedShowsEveryone === false) {
        setLoadingFriends(true);
        const friendsRef = collection(db, `users/${currentUser.uid}/confirmedFriends`);
        getDocs(friendsRef).then(snapshot => {
          const friendIds = snapshot.docs.map(doc => doc.id);
          setFriends(friendIds);
          setLoadingFriends(false);
        }).catch(error => {
          console.error("Error fetching friends for feed:", error);
          setLoadingFriends(false);
        });
      } else {
        setFriends([]);
        setLoadingFriends(false);
      }

      setLoadingBlockedUsers(true);
      const blockedUsersRef = collection(db, `users/${currentUser.uid}/blockedUsers`);
      getDocs(blockedUsersRef).then(snapshot => {
          const ids = snapshot.docs.map(doc => doc.id);
          setBlockedUserIds(ids);
          setLoadingBlockedUsers(false);
      }).catch(error => {
          console.error("Error fetching blocked users:", error);
          setLoadingBlockedUsers(false);
      });

    } else {
      setFriends([]);
      setBlockedUserIds([]);
      setLoadingFriends(false);
      setLoadingBlockedUsers(false);
    }
  }, [currentUser, userData?.privacySettings?.feedShowsEveryone]);


  useEffect(() => {
    const feedShowsEveryone = userData?.privacySettings?.feedShowsEveryone ?? true;

    if (isLoadingPosts || isLoadingRooms || loadingBlockedUsers || (!feedShowsEveryone && loadingFriends)) {
      return;
    }

    let filteredPosts = allPosts;
    if (blockedUserIds && blockedUserIds.length > 0) {
        filteredPosts = filteredPosts.filter(post => !blockedUserIds.includes(post.userId));
    }

    if (!feedShowsEveryone && currentUser) {
      filteredPosts = filteredPosts.filter(post =>
        post.userId === currentUser.uid || friends.includes(post.userId)
      );
    }

    const postItems: FeedDisplayItem[] = filteredPosts.map(p => ({ ...p, feedItemType: 'post' }));
    const roomItems: FeedDisplayItem[] = activeRooms.map(r => ({ ...r, feedItemType: 'room' }));

    const combined = [...postItems, ...roomItems].sort((a, b) => {
        const aIsActive = a.feedItemType === 'room' && (a as RoomInFeedCardData).isActive;
        const bIsActive = b.feedItemType === 'room' && (b as RoomInFeedCardData).isActive;
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        const aIsPremiumContent = (a.feedItemType === 'room' && (a as RoomInFeedCardData).isPremiumRoom) || (a.feedItemType === 'post' && (a as Post).authorIsPremium);
        const bIsPremiumContent = (b.feedItemType === 'room' && (b as RoomInFeedCardData).isPremiumRoom) || (b.feedItemType === 'post' && (b as Post).authorIsPremium);

        if (aIsPremiumContent && !bIsPremiumContent) return -1;
        if (!aIsPremiumContent && bIsPremiumContent) return 1;

        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
    setCombinedFeedItems(combined);

  }, [allPosts, activeRooms, isLoadingPosts, isLoadingRooms, userData?.privacySettings?.feedShowsEveryone, friends, loadingFriends, currentUser, blockedUserIds, loadingBlockedUsers]);

  useEffect(() => {
    return () => {
      if (refreshButtonTimerRef.current) {
        clearTimeout(refreshButtonTimerRef.current);
      }
    };
  }, []);

  const handleRefreshClick = useCallback(() => {
    if (isRefreshingFeedRef.current) return;
    fetchActiveRooms(true);
    fetchPosts(true);
  }, [fetchActiveRooms, fetchPosts]);

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "HW";
  };

  const PageContent = () => {
    if (authLoading || (currentUser && isUserDataLoading && !userData)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
          <div className="mb-6">
            <MessageSquare className="h-20 w-20 text-primary animate-pulse mx-auto" />
          </div>
          <h1 className="text-3xl font-headline font-semibold text-primary mb-3">
            Anasayfanız Hazırlanıyor
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Sizin için en taze bilgileri ve sohbetleri getiriyoruz. Bu işlem birkaç saniye sürebilir...
          </p>
        </div>
      );
    }
  
    if (currentUser && userData) {
      const greetingName = userData?.displayName || currentUser?.displayName || "Kullanıcı";
      const userIsCurrentlyPremium = checkUserPremium(userData);
  
      return (
          <div className="mx-auto max-w-2xl w-full space-y-5">
            <AnimatePresence>
              {isWelcomeCardVisible && (
                <motion.div
                  key="welcome-card"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Card className="shadow-xl bg-card border border-border/30 rounded-xl overflow-hidden">
                    <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-primary/10 via-card to-accent/10 dark:from-primary/20 dark:via-card dark:to-accent/20">
                      <motion.div
                        className="flex items-center gap-3"
                        variants={itemVariants}
                      >
                        <div className="p-2 bg-primary/20 dark:bg-primary/25 rounded-full">
                          <Target className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-semibold text-foreground">
                            Merhaba, {greetingName}!
                            {userIsCurrentlyPremium && <Star className="inline h-5 w-5 ml-1.5 text-yellow-400" />}
                          </CardTitle>
                          <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            Topluluğa hoş geldin. Yeni keşifler seni bekliyor!
                          </CardDescription>
                        </div>
                      </motion.div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5">
                      <motion.div
                        className="flex items-center gap-2 text-sm text-muted-foreground mb-3 sm:mb-4"
                        variants={itemVariants}
                      >
                        <Gem className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                        <span className="font-medium text-foreground">Elmasların: {userData?.diamonds ?? 0}</span>
                      </motion.div>
                      <motion.div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
                        variants={buttonsContainerVariants}
                      >
                        <motion.div variants={buttonItemVariants}>
                          <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2.5 text-xs sm:text-sm">
                            <Link href="/chat">
                              <Compass className="mr-1.5 h-4 sm:h-4" />
                              Odaları Keşfet
                            </Link>
                          </Button>
                        </motion.div>
                        <motion.div variants={buttonItemVariants}>
                          <Button asChild size="sm" variant="outline" className="w-full border-primary/60 text-primary hover:bg-primary/10 hover:text-primary rounded-md py-2.5 text-xs sm:text-sm">
                            <Link href="/chat">
                              <PlusCircle className="mr-1.5 h-4 sm:h-4" />
                              Yeni Oda Oluştur
                            </Link>
                          </Button>
                        </motion.div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
  
            <Dialog open={isCreatePostDialogOpen} onOpenChange={setIsCreatePostDialogOpen}>
              <DialogTrigger asChild>
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }} 
                   animate={{ opacity: 1, y: 0 }} 
                   transition={{ delay: isWelcomeCardVisible ? 0.3 : 0.1, duration: 0.5 }}
                   className="bg-card p-3 sm:p-4 rounded-xl shadow-md border border-border/30 hover:border-primary/50 transition-all duration-200 ease-out cursor-pointer flex items-center gap-3 group hover:shadow-lg"
                 >
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 border-2 border-transparent group-hover:border-primary/50 transition-colors">
                      <AvatarImage src={userData?.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="user avatar" />
                      <AvatarFallback>{getAvatarFallbackText(userData?.displayName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground group-hover:text-foreground text-sm sm:text-base flex-1">Bir şeyler paylaş, {userData?.displayName || 'Kullanıcı'}...</span>
                    <Edit3 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                 </motion.div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>Yeni Gönderi Oluştur</DialogTitle>
                  <DialogDescription>
                    Düşüncelerini toplulukla paylaş.
                  </DialogDescription>
                </DialogHeader>
                <div className="p-6 pt-4">
                  <CreatePostForm onPostCreated={() => {
                      setIsCreatePostDialogOpen(false);
                      fetchPosts(true);
                  }} />
                </div>
              </DialogContent>
            </Dialog>
  
            {showRefreshButton && !isLoadingPosts && !isLoadingRooms && !isRefreshingFeed && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="my-3 sticky top-[calc(3.5rem+0.75rem)] sm:top-[calc(3.5rem+1rem)] z-20 flex justify-center"
              >
                <Button
                  onClick={handleRefreshClick}
                  variant="outline"
                  className="py-2.5 text-sm bg-card/80 dark:bg-background/80 backdrop-blur-md border-primary/50 text-primary/90 hover:bg-primary/15 hover:text-primary shadow-lg rounded-full w-auto px-6 animate-subtle-pulse"
                  disabled={isRefreshingFeed || isLoadingPosts || isLoadingRooms}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Yeni İçerikleri Yükle
                </Button>
              </motion.div>
            )}
  
            {(isLoadingPosts || isLoadingRooms || loadingBlockedUsers || (! (userData?.privacySettings?.feedShowsEveryone ?? true) && loadingFriends) ) && combinedFeedItems.length === 0 && !isRefreshingFeed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
                <h2 className="text-2xl font-semibold text-foreground mb-2">Akışınız Hazırlanıyor</h2>
                <p className="text-md text-muted-foreground max-w-sm">En yeni ve en taze içerikleri sizin için bir araya getiriyoruz, lütfen biraz bekleyin.</p>
              </motion.div>
            )}
  
            {isRefreshingFeed && (
               <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center py-6 text-sm text-muted-foreground"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2.5" />
                Akış yenileniyor, en güncel içerikler geliyor...
              </motion.div>
            )}
  
            {!isLoadingPosts && !isLoadingRooms && !loadingBlockedUsers && !isRefreshingFeed && combinedFeedItems.length === 0 && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="text-center py-10 sm:py-16 bg-gradient-to-b from-card to-secondary/20 dark:from-card dark:to-secondary/10 border border-border/20 rounded-xl shadow-lg">
                      <CardHeader className="pb-3">
                          <Sparkles className="mx-auto h-16 w-16 sm:h-20 sm:w-20 text-primary/70 mb-4 opacity-80" />
                          <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">
                          {(userData?.privacySettings?.feedShowsEveryone === false)
                              ? "Arkadaş Akışın Henüz Boş!"
                              : "Akışta Keşfedilecek Yeni Şeyler Var!"}
                          </CardTitle>
                      </CardHeader>
                      <CardContent>
                          <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto mb-6">
                          {(userData?.privacySettings?.feedShowsEveryone === false)
                          ? "Arkadaşların henüz bir şey paylaşmamış veya kendi gönderin yok. Yeni arkadaşlar edin veya ilk gönderini sen paylaşarak akışı canlandır!"
                          : "Görünüşe göre etrafta henüz yeni bir hareketlilik yok. İlk gönderiyi sen paylaşarak veya yeni bir sohbet odası keşfederek topluluğa enerji kat!"}
                          </p>
                          <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-base rounded-lg shadow-md hover:shadow-lg transition-shadow" onClick={() => setIsCreatePostDialogOpen(true)}>
                              <PlusCircle className="mr-2 h-5 w-5"/> İlk Gönderini Paylaş
                          </Button>
                      </CardContent>
                  </Card>
               </motion.div>
            )}
  
            {(!isLoadingPosts || !isLoadingRooms || combinedFeedItems.length > 0) && !isRefreshingFeed && (
              <div className="space-y-4">
                {combinedFeedItems.map((item, index) => {
                  if (item.feedItemType === 'post') {
                    return (
                      <motion.div
                          key={`post-${item.id}-${(item.createdAt as Timestamp)?.seconds || index}`}
                          custom={index}
                          variants={feedItemEntryVariants}
                          initial="hidden"
                          animate="visible"
                          className="rounded-xl" // Animasyonlu öğelere yuvarlak köşe
                      >
                        <PostCard post={item as Post} />
                      </motion.div>
                    );
                  } else if (item.feedItemType === 'room') {
                    return (
                      <motion.div
                          key={`room-${item.id}-${(item.createdAt as Timestamp)?.seconds || index}`}
                          custom={index}
                          variants={feedItemEntryVariants}
                          initial="hidden"
                          animate="visible"
                          className="rounded-xl" // Animasyonlu öğelere yuvarlak köşe
                      >
                        <RoomInFeedCard room={item as RoomInFeedCardData} />
                      </motion.div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
  
          </div>
      );
    }
  
    // Fallback for when currentUser is null (e.g., after logout, before redirect)
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
            <div className="mb-6">
                <Globe className="h-20 w-20 text-primary animate-pulse mx-auto" />
            </div>
            <h1 className="text-3xl font-headline font-semibold text-primary mb-3">
                Bir An...
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
                Sayfa yükleniyor veya yönlendiriliyor. Lütfen bekleyin.
            </p>
        </div>
    );
  }

  return <PageContent />;
}
