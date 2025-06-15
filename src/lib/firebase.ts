
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Analytics kullanmıyorsak kaldırılabilir
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Firebase Storage eklendi

// !! TEMPORARY DEBUGGING STEP !!
// Replace the placeholder values below with your ACTUAL Firebase project credentials.
// This is to help diagnose the 'auth/invalid-api-key' error.
// Ensure your .env.local file is correctly set up afterwards if this works.
const firebaseConfig: FirebaseOptions = {
  apiKey: "PLACEHOLDER_API_KEY", // <-- REPLACE THIS WITH YOUR API KEY
  authDomain: "PLACEHOLDER_AUTH_DOMAIN", // e.g., your-project-id.firebaseapp.com
  projectId: "PLACEHOLDER_PROJECT_ID", // e.g., your-project-id
  storageBucket: "PLACEHOLDER_STORAGE_BUCKET", // e.g., your-project-id.appspot.com
  messagingSenderId: "PLACEHOLDER_MESSAGING_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID",
  measurementId: "PLACEHOLDER_MEASUREMENT_ID", // Optional
};

// Comment out or remove the process.env lines for this temporary test:
/*
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
*/

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
// const analytics = getAnalytics(app);

export { app, auth, db, storage };
