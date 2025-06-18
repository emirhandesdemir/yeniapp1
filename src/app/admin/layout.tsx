// Bu layout dosyası, tüm admin sayfaları /src/app/(admin)/ altına taşındığı
// ve /src/app/(admin)/layout.tsx tarafından kapsandığı için artık gereksizdir.
// Bu dosya artık gereksizdir ve projenizden güvenle silinebilir.
// Firebase Studio'da dosya silemediğim için içeriğini boşaltıyorum.
import type { ReactNode } from 'react';

export default function DeprecatedAdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
