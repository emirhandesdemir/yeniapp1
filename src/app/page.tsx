"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import DashboardPageContent from './(main)/page'; // Ana panel içeriğini import ediyoruz
import AppLayout from '@/components/layout/AppLayout'; // Ana uygulama layout'unu import ediyoruz

export default function HomePage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    // Gerçek bir uygulamada burada token kontrolü, API çağrısı vb. yapılır.
    const isAuthenticatedUser = true; // Kimlik doğrulaması için placeholder

    if (isAuthenticatedUser) {
      setAuthStatus('authenticated');
    } else {
      setAuthStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    // Kimlik doğrulama durumu belirlendikten sonra, doğrulanmamışsa /login'e yönlendir.
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Yönlendiriliyor...</p>
      </div>
    );
  }

  if (authStatus === 'authenticated') {
    // Kimlik doğrulanmışsa, ana panel içeriğini AppLayout içinde göster.
    // Bu, src/app/page.tsx dosyasını kök authenticated görünümden sorumlu hale getirir.
    return (
      <AppLayout>
        <DashboardPageContent />
      </AppLayout>
    );
  }

  // Eğer authStatus 'unauthenticated' ise, yukarıdaki useEffect yönlendirmeyi tetikler.
  // Bu yükleyici, yönlendirme tamamlanana kadar bir fallback görevi görür.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Yönlendiriliyor...</p>
    </div>
  );
}
