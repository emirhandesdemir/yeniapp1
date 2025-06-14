import AppLayout from "@/components/layout/AppLayout";
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anasayfa - Sohbet Küresi',
  description: 'Sohbet Küresi anasayfasına hoş geldiniz.',
};

export default function MainAppPagesLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
