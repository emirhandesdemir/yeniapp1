
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gem, MessagesSquare, UserCog, Users, PlusCircle, Loader2, Compass } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, Timestamp, where } from "firebase/firestore";
import { isFuture } from 'date-fns';

export default function DashboardPage() {
  const { userData, currentUser } = useAuth();
  const [activeRoomsCount, setActiveRoomsCount] = useState<number | null>(null);
  const [friendsCount, setFriendsCount] = useState<number | null>(null);
  const [loadingActiveRooms, setLoadingActiveRooms] = useState(true);
  const [loadingFriendsCount, setLoadingFriendsCount] = useState(true);

  const greetingName = userData?.displayName || currentUser?.displayName || "Kullanıcı";

  useEffect(() => {
    const q = query(
      collection(db, "chatRooms"),
      where("expiresAt", ">", Timestamp.now()) // Sadece süresi dolmamış olanlar
    );
    
    const unsubscribeRooms = onSnapshot(q, (snapshot) => {
      // expiresAt'ı gelecekte olanları manuel olarak filtrelemek daha güvenilir olabilir
      // çünkü Timestamp.now() sorgu sırasında sabit kalır.
      let count = 0;
      snapshot.docs.forEach(doc => {
        const roomData = doc.data();
        if (roomData.expiresAt && roomData.expiresAt instanceof Timestamp) {
          if (isFuture(roomData.expiresAt.toDate())) {
            count++;
          }
        } else {
          // Süresi olmayan odaları aktif sayabiliriz (eğer varsa)
          // count++; 
        }
      });
      setActiveRoomsCount(count);
      setLoadingActiveRooms(false);
    }, (error) => {
      console.error("Error fetching active rooms count:", error);
      setActiveRoomsCount(0); // Hata durumunda 0 göster
      setLoadingActiveRooms(false);
    });

    return () => unsubscribeRooms();
  }, []);

  useEffect(() => {
    if (currentUser?.uid) {
      const friendsQuery = query(collection(db, `users/${currentUser.uid}/confirmedFriends`));
      const unsubscribeFriends = onSnapshot(friendsQuery, (snapshot) => {
        setFriendsCount(snapshot.size);
        setLoadingFriendsCount(false);
      }, (error) => {
        console.error("Error fetching friends count:", error);
        setFriendsCount(0); // Hata durumunda 0 göster
        setLoadingFriendsCount(false);
      });
      return () => unsubscribeFriends();
    } else {
      setFriendsCount(0);
      setLoadingFriendsCount(false);
    }
  }, [currentUser?.uid]);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg bg-gradient-to-r from-primary/10 via-transparent to-accent/10 border-primary/20 overflow-hidden">
        <CardHeader className="p-6">
          <CardTitle className="text-3xl font-headline text-primary-foreground/90">
            Merhaba, {greetingName}!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-1">
            Sohbet Küresi'ne tekrar hoş geldin. Macerana kaldığın yerden devam et.
          </CardDescription>
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
              <Link href="/chat">
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
            <Users className="h-6 w-6 text-accent" />
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
            <CardTitle className="text-xl font-medium">Profil Ayarları</CardTitle>
            <UserCog className="h-6 w-6 text-accent" />
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-sm text-muted-foreground mb-4">
              Kullanıcı bilgilerinizi, avatarınızı ve uygulama tercihlerinizi güncelleyin.
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <Button asChild className="w-full" variant="outline">
              <Link href="/profile">Profile Git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

    