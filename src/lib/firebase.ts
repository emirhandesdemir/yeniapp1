// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAUPc1suCoz5DtJb9v2BA9qG2QZ_0h-eHs",
  authDomain: "yeni-tinder.firebaseapp.com",
  projectId: "yeni-tinder",
  storageBucket: "yeni-tinder.firebasestorage.app", // Kullanıcının verdiği değer
  messagingSenderId: "584052934053",
  appId: "1:584052934053:web:c20a004d9b3bf39358144c",
  measurementId: "G-BW4XTD8TRQ"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

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
