
import { notFound } from 'next/navigation';

// Bu sayfa, (main) grubundaki ana sayfa ile çakışmayı önlemek için
// artık kasten "not found" durumuna yönlendiriyor.
// Ana sayfa içeriği /src/app/(main)/page.tsx dosyasındadır.
export default function RootPage() {
  notFound();
}
