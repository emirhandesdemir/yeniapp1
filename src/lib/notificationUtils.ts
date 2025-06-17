
"use client";

// OneSignal is now loaded globally via script tag in layout.tsx

export async function requestNotificationPermission(): Promise<NotificationPermission | 'default'> {
  if (typeof window !== 'undefined' && window.OneSignal && window.OneSignal.Notifications) {
    try {
      const permission = await window.OneSignal.Notifications.requestPermission();
      console.log('OneSignal Notification permission:', permission);
      return permission ? 'granted' : 'denied'; // OneSignal returns boolean
    } catch (error) {
      console.error('Error requesting OneSignal notification permission:', error);
      return 'default'; // Fallback or 'denied' based on error
    }
  } else if (typeof window !== 'undefined' && ('Notification' in window)) {
    // Fallback to native browser permission if OneSignal isn't ready
    console.warn('OneSignal SDK not fully available, falling back to native Notification.requestPermission()');
    try {
        const permission = await Notification.requestPermission();
        console.log('Native Notification permission:', permission);
        return permission;
    } catch (error) {
        console.error('Error requesting native notification permission:', error);
        return 'default';
    }
  }
  console.error('Notification API or OneSignal SDK not available in this environment.');
  return 'default';
}

export async function subscribeUserToPush(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.OneSignal || !window.OneSignal.User || !window.OneSignal.User.PushSubscription) {
    console.warn('OneSignal SDK not available or not initialized. Cannot subscribe.');
    return null;
  }

  try {
    const isOptedIn = window.OneSignal.User.PushSubscription.optedIn;
    if (isOptedIn) {
      console.log('User is already subscribed to OneSignal push notifications.');
      const playerId = window.OneSignal.User.PushSubscription.id || window.OneSignal.User.onesignalId;
      if (playerId) {
        localStorage.setItem('oneSignalPlayerId', playerId);
      }
      return playerId;
    }

    // If not opted in, prompt the user.
    const permission = await window.OneSignal.Notifications.requestPermission();
    if (permission) { // OneSignal's requestPermission resolves to true if granted
      await window.OneSignal.User.PushSubscription.optIn();
      console.log('User subscribed to OneSignal push notifications.');
      const playerId = window.OneSignal.User.PushSubscription.id || window.OneSignal.User.onesignalId;
      if (playerId) {
        localStorage.setItem('oneSignalPlayerId', playerId);
        console.log("OneSignal Player ID:", playerId, " (Send this to your backend)");
      }
      return playerId;
    } else {
      console.log('User denied push notification permission via OneSignal.');
      localStorage.removeItem('oneSignalPlayerId');
      return null;
    }
  } catch (error) {
    console.error('Error subscribing user to OneSignal push notifications:', error);
    localStorage.removeItem('oneSignalPlayerId');
    return null;
  }
}

export async function unsubscribeUserFromPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.OneSignal || !window.OneSignal.User || !window.OneSignal.User.PushSubscription) {
    console.warn('OneSignal SDK not available. Cannot unsubscribe.');
    return false;
  }
  try {
    await window.OneSignal.User.PushSubscription.optOut();
    console.log('User unsubscribed from OneSignal push notifications.');
    localStorage.removeItem('oneSignalPlayerId');
    // TODO: Notify your backend that the user has unsubscribed.
    return true;
  } catch (error) {
    console.error('Error unsubscribing user from OneSignal push notifications:', error);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.OneSignal || !window.OneSignal.User || !window.OneSignal.User.PushSubscription) {
    return false;
  }
  try {
    const optedIn = window.OneSignal.User.PushSubscription.optedIn;
    return optedIn;
  } catch (error) {
    console.error("Error checking OneSignal subscription status:", error);
    return false;
  }
}

export function getNotificationPermissionStatus(): NotificationPermission | 'default' {
    if (typeof window !== 'undefined' && window.OneSignal && window.OneSignal.Notifications) {
        const permission = window.OneSignal.Notifications.permission;
        // OneSignal's permission is a boolean, map to NotificationPermission string
        if (permission === true) return 'granted';
        if (permission === false) return 'denied'; 
    }
    // Fallback or if OneSignal's direct permission string isn't easily available
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission;
    }
    return 'default';
}

