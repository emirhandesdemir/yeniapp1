
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RootPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new main feed page
    router.replace('/feed');
  }, [router]);

  // Show a loading indicator while the redirect is being processed
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
