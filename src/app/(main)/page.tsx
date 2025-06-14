
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gem, MessagesSquare, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { userData, currentUser } = useAuth();

  const greetingName = userData?.displayName || currentUser?.displayName || "Kullanıcı";

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
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gem className="h-5 w-5 text-yellow-500" />
              <span>Mevcut Elmasların: {userData?.diamonds ?? 0}</span>
            </div>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto animate-subtle-pulse">
              <Link href="/chat">
                <MessagesSquare className="mr-2 h-5 w-5" />
                Sohbet Odalarını Keşfet
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
              Aktif odalara göz atın, yenilerini oluşturun veya mevcut sohbetlere katılın.
            </div>
          </CardContent>
          <CardContent className="pt-0">
             <Button asChild className="w-full" variant="outline">
              <Link href="/chat">Odalara Git</Link>
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
              Arkadaş listenizi görüntüleyin, yeni bağlantılar kurun veya gelen istekleri yönetin.
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
}
