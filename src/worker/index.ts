
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// import { warmStrategyCache } from 'workbox-recipes'; // Not directly used as next-pwa handles runtime caching
// import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'; // Not directly used
// import { registerRoute, Route } from 'workbox-routing'; // Not directly used
// import { CacheableResponsePlugin } from 'workbox-cacheable-response'; // Not directly used
// import { ExpirationPlugin } from 'workbox-expiration'; // Not directly used
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Clean up old caches
cleanupOutdatedCaches();

// Ensure that `precacheAndRoute` is called with an array of manifest entries
// next-pwa usually injects __WB_MANIFEST itself.
try {
  precacheAndRoute(self.__WB_MANIFEST || []);
} catch (e) {
  console.error("[Service Worker] Precaching failed: ", e);
}

// Install event: triggers when the service worker is first installed.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event in progress.');
  // Perform install steps, like caching static assets (handled by precacheAndRoute)
  // Force the waiting service worker to become the active service worker.
  event.waitUntil(self.skipWaiting());
});

// Activate event: triggers when the service worker becomes active.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event in progress.');
  // Perform something when the service worker is activated.
  // This is a good place to clean up old caches not managed by precacheAndRoute.
  // Ensure that the newly activated service worker takes control of the page immediately.
  event.waitUntil(self.clients.claim());
});


// Gelen push mesajlarını dinle
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data?.text()}"`);

  const title = 'Sohbet Küresi';
  const options: NotificationOptions = { // Type added for clarity
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
      // İdeal olarak, bildirimin geldiği sohbet odasına veya ilgili sayfaya yönlendirmek istersiniz.
      // Örneğin, event.notification.data.url gibi bir veri varsa onu kullanabilirsiniz.
      const urlToOpen = event.notification.data?.url || '/'; // Varsayılan olarak ana sayfa

      for (const client of clientList) {
        // Eğer uygulama zaten o URL'de açıksa veya ana sayfada açıksa ona odaklan
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Aksi takdirde yeni bir sekmede/pencerede ilgili sayfayı aç
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

// Service worker'ın güncellemeleri hızlıca alması için
// Bu zaten withPWAInit içinde skipWaiting: true ile sağlanıyor, ancak ek bir kontrol olarak kalabilir.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
