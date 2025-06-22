"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * This page acts as a redirector.
 * If a user is logged in, it redirects them to their own profile page (/profile/[userId]).
 * If not logged in, it redirects to the login page.
 * This handles any legacy links pointing to the generic "/profile" URL.
 */
export default function ProfileRedirectPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until authentication status is resolved
    if (!loading) {
      if (currentUser) {
        // If user is logged in, redirect to their specific profile page
        router.replace(`/profile/${currentUser.uid}`);
      } else {
        // If not logged in, redirect to the login page
        router.replace('/login?redirect=/profile');
      }
    }
  }, [currentUser, loading, router]);

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
