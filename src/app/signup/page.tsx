
import AuthLayout from "@/components/layout/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kayıt Ol - HiweWalk',
  description: 'HiweWalk\'e katılarak yeni insanlarla tanışın.',
};

export default function SignupPage() {
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
