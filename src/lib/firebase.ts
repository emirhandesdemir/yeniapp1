// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration using environment variables
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;

// Check if all necessary Firebase config values are present
const requiredConfigs = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

const allConfigsPresent = requiredConfigs.every(config => !!config);

if (!allConfigsPresent) {
  console.error(
    "Firebase HATA: Tüm Firebase yapılandırma değişkenleri .env.local dosyasında tanımlanmamış. Lütfen kontrol edin." +
    "\nEksik olabilecekler: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, " +
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID"
  );
  // You might want to throw an error here or handle it gracefully
  // For now, we'll let the SDK attempt to initialize and potentially fail with its own error message.
  // This prevents the app from crashing during build if env vars are missing,
  // but Firebase services will not work.
}

app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

if (typeof window !== 'undefined') {
  if (firebaseConfig.measurementId && allConfigsPresent) { // Only init analytics if core configs are present
    try {
      analytics = getAnalytics(app);
    } catch (error) {
      console.error("Firebase Analytics başlatma hatası:", error);
    }
  } else if (!firebaseConfig.measurementId) {
    console.warn("Firebase Analytics: measurementId, firebaseConfig içinde tanımlanmamış. Analytics başlatılmayacak.");
  }
}

export { app, auth, db, storage, analytics };
