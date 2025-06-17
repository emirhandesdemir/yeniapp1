
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

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
  event.waitUntil(self.skipWaiting());
});

// Activate event: triggers when the service worker becomes active.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event in progress.');
  event.waitUntil(self.clients.claim());
});


// Gelen push mesajlarını dinle (Şimdilik devre dışı)
/*
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data?.text()}"`);

  const title = 'HiweWalk';
  const options: NotificationOptions = { 
    body: event.data?.text() || 'Yeni bir mesajınız var!',
    icon: '/icons/icon-192x192.png', 
    badge: '/icons/icon-192x192.png', 
    vibrate: [200, 100, 200],
    tag: 'new-message', 
    // actions: [ 
    //   { action: 'explore', title: 'Göz At', icon: '/icons/action-explore.png' },
    //   { action: 'close', title: 'Kapat', icon: '/icons/action-close.png' },
    // ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
*/

// Bildirime tıklama olayını dinle
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close(); 

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const urlToOpen = event.notification.data?.url || '/'; 

      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

