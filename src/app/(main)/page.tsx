import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, MessageSquarePlus, Users2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anasayfa - Sohbet Küresi',
  description: 'Sohbet Küresi anasayfasına hoş geldiniz.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-primary-foreground/90">Hoş Geldin!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Sohbet Küresi'ne tekrar hoş geldin. İşte senin için bazı hızlı erişimler:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Yeni sohbet odaları keşfet, arkadaşlarınla bağlantı kur veya profilini güncelle.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-md hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-medium">Sohbet Odaları</CardTitle>
            <MessageSquarePlus className="h-6 w-6 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Aktif sohbet odalarına göz at veya yeni bir oda oluştur.
            </div>
            <Button asChild className="mt-4 w-full sm:w-auto" variant="outline">
              <Link href="/chat">Odalara Git</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-medium">Arkadaşlarım</CardTitle>
            <Users2 className="h-6 w-6 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Arkadaş listeni yönet, yeni arkadaşlar ekle veya gelen istekleri kontrol et.
            </div>
            <Button asChild className="mt-4 w-full sm:w-auto" variant="outline">
              <Link href="/friends">Arkadaşları Yönet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-medium">Profilini Düzenle</CardTitle>
            <Lightbulb className="h-6 w-6 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Kişisel bilgilerini ve avatarını güncelleyerek profilini kişiselleştir.
            </div>
            <Button asChild className="mt-4 w-full sm:w-auto" variant="outline">
              <Link href="/profile">Profile Git</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
