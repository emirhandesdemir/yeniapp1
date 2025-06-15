// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Eğer kullanmıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

// Your web app's Firebase configuration provided by the user
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBrLeD1sq3p7NtSvPugatN9on052o_An2w",
  authDomain: "yeniapp-2ecdf.firebaseapp.com",
  databaseURL: "https://yeniapp-2ecdf-default-rtdb.firebaseio.com",
  projectId: "yeniapp-2ecdf",
  storageBucket: "yeniapp-2ecdf.firebasestorage.app", // Updated to .firebasestorage.app as per user
  messagingSenderId: "918568967257",
  appId: "1:918568967257:web:ae5f8725854a8687fe6548",
  measurementId: "G-LLEDFMDGQR"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// const analytics = getAnalytics(app); // Eğer kullanmıyorsanız ve hata almıyorsanız bu satırı yorumda bırakabilir veya silebilirsiniz.

export { app, auth, db, storage };
