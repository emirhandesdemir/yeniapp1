
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { firebaseConfig } from "@/lib/firebase"; // Firebase config import

// Version comment to force service worker update
// Version: 2
try {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  onBackgroundMessage(messaging, (payload) => {
    console.log('[Service Worker] FCM Background Message Received:', payload);

    const notificationTitle = payload.notification?.title || "Yeni Bildirim";
    const notificationOptions: NotificationOptions = {
      body: payload.notification?.body || "",
      icon: payload.notification?.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png', // Example badge
      data: payload.data || { url: '/' }, // Ensure data has a URL for click action
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
    console.error('[Service Worker] Firebase Messaging initialization failed:', e);
}

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
  console.log('[Service Worker] V2 Install event in progress.');
  event.waitUntil(self.skipWaiting());
});

// Activate event: triggers when the service worker becomes active.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event in progress.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          try {
            return client.focus();
          } catch (e) {
            // Fallback for browsers that might have issues with focus()
            if (self.clients.openWindow) {
              return self.clients.openWindow(targetUrl);
            }
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
