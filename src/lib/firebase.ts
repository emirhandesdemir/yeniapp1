// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration using the latest details provided.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBrLeD1sq3p7NtSvPugatN9on052o_An2w",
  authDomain: "yeniapp-2ecdf.firebaseapp.com",
  databaseURL: "https://yeniapp-2ecdf-default-rtdb.firebaseio.com",
  projectId: "yeniapp-2ecdf",
  storageBucket: "yeniapp-2ecdf.firebasestorage.app", // Using user-provided value. Standard is often .appspot.com but respecting direct input.
  messagingSenderId: "918568967257",
  appId: "1:918568967257:web:101ff6a20723011cfe6548",
  measurementId: "G-CW2QFPWJ7F"
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
