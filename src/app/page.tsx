"use client"; // Needed for useRouter

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Simulate auth check and redirect
    // In a real app, you'd check auth status
    const isAuthenticated = true; // Placeholder
    if (isAuthenticated) {
      router.replace('/'); // Redirect to the main page (dashboard)
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Yönlendiriliyor...</p>
    </div>
  );
}
