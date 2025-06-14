
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, MessagesSquare, UserCog, Users as UsersIcon, PlusCircle, Compass } from "lucide-react"; // Renamed Users to UsersIcon to avoid conflict
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, Timestamp, where } from "firebase/firestore";
import { isFuture } from 'date-fns';


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

  // Effect for active rooms count (moved from former (main)/page.tsx)
  useEffect(() => {
    const q = query(
      collection(db, "chatRooms")
      // where("expiresAt", ">", Timestamp.now()) // This direct usage of Timestamp.now() in query might be problematic depending on Firestore SDK version or if offline persistence is involved.
                                              // It's generally safer to compare against a client-generated timestamp for "expiresAt" or ensure server timestamps are consistently used and queried.
                                              // For now, we'll assume 'expiresAt' is a valid Timestamp and filter client-side or use a fixed server-side query if issues persist.
    );

    const unsubscribeRooms = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const roomData = doc.data();
        if (roomData.expiresAt && roomData.expiresAt instanceof Timestamp) {
          if (isFuture(roomData.expiresAt.toDate())) {
            count++;
          }
        } else if (roomData.expiresAt === null || roomData.expiresAt === undefined) {
          // Consider rooms without expiry as active, or apply specific logic
          // For this example, let's assume rooms without expiry are not counted or handled differently.
          // If they should be active, you might count them here.
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

  // Effect for friends count (moved from former (main)/page.tsx)
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  if (currentUser && userData) {
    const greetingName = userData?.displayName || currentUser?.displayName || "Kullanıcı";
    return (
      <AppLayout>
        <div className="space-y-6">
          <Card className="shadow-lg bg-gradient-to-r from-primary/10 via-transparent to-accent/10 border-primary/20 overflow-hidden">
            <CardHeader className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl font-headline text-primary-foreground/90">
                    Tekrar Hoş Geldin, {greetingName}!
                  </CardTitle>
                  <CardDescription className="text-lg text-muted-foreground mt-1">
                    Bugün yeni bağlantılar kurmaya veya keyifli sohbetlere katılmaya ne dersin?
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Gem className="h-5 w-5 text-yellow-500" />
                <span>Mevcut Elmasların: {userData?.diamonds ?? 0}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground animate-subtle-pulse">
                  <Link href="/chat">
                    <Compass className="mr-2 h-5 w-5" />
                    Odalara Göz At
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  <Link href="/chat"> {/* Assuming "Yeni Oda Oluştur" also navigates to /chat page where the creation modal is */}
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Yeni Oda Oluştur
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
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

            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
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

            <Card className="shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
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

  // Fallback for when !currentUser && !authLoading (handled by useEffect for redirect)
  // or when userData is still loading for an authenticated user but other counts are not yet.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Yükleniyor...</p>
    </div>
  );
}

    