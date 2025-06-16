
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, MessagesSquare, UserCog, Users as UsersIcon, PlusCircle, Compass, Globe, Sparkles } from "lucide-react"; 
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, Timestamp, where } from "firebase/firestore";
import { isFuture } from 'date-fns';
import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: "spring",
      stiffness: 100,
      damping: 15,
      duration: 0.6 
    } 
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 260, damping: 12 } },
};


export default function HomePage() {
  const router = useRouter();
  const { currentUser, userData, loading: authLoading } = useAuth();

  const [activeRoomsCount, setActiveRoomsCount] = useState<number | null>(null);
  const [friendsCount, setFriendsCount] = useState<number | null>(null);
  const [loadingActiveRooms, setLoadingActiveRooms] = useState(true);
  const [loadingFriendsCount, setLoadingFriendsCount] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    const q = query(
      collection(db, "chatRooms")
    );

    const unsubscribeRooms = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const roomData = doc.data();
        if (roomData.expiresAt && roomData.expiresAt instanceof Timestamp) {
          if (isFuture(roomData.expiresAt.toDate())) {
            count++;
          }
        } 
      });
      setActiveRoomsCount(count);
      setLoadingActiveRooms(false);
    }, (error) => {
      console.error("Error fetching active rooms count:", error);
      setActiveRoomsCount(0);
      setLoadingActiveRooms(false);
    });

    return () => unsubscribeRooms();
  }, []);

  useEffect(() => {
    if (currentUser?.uid) {
      setLoadingFriendsCount(true);
      const friendsQuery = query(collection(db, `users/${currentUser.uid}/confirmedFriends`));
      const unsubscribeFriends = onSnapshot(friendsQuery, (snapshot) => {
        setFriendsCount(snapshot.size);
        setLoadingFriendsCount(false);
      }, (error) => {
        console.error("Error fetching friends count:", error);
        setFriendsCount(0);
        setLoadingFriendsCount(false);
      });
      return () => unsubscribeFriends();
    } else {
      setFriendsCount(0);
      setLoadingFriendsCount(false);
    }
  }, [currentUser?.uid]);


  if (authLoading || (currentUser && (loadingActiveRooms || loadingFriendsCount))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <div className="mb-6">
          <MessagesSquare className="h-16 w-16 text-primary animate-pulse mx-auto" />
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
    return (
      <AppLayout>
        <div className="space-y-6">
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
          >
            <Card className="shadow-xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border-primary/30 overflow-hidden rounded-2xl">
              <CardHeader className="p-6 sm:p-8">
                <motion.div 
                  className="flex justify-between items-start mb-4"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.1 }}
                >
                  <div>
                    <CardTitle className="text-3xl sm:text-4xl font-headline text-primary-foreground/95">
                      Tekrar Hoş Geldin, {greetingName}!
                    </CardTitle>
                    <CardDescription className="text-base sm:text-lg text-muted-foreground mt-1.5">
                      Bugün yeni bağlantılar kurmaya veya keyifli sohbetlere katılmaya ne dersin?
                    </CardDescription>
                  </div>
                  <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-accent opacity-80" />
                </motion.div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0">
                <motion.div 
                  className="flex items-center gap-2 text-sm text-muted-foreground mb-6"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 0.2 }}
                >
                  <Gem className="h-5 w-5 text-yellow-400" />
                  <span className="font-medium">Mevcut Elmasların: {userData?.diamonds ?? 0}</span>
                </motion.div>
                <motion.div 
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  variants={buttonsContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={buttonItemVariants}>
                    <Button asChild size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground animate-subtle-pulse rounded-lg py-6 text-base">
                      <Link href="/chat">
                        <Compass className="mr-2.5 h-5 w-5" />
                        Odalara Göz At
                      </Link>
                    </Button>
                  </motion.div>
                  <motion.div variants={buttonItemVariants}>
                    <Button asChild size="lg" variant="outline" className="w-full border-primary/70 text-primary hover:bg-primary/10 hover:text-primary rounded-lg py-6 text-base">
                      <Link href="/chat"> 
                        <PlusCircle className="mr-2.5 h-5 w-5" />
                        Yeni Oda Oluştur
                      </Link>
                    </Button>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium">Sohbet Dünyası</CardTitle>
                <MessagesSquare className="h-6 w-6 text-accent" />
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-sm text-muted-foreground mb-4">
                  {loadingActiveRooms ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Aktif odalar yükleniyor...
                    </div>
                  ) : (
                    `Şu anda keşfedilecek ${activeRoomsCount ?? 0} aktif sohbet odası bulunuyor.`
                  )}
                </div>
              </CardContent>
              <CardContent className="pt-0">
                 <Button asChild className="w-full" variant="outline">
                  <Link href="/chat">Tüm Odaları Gör</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium">Bağlantıların</CardTitle>
                <UsersIcon className="h-6 w-6 text-accent" />
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-sm text-muted-foreground mb-4">
                  {loadingFriendsCount ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Arkadaş sayısı yükleniyor...
                    </div>
                  ) : (
                    `Toplam ${friendsCount ?? 0} arkadaşın var. Yeni bağlantılar kur!`
                  )}
                </div>
              </CardContent>
               <CardContent className="pt-0">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/friends">Arkadaşları Yönet</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium">Hesabım</CardTitle>
                <UserCog className="h-6 w-6 text-accent" />
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="text-sm text-muted-foreground mb-4">
                  Kullanıcı bilgilerinizi, avatarınızı ve uygulama tercihlerinizi güncelleyin.
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/profile">Hesabımı Görüntüle</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
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
        Sayfa yönlendiriliyor veya son kontroller yapılıyor. Lütfen bekleyin.
      </p>
    </div>
  );
}

    