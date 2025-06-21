
"use client";

import React, { useEffect } from 'react';
import AuthLayout from "@/components/layout/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'banned_auth_check') {
        toast({
            title: "Hesap Erişimi Engellendi",
            description: "Hesabınız askıya alınmıştır. Destek için iletişime geçin.",
            variant: "destructive",
            duration: 7000
        });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (!loading && currentUser) {
      const redirectUrl = searchParams.get('redirect') || '/';
      router.replace(redirectUrl);
    }
  }, [currentUser, loading, router, searchParams]);

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
      title="Tekrar Hoş Geldin!"
      description="Hesabınıza giriş yaparak sohbete devam edin."
      footerText="Hesabın yok mu?"
      footerLinkText="Kayıt Ol"
      footerLinkHref="/signup"
    >
      <LoginForm />
    </AuthLayout>
  );
}

    