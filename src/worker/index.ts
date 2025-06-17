
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Import OneSignal's Service Worker script
// Bu satırın en üstte veya diğer importlardan önce olması önemlidir.
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.error('[Service Worker] Failed to import OneSignal SDK:', e);
}

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


// Gelen push mesajlarını dinle (OneSignal bunu kendi içinde halleder, bu blok kaldırılabilir veya OneSignal'a özel bir durum için tutulabilir)
/*
self.addEventListener('push', (event) => {
  // This event listener might be handled by OneSignal's imported script.
  // If you need custom push handling *in addition* to OneSignal,
  // ensure it doesn't conflict with OneSignal's operations.
  console.log('[Service Worker] Push Received (custom handler).');
});
*/

// Bildirime tıklama olayını dinle
// OneSignal SDK'sı kendi bildirim tıklama olaylarını yönetir.
// Eğer OneSignal bildirimleri için özel bir davranış isteniyorsa,
// bu OneSignal paneli üzerinden veya SDK'nın event listener'ları aracılığıyla yapılandırılmalıdır.
// Bu genel 'notificationclick' listener, OneSignal dışı bildirimler için kalabilir veya
// OneSignal'ın kendi listener'larıyla çakışmaması için dikkatli yönetilmelidir.
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received (custom handler).');
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
