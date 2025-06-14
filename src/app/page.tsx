// This page will implicitly use (main)/layout.tsx due to Next.js routing conventions
// if this file is moved to src/app/(main)/page.tsx and src/app/page.tsx is removed or redirects.
// For now, let's make this the actual content for the '/' path, wrapped by AppLayout.
// To achieve this, we remove the (main) route group for page.tsx and let it be the root page.
// Then, other authenticated routes like /chat, /profile will be in the (main) group.
// For simplicity with current rules (no route groups for auth nav), let's make page.tsx the dashboard.
// To make this work with a shared layout, this page needs to be inside the (main) group.
// So, this file should actually be src/app/(main)/page.tsx.
// Let's redirect the old src/app/page.tsx to /login or / (dashboard) via a client component.
// For now, let's assume src/app/page.tsx is the landing page that redirects.
// And src/app/(main)/page.tsx is the actual dashboard.

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
      router.replace('/dashboard'); // Redirect to the dashboard page inside (main) group
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
