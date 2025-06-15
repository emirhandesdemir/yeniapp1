
// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBrLeD1sq3p7NtSvPugatN9on052o_An2w",
  authDomain: "yeniapp-2ecdf.firebaseapp.com",
  databaseURL: "https://yeniapp-2ecdf-default-rtdb.firebaseio.com",
  projectId: "yeniapp-2ecdf",
  storageBucket: "yeniapp-2ecdf.firebasestorage.app", // Kullanıcının verdiği orijinal değer kullanıldı
  messagingSenderId: "918568967257",
  appId: "1:918568967257:web:ae5f8725854a8687fe6548",
  measurementId: "G-LLEDFMDGQR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  if (firebaseConfig.measurementId) {
    try {
      analytics = getAnalytics(app);
    } catch (error) {
      console.error("Firebase Analytics initialization error:", error);
      // analytics'i null olarak bırak, böylece uygulama çökmeyecek
    }
  } else {
    console.warn("Firebase Analytics: measurementId is not defined in firebaseConfig. Analytics will not be initialized.");
  }
}

export { app, auth, db, storage, analytics };
