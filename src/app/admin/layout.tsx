
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, userData, loading, isUserDataLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isUserDataLoading) {
      if (!currentUser) {
        router.replace('/login?redirect=/admin/dashboard'); // Admin girişi için yönlendirme
      } else if (userData?.role !== 'admin') {
        router.replace('/'); // Admin değilse ana sayfaya yönlendir
      }
    }
  }, [currentUser, userData, loading, isUserDataLoading, router]);

  if (loading || isUserDataLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Admin paneli yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser || userData?.role !== 'admin') {
    // Yönlendirme gerçekleşene kadar veya kullanıcı admin değilse bir mesaj göster
    return (
        <div className="flex flex-1 items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md text-center shadow-2xl">
                <CardHeader>
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-destructive">Erişim Reddedildi</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Bu sayfayı görüntülemek için yönetici yetkiniz bulunmamaktadır.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline">
                        <Link href="/">Anasayfaya Dön</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  // Kullanıcı giriş yapmış ve admin ise içeriği göster
  return <>{children}</>;
}
