
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, ShieldCheck, Users, MessageSquareText, Activity, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";

interface AdminStats {
  totalUsers: number;
  activeRooms: number;
  // Add more stats as needed
}

export default function AdminDashboardContent() {
  const { userData: adminUserData } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoadingStats(false);
        return;
      }
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const totalUsers = usersSnap.size;

        const activeRoomsQuery = query(
          collection(db, "chatRooms"),
          where("expiresAt", ">", Timestamp.now())
        );
        const activeRoomsSnap = await getDocs(activeRoomsQuery);
        const activeRooms = activeRoomsSnap.size;

        setStats({ totalUsers, activeRooms });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
        // Consider showing a toast error here
      } finally {
        setLoadingStats(false);
      }
    };

    if (adminUserData?.role === 'admin') {
      fetchStats();
    } else {
      setLoadingStats(false);
    }
  }, [adminUserData]);


  if (adminUserData === undefined || adminUserData === null) {
    return (
     <div className="flex flex-1 items-center justify-center p-8">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Admin verileri yükleniyor...</p>
     </div>
   );
 }

 if (adminUserData?.role !== 'admin') {
   return (
     <div className="flex flex-1 items-center justify-center p-8">
       <Card className="w-full max-w-md text-center p-6 shadow-lg">
         <CardHeader>
           <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
           <CardTitle>Erişim Reddedildi</CardTitle>
           <CardDescription>Bu bölümü görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
         </CardHeader>
       </Card>
     </div>
   );
 }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-headline text-foreground">Yönetim Paneli</CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                Hoş geldiniz, {adminUserData.displayName || 'Admin'}! Uygulama verilerini ve ayarlarını buradan yönetebilirsiniz.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sol taraftaki menüden kullanıcıları, sohbet odalarını, oyun ayarlarını ve proje asistanını yönetebilirsiniz.
            Aşağıda uygulamanın genel durumu hakkında bazı temel istatistikler bulunmaktadır.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUsers ?? 'N/A'}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Sistemdeki toplam kayıtlı kullanıcı sayısı.
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Sohbet Odaları</CardTitle>
            <MessageSquareText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
             <div className="text-2xl font-bold">{stats?.activeRooms ?? 'N/A'}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Şu anda süresi dolmamış aktif oda sayısı.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistem Sağlığı</CardTitle>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Normal</div>
            <p className="text-xs text-muted-foreground">
              Tüm sistemler normal çalışıyor. (Bu bir placeholder'dır)
            </p>
          </CardContent>
        </Card>
      </div>
       <Card className="shadow-sm border-border/40">
          <CardHeader>
            <div className="flex items-center gap-3">
                 <BarChart3 className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl">Detaylı İstatistikler</CardTitle>
            </div>
             <CardDescription>Uygulama kullanımı ve etkileşimleri hakkında daha fazla bilgi.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Yakında buraya günlük aktif kullanıcı, en popüler odalar, mesajlaşma hacmi gibi daha detaylı grafikler ve istatistikler eklenecektir.
            </p>
          </CardContent>
        </Card>
    </div>
  );
}
