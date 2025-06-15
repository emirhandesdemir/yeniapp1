
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Eğer Firebase Analytics kullanmak isterseniz bu yorumu kaldırın ve aşağıdaki analytics değişkenini de etkinleştirin.

// ÖNEMLİ: Aşağıdaki yer tutucu değerleri KENDİ Firebase projenizin GERÇEK bilgileriyle değiştirin!
const firebaseConfig: FirebaseOptions = {
  apiKey: "SENIN_GERCEK_API_ANAHTARIN", // BURAYI DEĞİŞTİR
  authDomain: "SENIN_AUTH_DOMAININ.firebaseapp.com", // BURAYI DEĞİŞTİR
  projectId: "SENIN_PROJE_IDN", // BURAYI DEĞİŞTİR
  storageBucket: "SENIN_STORAGE_BUCKETIN.appspot.com", // BURAYI DEĞİŞTİR
  messagingSenderId: "SENIN_MESSAGING_SENDER_IDN", // BURAYI DEĞİŞTİR
  appId: "SENIN_APP_IDN", // BURAYI DEĞİŞTİR
  databaseURL: "https://SENIN_PROJE_IDN-default-rtdb.firebaseio.com", // BURAYI DEĞİŞTİR (Opsiyonel, Realtime Database kullanıyorsanız)
  measurementId: "G-SENIN_MEASUREMENT_IDN", // BURAYI DEĞİŞTİR (Opsiyonel, Google Analytics kullanıyorsanız)
};

// Initialize Firebase
let app;
if (!getApps().length) {
  // API anahtarı doğrudan yukarıda tanımlandığı için eksiklik kontrolü burada artık gereksiz.
  // Ancak, yine de değerlerin girildiğinden emin olun.
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "SENIN_GERCEK_API_ANAHTARIN") {
    console.error("Firebase API Key is missing or not replaced in src/lib/firebase.ts. Please replace placeholder values with your actual Firebase project credentials.");
    // Uygulamanın bu noktada düzgün çalışmayacağını belirtmek için bir hata fırlatılabilir veya farklı bir işlem yapılabilir.
    // Şimdilik sadece konsola hata basıyoruz.
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// const analytics = getAnalytics(app); // Eğer Firebase Analytics kullanmak isterseniz bu yorumu kaldırın.

export { app, auth, db, storage };
