
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Bu doğrudan yapılandırma SADECE HATA AYIKLAMA AMAÇLIDIR.
// Sorun çözüldüğünde .env.local dosyasını kullanmaya geri dönün.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBrLeD1sq3p7NtSvPugatN9on052o_An2w",
  authDomain: "yeniapp-2ecdf.firebaseapp.com",
  // databaseURL: "https://yeniapp-2ecdf-default-rtdb.firebaseio.com", // Auth ve Firestore için zorunlu değil
  projectId: "yeniapp-2ecdf",
  storageBucket: "yeniapp-2ecdf.appspot.com", // Genellikle .appspot.com ile biter, konsoldaki değeri kontrol edin. Eğer .firebasestorage.app ise onu kullanın.
  messagingSenderId: "918568967257",
  appId: "1:918568967257:web:ae5f8725854a8687fe6548",
  // measurementId: "G-LLEDFMDGQR" // Auth ve Firestore için zorunlu değil
};

// Ortam değişkenlerinden okuma bölümü geçici olarak kaldırıldı.
// const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
// const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
// const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
// const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
// const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
// const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
//   console.error("---------------------------------------------------------------------");
//   console.error("Firebase Yapılandırma Hatası! (src/lib/firebase.ts)");
//   console.error("Bir veya daha fazla Firebase ortam değişkeni eksik veya boş.");
//   console.error("Lütfen .env.local dosyanızdaki tüm NEXT_PUBLIC_FIREBASE_... değişkenlerinin doğru şekilde ayarlandığından emin olun:");
//   if (!apiKey) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_API_KEY");
//   if (!authDomain) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
//   if (!projectId) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_PROJECT_ID");
//   if (!storageBucket) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
//   if (!messagingSenderId) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
//   if (!appId) console.error("Eksik/Boş: NEXT_PUBLIC_FIREBASE_APP_ID");
//   console.error("Değişikliklerden sonra geliştirme sunucusunu yeniden başlattığınızdan emin olun.");
//   console.error("---------------------------------------------------------------------");
// }

// const firebaseConfigUsingEnv: FirebaseOptions = {
//   apiKey: apiKey,
//   authDomain: authDomain,
//   projectId: projectId,
//   storageBucket: storageBucket,
//   messagingSenderId: messagingSenderId,
//   appId: appId,
// };

// Firebase'i başlat
let app;
if (!getApps().length) {
  // app = initializeApp(firebaseConfigUsingEnv); // Ortam değişkenleri yerine doğrudan config kullanılıyor
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
