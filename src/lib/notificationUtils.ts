
"use client";

import { messaging } from '@/lib/firebase'; // Firebase'den messaging import edildi
import { getToken, deleteToken } from 'firebase/messaging';

// ===================================================================================
// VAPID anahtarı eklendi.
const VAPID_KEY = "BNpgmdIpfel0F4oErwFBjyh28V8tlYpoBJ7pb2V5pR3Sm8r";
// ===================================================================================

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.error('Notification API not available in this environment.');
    return 'default';
  }
  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission status:', permission);
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'default';
  }
}

export async function subscribeUserToPush(): Promise<string | null> {
  if (typeof window === 'undefined' || !messaging) {
    console.warn('Firebase Messaging not initialized. Cannot subscribe.');
    return null;
  }

  if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY_HERE") {
    console.warn("VAPID_KEY is not set in notificationUtils.ts. Push notifications may not work correctly.");
    // We will proceed anyway to allow for local testing, but this is a critical warning for production.
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        // Bu token'ı backend'inize gönderip kullanıcıyla ilişkilendirmeniz gerekir.
        // Örneğin: await sendTokenToServer(currentToken);
        localStorage.setItem('fcmToken', currentToken); // İstemci tarafında saklama örneği
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        localStorage.removeItem('fcmToken');
        return null;
      }
    } else {
      console.log('Notification permission not granted.');
      localStorage.removeItem('fcmToken');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    localStorage.removeItem('fcmToken');
    return null;
  }
}

export async function unsubscribeUserFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !messaging) {
    console.warn('Firebase Messaging not initialized. Cannot unsubscribe.');
    return false;
  }
  try {
    const currentToken = localStorage.getItem('fcmToken'); // Veya getToken ile tekrar alınabilir
    if (currentToken) {
      await deleteToken(messaging);
      console.log('FCM Token deleted.');
      localStorage.removeItem('fcmToken');
      // TODO: Backend'inizden de token'ı silmeniz gerekebilir.
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const permission = Notification.permission;
  const token = localStorage.getItem('fcmToken'); // Basit kontrol için localStorage kullanılabilir
  return permission === 'granted' && !!token;
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification'in window)) return 'default';
  return Notification.permission;
}
