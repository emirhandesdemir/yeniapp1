
import AuthLayout from "@/components/layout/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Giriş Yap - HiweWalk',
  description: 'HiweWalk hesabınıza giriş yapın.',
};

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
