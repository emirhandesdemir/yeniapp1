
"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, Compass, PlusCircle, Sparkles, Globe, MessageSquare, Users, Target, Edit, RefreshCw, Star } from "lucide-react";
import { useAuth, checkUserPremium } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import CreatePostForm from "@/components/feed/CreatePostForm";
import PostCard, { type Post } from "@/components/feed/PostCard";
import RoomInFeedCard, { type ChatRoomFeedDisplayData } from "@/components/feed/RoomInFeedCard";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, Timestamp, where, limit, getDocs, onSnapshot } from "firebase/firestore";
import { isPast } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } },
};

const buttonsContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const buttonItemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 10 } },
};

const feedItemEntryVariants = {
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


const SCROLL_HIDE_THRESHOLD = 100;
const WELCOME_CARD_SESSION_KEY = 'welcomeCardHiddenPermanently_v1_hiwewalk';
const POSTS_FETCH_LIMIT = 10; // Bu limit onSnapshot'ta da kullanılacak
const ROOMS_FETCH_LIMIT = 3;
const REFRESH_BUTTON_TIMER_MS = 2 * 60 * 1000; 

export type FeedDisplayItem = (Post & { feedItemType: 'post' }) | (ChatRoomFeedDisplayData & { feedItemType: 'room' });


export default function HomePage() {
  const router = useRouter();
  const { currentUser, userData, loading: authLoading, isUserDataLoading } = useAuth();

  const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(true);
  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState(false);

  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [activeRooms, setActiveRooms] = useState<ChatRoomFeedDisplayData[]>([]);
  const [combinedFeedItems, setCombinedFeedItems] = useState<FeedDisplayItem[]>([]);

  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  
  const [friends, setFriends] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const refreshButtonTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!isLoadingPosts && !isLoadingRooms && !isRefreshingFeed) { 
        setShowRefreshButton(true);
      }
    }, REFRESH_BUTTON_TIMER_MS);
  }, [isLoadingPosts, isLoadingRooms, isRefreshingFeed]);

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
    
    if (isManualRefresh) { // Only reset timer elements if it's a manual refresh
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
        orderBy("participantCount", "desc"),
        limit(ROOMS_FETCH_LIMIT)
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      const fetchedRoomsData: ChatRoomFeedDisplayData[] = [];
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
          } as ChatRoomFeedDisplayData);
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
  }, [currentUser, startRefreshButtonTimer]); // startRefreshButtonTimer eklendi

  // Real-time listener for posts
  useEffect(() => {
    if (!currentUser) {
      setAllPosts([]);
      setIsLoadingPosts(false);
      return () => {}; // Return an empty function for cleanup
    }
    setIsLoadingPosts(true);
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(POSTS_FETCH_LIMIT));
    
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const fetchedPostsData: Post[] = [];
      snapshot.forEach((doc) => {
        fetchedPostsData.push({ id: doc.id, ...doc.data() } as Post);
      });
      setAllPosts(fetchedPostsData);
      setIsLoadingPosts(false);
      if (!isRefreshingFeed) { // Sadece ilk yüklemede veya onSnapshot sonrası timer'ı başlat
          startRefreshButtonTimer();
      }
    }, (error) => {
      console.error("Error fetching posts with onSnapshot: ", error);
      setIsLoadingPosts(false);
    });

    return () => unsubscribePosts(); // Cleanup listener on component unmount or currentUser change
  }, [currentUser, isRefreshingFeed, startRefreshButtonTimer]);


  useEffect(() => {
    if (currentUser) {
      fetchActiveRooms(); // Fetch rooms once on load
    } else {
      setIsLoadingRooms(false);
      setActiveRooms([]);
    }
  }, [currentUser, fetchActiveRooms]); // fetchActiveRooms eklendi

  useEffect(() => {
    if (currentUser && userData?.privacySettings?.feedShowsEveryone === false) {
      setLoadingFriends(true);
      const friendsRef = collection(db, `users/${currentUser.uid}/confirmedFriends`);
      const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
        const friendIds = snapshot.docs.map(doc => doc.id);
        setFriends(friendIds);
        setLoadingFriends(false);
      }, (error) => {
        console.error("Error fetching friends for feed:", error);
        setLoadingFriends(false);
      });
      return () => unsubscribeFriends();
    } else {
      setFriends([]); 
      setLoadingFriends(false);
    }
  }, [currentUser, userData?.privacySettings?.feedShowsEveryone]);

  useEffect(() => {
    const feedShowsEveryone = userData?.privacySettings?.feedShowsEveryone ?? true; 

    if (isLoadingPosts || isLoadingRooms || (!feedShowsEveryone && loadingFriends)) {
      return; 
    }

    let filteredPosts = allPosts;
    if (!feedShowsEveryone && currentUser) {
      filteredPosts = allPosts.filter(post => 
        post.userId === currentUser.uid || friends.includes(post.userId)
      );
    }

    const postItems: FeedDisplayItem[] = filteredPosts.map(p => ({ ...p, feedItemType: 'post' }));
    const roomItems: FeedDisplayItem[] = activeRooms.map(r => ({ ...r, feedItemType: 'room' }));

    const combined = [...postItems, ...roomItems].sort((a, b) => {
        const aIsPremiumContent = (a.feedItemType === 'room' && (a as ChatRoomFeedDisplayData).isPremiumRoom) || (a.feedItemType === 'post' && (a as Post).authorIsPremium);
        const bIsPremiumContent = (b.feedItemType === 'room' && (b as ChatRoomFeedDisplayData).isPremiumRoom) || (b.feedItemType === 'post' && (b as Post).authorIsPremium);

        if (aIsPremiumContent && !bIsPremiumContent) return -1;
        if (!aIsPremiumContent && bIsPremiumContent) return 1;
        
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA; 
    });
    setCombinedFeedItems(combined);

  }, [allPosts, activeRooms, isLoadingPosts, isLoadingRooms, userData?.privacySettings?.feedShowsEveryone, friends, loadingFriends, currentUser]);

  useEffect(() => {
    return () => {
      if (refreshButtonTimerRef.current) {
        clearTimeout(refreshButtonTimerRef.current);
      }
    };
  }, []);

  const handleRefreshClick = useCallback(() => {
    if (isRefreshingFeed) return;
    fetchActiveRooms(true); // Fetch rooms again on manual refresh
    // Posts will auto-refresh due to onSnapshot, but we can set isRefreshingFeed
    setIsRefreshingFeed(true); 
    // onSnapshot listener for posts will eventually set isRefreshingFeed to false via setIsLoadingPosts(false)
    // and then call startRefreshButtonTimer
  }, [isRefreshingFeed, fetchActiveRooms]);

  if (authLoading || (currentUser && isUserDataLoading && !userData)) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <div className="mb-6">
          <MessageSquare className="h-16 w-16 text-primary animate-pulse mx-auto" />
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
      <AppLayout>
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
                <Card className="shadow-lg bg-card border border-border/30 rounded-xl overflow-hidden">
                  <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-primary/10 via-card to-red-500/10 dark:from-primary/15 dark:via-card dark:to-red-500/15">
                    <motion.div
                      className="flex items-center gap-3"
                      variants={itemVariants}
                    >
                      <Target className="h-7 w-7 text-primary" />
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
                        <Button asChild size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-md py-2 text-xs sm:text-sm">
                          <Link href="/chat">
                            <Compass className="mr-1.5 h-4 sm:h-4" />
                            Odaları Keşfet
                          </Link>
                        </Button>
                      </motion.div>
                      <motion.div variants={buttonItemVariants}>
                        <Button asChild size="sm" variant="outline" className="w-full border-primary/60 text-primary hover:bg-primary/10 hover:text-primary rounded-md py-2 text-xs sm:text-sm">
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
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isWelcomeCardVisible ? 0.3 : 0.1, duration: 0.5 }}>
                <Button 
                    variant="outline" 
                    className="w-full py-6 text-lg bg-card hover:bg-muted/80 border-2 border-dashed border-primary/40 hover:border-primary/70 text-primary/80 hover:text-primary shadow-sm"
                >
                    <Edit className="mr-2 h-5 w-5"/> Bir şeyler paylaş...
                </Button>
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
                    // fetchFeedItems(true); // onSnapshot posts will update automatically
                }} />
              </div>
            </DialogContent>
          </Dialog>
          
          {showRefreshButton && !isLoadingPosts && !isLoadingRooms && !isRefreshingFeed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="my-3 sticky top-[calc(3.5rem+0.75rem)] sm:top-[calc(3.5rem+1rem)] z-20">
              <Button
                onClick={handleRefreshClick}
                variant="outline"
                className="w-full py-2.5 text-sm bg-card/80 dark:bg-background/80 backdrop-blur-sm border-primary/40 text-primary/90 hover:bg-primary/10 hover:text-primary shadow-md rounded-full"
                disabled={isRefreshingFeed || isLoadingPosts || isLoadingRooms}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Yeni İçerikleri Yükle
              </Button>
            </motion.div>
          )}


          {(isLoadingPosts || isLoadingRooms) && combinedFeedItems.length === 0 && !isRefreshingFeed && ( 
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-medium text-foreground mb-1">Akışınız Hazırlanıyor</h2>
              <p className="text-sm text-muted-foreground">En yeni içerikler getiriliyor...</p>
            </motion.div>
          )}

          {isRefreshingFeed && (
             <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center py-4 text-sm text-muted-foreground"
            >
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              Akış yenileniyor...
            </motion.div>
          )}

          {!isLoadingPosts && !isLoadingRooms && !isRefreshingFeed && combinedFeedItems.length === 0 && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="text-center py-10 sm:py-12 bg-card/80 backdrop-blur-sm border border-border/20 rounded-xl shadow-sm">
                    <CardHeader className="pb-2">
                        <Users className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-primary/70 mb-3" />
                        <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">
                        {(userData?.privacySettings?.feedShowsEveryone === false) 
                            ? "Arkadaş Akışın Henüz Boş!" 
                            : "Akışta Henüz Bir Şey Yok!"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto">
                        {(userData?.privacySettings?.feedShowsEveryone === false)
                        ? "Arkadaşların henüz bir şey paylaşmamış veya kendi gönderin yok. Yeni arkadaşlar edin veya ilk gönderini sen paylaş!"
                        : "İlk gönderiyi sen paylaşarak veya yeni bir sohbet odası bularak etkileşimi başlat!"}
                        </p>
                    </CardContent>
                </Card>
             </motion.div>
          )}

          {(!isLoadingPosts || !isLoadingRooms || combinedFeedItems.length > 0) && !isRefreshingFeed && ( // Show if not loading OR if there are items (to prevent flicker during refresh)
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
                    >
                      <RoomInFeedCard room={item as ChatRoomFeedDisplayData} />
                    </motion.div>
                  );
                }
                return null;
              })}
            </div>
          )}

        </div>
      </AppLayout>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
      <div className="mb-6">
        <Globe className="h-16 w-16 text-primary animate-pulse mx-auto" />
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
