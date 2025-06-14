
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { warmStrategyCache } from 'workbox-recipes';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { registerRoute, Route } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';

// Kendi önbellekleme stratejilerinizi ve rotalarınızı buraya ekleyebilirsiniz
// Ancak next-pwa zaten runtimeCaching ile bunu büyük ölçüde hallediyor.
// Bu dosya özellikle push ve notificationclick eventleri için var.

// Ensure that `precacheAndRoute` is called with an array of manifest entries
// next-pwa genellikle bu __WB_MANIFEST enjeksiyonunu kendisi yapar.
// Eğer manuel kontrol istiyorsanız, next-pwa yapılandırmasında `precacheEntries` kullanabilirsiniz.
try {
  precacheAndRoute(self.__WB_MANIFEST || []);
} catch (e) {
  console.error("Workbox precaching failed: ", e);
}


// Gelen push mesajlarını dinle
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data?.text()}"`);

  const title = 'Sohbet Küresi';
  const options = {
    body: event.data?.text() || 'Yeni bir mesajınız var!',
    icon: '/icons/icon-192x192.png', // Ana ekrana eklenen ikonla aynı
    badge: '/icons/icon-192x192.png', // Android'de bildirim çubuğunda görünecek küçük ikon
    vibrate: [200, 100, 200],
    tag: 'new-message', // Aynı etikete sahip bildirimler birbirinin üzerine yazar
    // actions: [ // Kullanıcıya seçenekler sunmak için (opsiyonel)
    //   { action: 'explore', title: 'Göz At', icon: '/icons/action-explore.png' },
    //   { action: 'close', title: 'Kapat', icon: '/icons/action-close.png' },
    // ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Bildirime tıklama olayını dinle
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close(); // Bildirimi kapat

  // Hangi eyleme tıklandığını kontrol et (eğer actions tanımladıysanız)
  // if (event.action === 'explore') {
  //   // Keşfet eylemi
  // } else {
  //   // Varsayılan tıklama (veya 'close' dışındaki diğer eylemler)
  // }

  // Uygulamanın ilgili sayfasını açmaya çalış
  // Odaklanacak bir client yoksa yeni bir tane aç
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Eğer uygulama zaten açıksa ona odaklan
        // Belirli bir URL'ye yönlendirme de yapabilirsiniz: client.navigate('/messages')
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      // Aksi takdirde yeni bir sekmede/pencerede ana sayfayı aç
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// Service worker'ın güncellemeleri hızlıca alması için
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
