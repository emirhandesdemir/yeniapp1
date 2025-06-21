
"use client"; // Add "use client" here as AppLayout uses client-side hooks

import AppLayout from "@/components/layout/AppLayout";
import type { ReactNode } from 'react';
// Metadata should be defined in page.tsx or layout.tsx if it's a server component.
// Since this layout now effectively becomes a client component due to AppLayout,
// we might need to move metadata to a higher-level server component layout if strict separation is needed.
// For now, let's assume AppLayout handles title dynamically or it's set in individual pages.

// export const metadata: Metadata = {
// title: 'Anasayfa - HiweWalk',
// description: 'HiweWalk anasayfasına hoş geldiniz.',
// };

export default function MainAppPagesLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout>{children}</AppLayout>
  );
}
