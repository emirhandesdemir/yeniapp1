
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Eğer kullanmıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

// Your web app's Firebase configuration should be loaded from environment variables
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Bu isteğe bağlıdır
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
let app;
if (!getApps().length) {
  if (!firebaseConfig.apiKey) {
    // Bu durum, uygulamanın istemci tarafında API anahtarı olmadan çalışmaya çalışması durumunda bir uyarıdır.
    // Geliştirme sırasında .env.local dosyasının doğru yüklendiğinden emin olun.
    // Build sırasında bu değişkenler normalde build işlemine enjekte edilir.
    console.error("Firebase API Key is missing. Ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in your .env.local file and the development server was restarted.");
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// const analytics = getAnalytics(app); // Eğer kullanmıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

export { app, auth, db, storage };
