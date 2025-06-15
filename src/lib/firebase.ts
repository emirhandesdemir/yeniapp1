
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Analytics kullanmıyorsak kaldırılabilir
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Firebase Storage eklendi

// Firebase yapılandırmanızın projenizin kök dizinindeki
// .env.local dosyasından yüklendiğinden emin olun.
// Örnek .env.local içeriği:
// NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
// NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:your-app-id
// NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX (isteğe bağlı)

// Yardımcı olmak için API anahtarını konsola yazdıralım
console.log('[DEBUG] Attempting to use Firebase API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 10) + "..." : "NOT FOUND");

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Analytics için, isteğe bağlı
};

if (!firebaseConfig.apiKey) {
  console.error(
    "Firebase API Key is missing. Please check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_API_KEY is set correctly and the development server was restarted."
  );
  // Geliştirme ortamında daha belirgin bir hata fırlatabiliriz.
  // if (process.env.NODE_ENV === 'development') {
  //   alert("Firebase API Anahtarı eksik veya yanlış! Lütfen .env.local dosyanızı kontrol edin ve geliştirme sunucusunu yeniden başlatın.");
  // }
}

// Firebase'i başlat
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Storage instance'ı oluşturuldu
// const analytics = getAnalytics(app); // Analytics kullanmıyorsak bu satır da kaldırılabilir veya yorumda bırakılabilir

export { app, auth, db, storage }; // storage export edildi
