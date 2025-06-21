
"use client";

import React, { useEffect } from 'react';
import AuthLayout from "@/components/layout/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      router.replace('/');
    }
  }, [currentUser, loading, router]);
  
  if (loading || (!loading && currentUser)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Yönlendiriliyor...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Aramıza Katıl!"
      description="Yeni bir hesap oluşturarak HiweWalk'in tüm özelliklerinden faydalanın."
      footerText="Zaten bir hesabın var mı?"
      footerLinkText="Giriş Yap"
      footerLinkHref="/login"
    >
      <SignupForm />
    </AuthLayout>
  );
}

    