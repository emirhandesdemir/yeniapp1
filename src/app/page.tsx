
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, Compass, PlusCircle, Sparkles, Globe, MessageSquare as PageIcon, Users as RoomIcon } from "lucide-react"; 
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import CreatePostForm from "@/components/feed/CreatePostForm";
import PostCard, { type Post } from "@/components/feed/PostCard";
import RoomInFeedCard, { type ChatRoomFeedDisplayData } from "@/components/feed/RoomInFeedCard"; // Yeni import
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp, where, limit } from "firebase/firestore";
import { isPast } from 'date-fns';

const cardVariants = {
  hidden: { opacity: 0, y: -20, height: 0, marginBottom: 0 },
  visible: { 
    opacity: 1, 
    y: 0, 
    height: 'auto',
    marginBottom: '1.5rem', // Corresponds to space-y-6
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

const SCROLL_HIDE_THRESHOLD = 100; 
const WELCOME_CARD_SESSION_KEY = 'welcomeCardHiddenPermanently_v1';

// Akışta gösterilecek öğeler için tür tanımları
export type FeedDisplayItem = (Post & { feedItemType: 'post' }) | (ChatRoomFeedDisplayData & { feedItemType: 'room' });


export default function HomePage() {
  const router = useRouter();
  const { currentUser, userData, loading: authLoading, isUserDataLoading } = useAuth();
  
  const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(true); // Başlangıçta görünür

  const [posts, setPosts] = useState<Post[]>([]);
  const [activeRooms, setActiveRooms] = useState<ChatRoomFeedDisplayData[]>([]);
  const [combinedFeedItems, setCombinedFeedItems] = useState<FeedDisplayItem[]>([]);
  
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);

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
      if (window.scrollY > SCROLL_HIDE_THRESHOLD) {
        setIsWelcomeCardVisible(false);
        sessionStorage.setItem(WELCOME_CARD_SESSION_KEY, 'true');
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

  // Gönderileri çekme
  useEffect(() => {
    setLoadingPosts(true);
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: Post[] = [];
      snapshot.forEach((doc) => {
        fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(fetchedPosts);
      setLoadingPosts(false);
    }, (error) => {
      console.error("Error fetching posts: ", error);
      setLoadingPosts(false);
    });
    return () => unsubscribe();
  }, []);

  // Aktif odaları çekme
  useEffect(() => {
    setLoadingRooms(true);
    const now = Timestamp.now();
    const qRooms = query(
      collection(db, "chatRooms"), 
      where("expiresAt", ">", now), 
      orderBy("expiresAt", "asc"), // En yakın zamanda süresi dolacak olanlar yerine, en yeni oluşturulanlar daha mantıklı olabilir.
                                  // Ya da en aktif olanlar. Şimdilik createdAt ile yapalım.
      orderBy("createdAt", "desc"),
      limit(3) // Akışta gösterilecek oda sayısı
    );
    const unsubscribeRooms = onSnapshot(qRooms, (snapshot) => {
      const fetchedRooms: ChatRoomFeedDisplayData[] = [];
      snapshot.forEach((doc) => {
        const roomData = doc.data();
        // expiresAt kontrolünü tekrar yapalım, çünkü Firestore where filtresi anlık olmayabilir
        if (roomData.expiresAt && !isPast(roomData.expiresAt.toDate())) {
          fetchedRooms.push({
            id: doc.id,
            name: roomData.name,
            description: roomData.description,
            participantCount: roomData.participantCount,
            maxParticipants: roomData.maxParticipants,
            createdAt: roomData.createdAt as Timestamp, // createdAt her odada olmalı
            // imageAiHint ve image isteğe bağlı eklenebilir, şimdilik basit tutuyoruz
          } as ChatRoomFeedDisplayData);
        }
      });
      setActiveRooms(fetchedRooms);
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching active rooms: ", error);
      setLoadingRooms(false);
    });
    return () => unsubscribeRooms();
  }, []);

  // Gönderileri ve odaları birleştirip sıralama
  useEffect(() => {
    if (loadingPosts || loadingRooms) return;

    const postItems: FeedDisplayItem[] = posts.map(p => ({ ...p, feedItemType: 'post' }));
    const roomItems: FeedDisplayItem[] = activeRooms.map(r => ({ ...r, feedItemType: 'room' }));
    
    const combined = [...postItems, ...roomItems].sort((a, b) => {
        // Hem post hem de room için createdAt var, null kontrolü ekleyelim
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
    });
    setCombinedFeedItems(combined);

  }, [posts, activeRooms, loadingPosts, loadingRooms]);


  if (authLoading || (currentUser && isUserDataLoading)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <div className="mb-6">
          <PageIcon className="h-16 w-16 text-primary animate-pulse mx-auto" />
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
    const isLoadingFeed = loadingPosts || loadingRooms;

    return (
      <AppLayout>
        <div className="space-y-6">
          <AnimatePresence>
            {isWelcomeCardVisible && (
              <motion.div
                key="welcome-card"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="shadow-lg bg-gradient-to-br from-primary/15 via-accent/5 to-primary/15 border-primary/20 overflow-hidden rounded-xl">
                  <CardHeader className="p-3 sm:p-4">
                    <motion.div 
                      className="flex justify-between items-start mb-2"
                      variants={itemVariants}
                    >
                      <div>
                        <CardTitle className="text-lg sm:text-xl font-semibold text-primary-foreground/90">
                          Hoş Geldin, {greetingName}!
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                          Yeni bağlantılar kur veya sohbetlere katıl.
                        </CardDescription>
                      </div>
                      <Sparkles className="h-5 w-5 text-accent opacity-70" />
                    </motion.div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <motion.div 
                      className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5"
                      variants={itemVariants}
                    >
                      <Gem className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="font-medium">Elmasların: {userData?.diamonds ?? 0}</span>
                    </motion.div>
                    <motion.div 
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      variants={buttonsContainerVariants}
                    >
                      <motion.div variants={buttonItemVariants}>
                        <Button asChild size="sm" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-md py-2 text-xs">
                          <Link href="/chat">
                            <Compass className="mr-1.5 h-4 w-4" />
                            Odalara Göz At
                          </Link>
                        </Button>
                      </motion.div>
                      <motion.div variants={buttonItemVariants}>
                        <Button asChild size="sm" variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary rounded-md py-2 text-xs">
                          <Link href="/chat"> 
                            <PlusCircle className="mr-1.5 h-4 w-4" />
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
          
          <CreatePostForm />
          
          {isLoadingFeed && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Akış yükleniyor...</p>
            </div>
          )}

          {!isLoadingFeed && combinedFeedItems.length === 0 && (
             <Card className="text-center py-10 sm:py-12 bg-card border border-border/20 rounded-xl shadow-md">
                <CardHeader className="pb-2">
                    <MessageSquare className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-primary/70 mb-3" />
                    <CardTitle className="text-xl sm:text-2xl font-semibold text-primary-foreground/90">Akışta Henüz Bir Şey Yok!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto">
                    İlk gönderiyi sen paylaşarak veya yeni bir sohbet odası bularak etkileşimi başlat!
                    </p>
                </CardContent>
            </Card>
          )}

          {!isLoadingFeed && combinedFeedItems.length > 0 && (
            <div className="space-y-4">
              {combinedFeedItems.map((item) => {
                if (item.feedItemType === 'post') {
                  return <PostCard key={`post-${item.id}`} post={item as Post} />;
                } else if (item.feedItemType === 'room') {
                  return <RoomInFeedCard key={`room-${item.id}`} room={item as ChatRoomFeedDisplayData} />;
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

    