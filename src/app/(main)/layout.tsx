
// Bu layout dosyası, layout mantığı kök layout'a ve AppLayout bileşenine taşındığı için artık gereksizdir.
// Proje yapısını temiz tutmak amacıyla içeriği kaldırılmıştır.
// Bu dosya ileride projeden güvenle silinebilir.

import type { ReactNode } from 'react';

export default function DeprecatedMainLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
