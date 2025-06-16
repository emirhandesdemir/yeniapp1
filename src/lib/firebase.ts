// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAUPc1suCoz5DtJb9v2BA9qG2QZ_0h-eHs",
  authDomain: "yeni-tinder.firebaseapp.com",
  projectId: "yeni-tinder",
  storageBucket: "yeni-tinder.firebasestorage.app", // Kullanıcının belirttiği değer
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

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Initialize Analytics only on the client side and if measurementId is present
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    try {
      analytics = getAnalytics(app);
    } catch (error) {
      console.error("Firebase Analytics başlatma hatası:", error);
      // analytics null olarak kalacak
    }
  } else if (typeof window !== 'undefined' && !firebaseConfig.measurementId) {
    console.warn("Firebase Analytics: measurementId, firebaseConfig içinde tanımlanmamış. Analytics başlatılmayacak.");
  }
} catch (error) {
  console.error("Firebase başlatma sırasında genel hata oluştu:", error);
  // Hata durumunda app, auth, db, storage değişkenleri tanımsız kalabilir.
  // Uygulamanın bu durumu uygun şekilde işlemesi gerekebilir.
}

export { app, auth, db, storage, analytics };
