

"use client"; // Added to ensure client-side rendering context

import React from 'react'; // Added for explicit React import
import AuthLayout from "@/components/layout/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";
import type { Metadata } from 'next';

// Metadata should be defined in a server component layout if the page itself is client.
// For simplicity, we'll keep it here, but Next.js might move it or show a warning.
// Consider moving metadata to src/app/layout.tsx or a dedicated server layout for auth pages if issues persist.
// export const metadata: Metadata = {
// title: 'Kayıt Ol - HiweWalk',
// description: 'HiweWalk\'e katılarak yeni insanlarla tanışın.',
// };

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
