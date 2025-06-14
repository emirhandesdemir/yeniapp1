
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Analytics kullanmıyorsak kaldırılabilir
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: BU DOĞRUDAN YAPILANDIRMA SADECE HATA AYIKLAMA AMAÇLIYDI.
// BU DEĞİŞİKLİĞİ GERİ ALIP .ENV.LOCAL KULLANMAYA DÖNÜN!
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBrLeD1sq3p7NtSvPugatN9on052o_An2w",
  authDomain: "yeniapp-2ecdf.firebaseapp.com",
  // databaseURL: "https://yeniapp-2ecdf-default-rtdb.firebaseio.com", // Auth ve Firestore için zorunlu değil
  projectId: "yeniapp-2ecdf",
  storageBucket: "yeniapp-2ecdf.appspot.com", // Firebase konsolunuzdaki değeri kontrol edin, .appspot.com veya .firebasestorage.app olabilir
  messagingSenderId: "918568967257",
  appId: "1:918568967257:web:ae5f8725854a8687fe6548",
  // measurementId: "G-LLEDFMDGQR" // Auth ve Firestore için zorunlu değil
};

// Firebase'i başlat
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
// const analytics = getAnalytics(app); // Analytics kullanmıyorsak bu satır da kaldırılabilir veya yorumda bırakılabilir

export { app, auth, db };
