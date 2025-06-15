
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Eğer kullanmıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

// !! GEÇİCİ HATA AYIKLAMA İÇİN DOĞRUDAN YAPI LANDIRMA !!
// LÜTFEN AŞAĞIDAKİ YER TUTUCULARI KENDİ GERÇEK FIREBASE PROJE BİLGİLERİNİZLE DEĞİŞTİRİN!
// BU UZUN VADELİ BİR ÇÖZÜM DEĞİLDİR VE GÜVENLİK RİSKİ OLUŞTURUR.
// SORUNU ÇÖZDÜKTEN SONRA .env.local DOSYASINI KULLANMAYA GERİ DÖNÜN.
const firebaseConfig: FirebaseOptions = {
  apiKey: "YOUR_API_KEY_HERE", // Firebase Proje Ayarları > Genel > Web API anahtarı
  authDomain: "YOUR_AUTH_DOMAIN_HERE", // örn: projeniz-id.firebaseapp.com
  projectId: "YOUR_PROJECT_ID_HERE", // örn: projeniz-id
  storageBucket: "YOUR_STORAGE_BUCKET_HERE", // örn: projeniz-id.appspot.com
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE",
  measurementId: "YOUR_MEASUREMENT_ID_HERE", // Bu isteğe bağlıdır, G- ile başlar
};

// Normalde .env.local dosyasından okunması gereken yapılandırma:
// const firebaseConfig: FirebaseOptions = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
//   measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
// };

// Firebase'i başlat
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// const analytics = getAnalytics(app); // Eğer kullanmıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

export { app, auth, db, storage };
