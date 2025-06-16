
// Bu layout dosyası, tüm admin sayfaları /src/app/(admin)/ altına taşındığı
// ve /src/app/(admin)/layout.tsx tarafından kapsandığı için artık gereksizdir.
// Firebase Studio'da dosya silemediğim için içeriğini boşaltıyorum.
import type { ReactNode } from 'react';

export default function DeprecatedAdminLayout({ children }: { children: ReactNode }) {
  // Bu layout artık kullanılmamalıdır. Admin sayfaları (admin) route group'u altındadır.
  return <>{children}</>;
}
