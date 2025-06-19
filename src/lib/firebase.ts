
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getMessaging, type Messaging } from "firebase/messaging"; // FCM için eklendi

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
let messaging: Messaging | null = null; // FCM için eklendi

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (typeof window !== 'undefined') {
    // Initialize Analytics only on the client side and if measurementId is present
    if (firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app);
      } catch (error) {
        console.error("Firebase Analytics başlatma hatası:", error);
      }
    } else {
      console.warn("Firebase Analytics: measurementId, firebaseConfig içinde tanımlanmamış. Analytics başlatılmayacak.");
    }
    // Initialize Firebase Messaging only on the client side
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.error("Firebase Messaging başlatma hatası (client-side):", error);
    }
  }
} catch (error) {
  console.error("Firebase başlatma sırasında genel hata oluştu:", error);
}

export { app, auth, db, storage, analytics, messaging };
