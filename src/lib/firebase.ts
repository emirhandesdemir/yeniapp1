
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Gelecekte Firestore kullanırsanız ekleyin

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
  console.error("---------------------------------------------------------------------");
  console.error("Firebase Yapılandırma Hatası!");
  console.error("Bir veya daha fazla Firebase ortam değişkeni eksik.");
  console.error("Lütfen .env.local dosyanızdaki tüm NEXT_PUBLIC_FIREBASE_... değişkenlerinin ayarlandığından emin olun.");
  if (!apiKey) console.error("Eksik: NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain) console.error("Eksik: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!projectId) console.error("Eksik: NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!storageBucket) console.error("Eksik: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!messagingSenderId) console.error("Eksik: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!appId) console.error("Eksik: NEXT_PUBLIC_FIREBASE_APP_ID");
  console.error("Değişikliklerden sonra geliştirme sunucusunu yeniden başlattığınızdan emin olun.");
  console.error("---------------------------------------------------------------------");
  // Firebase, eksik veya geçersiz değerlerle başlatılırsa kendi özel hatasını (örn: auth/invalid-api-key) verecektir.
  // Yukarıdaki konsol günlükleri, sorunu .env.local dosyanızda bulmanıza yardımcı olmalıdır.
}

const firebaseConfig: FirebaseOptions = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
};

// Firebase'i başlat
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
// const db = getFirestore(app); // Firestore kullanacaksanız

export { app, auth /*, db */ };
