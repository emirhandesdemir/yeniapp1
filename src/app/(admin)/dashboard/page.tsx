
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboardPage() {
  const { userData: adminUserData } = useAuth();

  if (adminUserData === undefined || adminUserData === null) {
    return (
     <div className="flex flex-1 items-center justify-center min-h-screen">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
       <p className="ml-2 text-lg">Admin verileri yükleniyor...</p>
     </div>
   );
 }

 if (adminUserData?.role !== 'admin') {
   return (
     <div className="flex flex-1 items-center justify-center min-h-screen">
       <Card className="w-full max-w-md text-center p-6 shadow-lg">
         <CardHeader>
           <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
           <CardTitle>Erişim Reddedildi</CardTitle>
           <CardDescription>Bu sayfayı görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
         </CardHeader>
       </Card>
     </div>
   );
 }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <div>
            <CardTitle className="text-3xl font-headline text-primary-foreground/90">Admin Paneli</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Hoş geldiniz! Uygulama ayarlarını sol taraftaki menüden yönetebilirsiniz.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Bu ana panelden genel bir bakış elde edebilir ve yönetim görevlerinize hızlıca erişebilirsiniz.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Özet</CardTitle>
            <CardDescription>Uygulamanın genel durumu ve istatistikler.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Yakında buraya toplam kullanıcı sayısı, aktif oda sayısı gibi bilgiler eklenecektir.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hızlı Eylemler</CardTitle>
             <CardDescription>Sık kullanılan admin görevlerine hızlı erişim.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Yakında buraya genel duyuru yapma, bakım modunu açma/kapama gibi butonlar eklenecektir.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    