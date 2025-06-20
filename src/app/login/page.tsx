"use client";

import React from 'react';
import AuthLayout from "@/components/layout/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout
      title="Tekrar Hoş Geldin!"
      description="Hesabınıza giriş yaparak sohbete devam edin."
      footerText="Hesabın yok mu?"
      footerLinkText="Kayıt Ol"
      footerLinkHref="/signup" // Kayıt sayfasına yönlendirme
    >
      <LoginForm />
    </AuthLayout>
  );
}
