"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardPageContent from './(main)/page'; 
import AppLayout from '@/components/layout/AppLayout';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth(); // AuthContext'ten kullanıcı ve yükleme durumunu al

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Yönlendiriliyor...</p>
      </div>
    );
  }

  if (currentUser) {
    return (
      <AppLayout>
        <DashboardPageContent />
      </AppLayout>
    );
  }

  // Eğer currentUser null ise ve loading tamamlandıysa, useEffect yönlendirmeyi tetikler.
  // Bu yükleyici, yönlendirme tamamlanana kadar bir fallback görevi görür.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Yönlendiriliyor...</p>
    </div>
  );
}
