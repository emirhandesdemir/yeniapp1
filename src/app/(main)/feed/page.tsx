
import { notFound } from 'next/navigation';

// Bu yol artık kullanılmıyor, ana sayfa kök dizinde ('/') yer alıyor.
// Bu dosya, olası yönlendirme çakışmalarını önlemek için "not found" durumuna yönlendiriyor.
export default function DeprecatedFeedPage() {
  notFound();
}
