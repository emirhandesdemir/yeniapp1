
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getMessaging, type Messaging } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAUPc1suCoz5DtJb9v2BA9qG2QZ_0h-eHs",
  authDomain: "yeni-tinder.firebaseapp.com",
  projectId: "yeni-tinder",
  storageBucket: "yeni-tinder.firebasestorage.app",
  messagingSenderId: "584052934053",
  appId: "1:584052934053:web:c20a004d9b3bf39358144c",
  measurementId: "G-BW4XTD8TRQ"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;
let messaging: Messaging | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (typeof window !== 'undefined') {
    // Initialize Firebase App Check with reCAPTCHA v3 provider
    try {
      const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (!recaptchaSiteKey) {
        console.warn("reCAPTCHA v3 Site Key is not set in environment variables (NEXT_PUBLIC_RECAPTCHA_SITE_KEY). App Check will be disabled.");
      } else {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
        console.log("Firebase App Check initialized successfully.");
      }
    } catch (e) {
      console.error("Firebase App Check initialization error:", e);
    }
    
    // Initialize Analytics only on the client side and if measurementId is present
    if (firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app);
      } catch (error) {
        console.warn("Firebase Analytics başlatma hatası (yoksayıldı):", error);
      }
    } else {
      console.warn("Firebase Analytics: measurementId, firebaseConfig içinde tanımlanmamış. Analytics başlatılmayacak.");
    }

    // Initialize Firebase Messaging only on the client side if supported
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
        try {
            messaging = getMessaging(app);
        } catch (error: any) {
            if (error.code === 'messaging/unsupported-browser') {
                console.warn("Firebase Messaging: Bu tarayıcı desteklemiyor veya gerekli API'ler eksik. (Kod: messaging/unsupported-browser)");
            } else {
                console.error("Firebase Messaging başlatma hatası (client-side):", error);
            }
            messaging = null; // Ensure messaging is null if init fails
        }
    } else if (typeof window !== 'undefined') { // Check typeof window again for clarity if first block is skipped
        console.warn("Firebase Messaging: Service Worker, Push API veya Notification API bu tarayıcıda desteklenmiyor. Messaging başlatılmayacak.");
        messaging = null; // Ensure messaging is null if APIs are not supported
    }
  }
} catch (error) {
  console.error("Firebase başlatma sırasında genel hata oluştu:", error);
}

export { app, auth, db, storage, analytics, messaging };
