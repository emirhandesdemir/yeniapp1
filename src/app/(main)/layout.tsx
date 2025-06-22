
import type { ReactNode } from 'react';

// Bu, 404 hatasının kaynağını bulmak için basitleştirilmiş bir MainLayout'tur.
// Karmaşık AppLayout bileşeni geçici olarak kaldırılmıştır.
export default function MainAppPagesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <main>{children}</main>
    </div>
  );
}
