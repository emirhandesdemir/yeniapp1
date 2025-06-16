
// **ÖNEMLİ:** Bu VAPID genel anahtarını kendi oluşturduğunuz anahtarla değiştirin!
// `npx web-push generate-vapid-keys` komutuyla anahtar oluşturabilirsiniz.
// Güvenlik için bu anahtarı bir ortam değişkeninden (environment variable) almak en iyisidir.
const VAPID_PUBLIC_KEY = "BURAYA_KENDI_VAPID_GENEL_ANAHTARINIZI_YAPISTIRIN";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.error('This browser does not support desktop notification');
    alert('Tarayıcınız bildirimleri desteklemiyor.');
    return 'denied';
  }
  return Notification.requestPermission();
}

export async function subscribeUserToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push Messaging is not supported or VAPID key is not set. Push notifications disabled.');
    return null;
  }

  if(VAPID_PUBLIC_KEY === "BURAYA_KENDI_VAPID_GENEL_ANAHTARINIZI_YAPISTIRIN") {
    console.warn("VAPID Public Key not set. Push subscription will fail. Push notifications disabled.");
    // alert("Bildirim altyapısı henüz tam olarak yapılandırılmamış (VAPID anahtarı eksik)."); // Kullanıcıyı rahatsız etmemek için bu alert'i kaldırabiliriz.
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('User IS already subscribed.');
      return existingSubscription;
    }

    console.log('User is NOT subscribed. Subscribing...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('User is subscribed:', subscription);
    
    // TODO: Bu abonelik nesnesini (subscription) backend'inize gönderin ve kullanıcıyla ilişkilendirin.
    // Örnek: await sendSubscriptionToBackend(subscription);
    console.log("Abonelik backend'e gönderilecek (simülasyon):", JSON.stringify(subscription));
    
    localStorage.setItem('pushSubscribed', 'true');
    return subscription;

  } catch (error) {
    console.error('Failed to subscribe the user: ', error);
    localStorage.removeItem('pushSubscribed');
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        console.warn('Permission for notifications was denied');
    } else {
        console.error('Failed to subscribe the user: ', error);
    }
    return null;
  }
}

export async function unsubscribeUserFromPush(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.error('Push Messaging is not supported');
      return false;
    }
  
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
  
      if (!subscription) {
        console.log('User is not subscribed.');
        localStorage.removeItem('pushSubscribed');
        return true;
      }
  
      const successful = await subscription.unsubscribe();
      if (successful) {
        console.log('User is unsubscribed.');
        // TODO: Backend'den de aboneliği kaldırın.
        // Örnek: await removeSubscriptionFromBackend(subscription.endpoint);
        console.log("Abonelik backend'den kaldırılacak (simülasyon):", subscription.endpoint);
        localStorage.removeItem('pushSubscribed');
      } else {
        console.error('Failed to unsubscribe the user.');
      }
      return successful;
    } catch (error) {
      console.error('Error unsubscribing user: ', error);
      return false;
    }
}

export function isPushSubscribed(): boolean {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('pushSubscribed') === 'true';
    }
    return false;
}

export function getNotificationPermissionStatus(): NotificationPermission | 'default' {
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission;
    }
    return 'default';
}

