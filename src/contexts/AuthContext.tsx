
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile, // Renamed to avoid conflict
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // db import edildi
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore"; // Firestore fonksiyonları import edildi
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const INITIAL_DIAMONDS = 10; // Yeni kullanıcılar için başlangıç elmas miktarı

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  diamonds: number;
  createdAt: Timestamp;
}

interface AuthContextType {
  currentUser: User | null; // Firebase Auth kullanıcısı
  userData: UserData | null; // Firestore'dan gelen kullanıcı verileri (elmas vb.)
  loading: boolean; // Genel Auth yükleme durumu
  isUserLoading: boolean; // Kullanıcı işlemi yükleme durumu (login, signup vb.)
  isUserDataLoading: boolean; // Firestore kullanıcı verisi yükleme durumu
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string, photoURL?: string }) => Promise<void>; // Auth profilini günceller
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>; // Sadece elmasları günceller
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // Auth state yüklenmesi
  const [isUserLoading, setIsUserLoading] = useState(false); // Giriş/kayıt gibi işlemler için
  const [isUserDataLoading, setIsUserDataLoading] = useState(true); // Firestore'dan veri çekme
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
        } else {
          // Google ile ilk kez giriş yapan veya eski kullanıcı için belge yoksa oluştur
          const newUserProfileData: UserData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            diamonds: INITIAL_DIAMONDS,
            createdAt: serverTimestamp() as Timestamp, // Firestore'a yazarken serverTimestamp() kullanılacak
          };
          try {
            await setDoc(userDocRef, { // serverTimestamp() doğru kullanımı için setDoc içinde tekrar yazıldı
              ...newUserProfileData,
              createdAt: serverTimestamp() 
            });
            // Firestore'dan okurken Timestamp nesnesi gelecek, setDoc sonrası hemen kullanmak için düzeltme
            const freshSnap = await getDoc(userDocRef);
            if (freshSnap.exists()){
                setUserData(freshSnap.data() as UserData);
            } else {
                 // Bu durum pek olası değil ama güvenlik için
                setUserData({...newUserProfileData, createdAt: Timestamp.now() });
            }

          } catch (error) {
            console.error("Error creating user document in Firestore:", error);
            toast({ title: "Kullanıcı Verisi Hatası", description: "Kullanıcı verileri oluşturulurken bir sorun oluştu.", variant: "destructive" });
          }
        }
        setIsUserDataLoading(false);
      } else {
        setUserData(null);
        setIsUserDataLoading(false);
      }
      setLoading(false); // Auth state yüklemesi bitti
    });
    return unsubscribe;
  }, [toast]);

  const createUserDocument = async (user: User, username?: string) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDataToSet: Omit<UserData, 'createdAt'> & { createdAt: any } = { // serverTimestamp için any
      uid: user.uid,
      email: user.email,
      displayName: username || user.displayName,
      photoURL: user.photoURL,
      diamonds: INITIAL_DIAMONDS,
      createdAt: serverTimestamp(),
    };
    await setDoc(userDocRef, userDataToSet);
    // userData state'ini güncellemek için, serverTimestamp'ın çözümlenmiş halini almamız gerekebilir.
    // onAuthStateChanged bunu zaten yapıyor, bu yüzden burada tekrar setlemeye gerek yok.
    const docSnap = await getDoc(userDocRef); // serverTimestamp çözüldükten sonra oku
    if (docSnap.exists()) {
      setUserData(docSnap.data() as UserData);
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(userCredential.user, { displayName: username });
      await createUserDocument(userCredential.user, username); // Firestore'a kullanıcı belgesi oluştur
      // setCurrentUser ve setUserData onAuthStateChanged tarafından halledilecek
      router.push('/');
      toast({ title: "Başarılı!", description: "Hesabınız oluşturuldu ve giriş yapıldı." });
    } catch (error: any) {
      console.error("Signup error:", error, "Code:", error.code);
      let message = "Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin ve tekrar deneyin.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Bu e-posta adresi zaten kullanımda.";
      } else if (error.code === 'auth/weak-password') {
        message = "Şifre çok zayıf. Lütfen en az 6 karakterli daha güçlü bir şifre seçin.";
      } else if (error.code === 'auth/invalid-email') {
        message = "Geçersiz e-posta adresi formatı.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "E-posta/Şifre ile kimlik doğrulama Firebase projenizde etkinleştirilmemiş. Lütfen Firebase konsolundan bu ayarı etkinleştirin.";
      }
      toast({ title: "Kayıt Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const logIn = async (email: string, password: string) => {
    setIsUserLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Kullanıcı ve kullanıcı verisi onAuthStateChanged tarafından yüklenecek
      router.push('/');
      toast({ title: "Başarılı!", description: "Giriş yapıldı." });
    } catch (error: any) {
      console.error("Login error:", error);
      let message = "Giriş sırasında bir hata oluştu.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-posta veya şifre hatalı.";
      }
      toast({ title: "Giriş Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsUserLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Firestore'da kullanıcı belgesini kontrol et/oluştur
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await createUserDocument(user);
      }
      // Kullanıcı ve kullanıcı verisi onAuthStateChanged tarafından yüklenecek/güncellenecek
      router.push('/');
      toast({ title: "Başarılı!", description: "Google ile giriş yapıldı." });
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      let message = "Google ile giriş sırasında bir hata oluştu.";
      if (error.code === 'auth/popup-closed-by-user') {
        message = "Giriş penceresi kapatıldı.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        message = "Giriş isteği iptal edildi.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        message = "Bu e-posta adresiyle zaten bir hesap mevcut, ancak farklı bir giriş yöntemiyle. Lütfen diğer yöntemle giriş yapmayı deneyin.";
      }
      toast({ title: "Google Giriş Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const logOut = async () => {
    setIsUserLoading(true);
    try {
      await signOut(auth);
      // setCurrentUser ve setUserData onAuthStateChanged tarafından null'a çekilecek
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };
  
  const updateUserProfile = async (updates: { displayName?: string, photoURL?: string }) => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return;
    }
    setIsUserLoading(true);
    try {
      await updateFirebaseProfile(auth.currentUser, updates); // Firebase Auth profilini güncelle
      // Firestore kullanıcı belgesini de güncelle (displayName, photoURL)
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const firestoreUpdates: Partial<UserData> = {};
      if(updates.displayName) firestoreUpdates.displayName = updates.displayName;
      if(updates.photoURL) firestoreUpdates.photoURL = updates.photoURL;
      
      if(Object.keys(firestoreUpdates).length > 0){
        await updateDoc(userDocRef, firestoreUpdates);
      }

      // State'leri güncelle
      setCurrentUser(auth.currentUser ? { ...auth.currentUser } : null); // Auth state
      const updatedDocSnap = await getDoc(userDocRef); // Firestore state için yeniden oku
      if (updatedDocSnap.exists()) {
        setUserData(updatedDocSnap.data() as UserData);
      }

      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({ title: "Profil Güncelleme Hatası", description: "Profil güncellenirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const updateUserDiamonds = async (newDiamondCount: number) => {
    if (!currentUser || !userData) {
      toast({ title: "Hata", description: "Elmaslar güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return Promise.reject("Kullanıcı bulunamadı");
    }
    setIsUserLoading(true);
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { diamonds: newDiamondCount });
      setUserData(prev => prev ? { ...prev, diamonds: newDiamondCount } : null);
      // toast({ title: "Elmaslar Güncellendi", description: `Yeni elmas bakiyeniz: ${newDiamondCount}` }); // İsteğe bağlı, her işlemde gösterilmeyebilir.
      return Promise.resolve();
    } catch (error) {
      console.error("Error updating diamonds:", error);
      toast({ title: "Elmas Güncelleme Hatası", description: "Elmaslar güncellenirken bir sorun oluştu.", variant: "destructive" });
      return Promise.reject(error);
    } finally {
      setIsUserLoading(false);
    }
  };

  if (loading || isUserDataLoading) { // Auth state veya Firestore user data yükleniyorsa
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Kullanıcı verileri yükleniyor...</p>
      </div>
    );
  }

  const value = {
    currentUser,
    userData,
    loading: loading, // Bu genel auth state yüklemesi için
    isUserLoading, // Bu login/signup gibi kullanıcı aksiyonları için
    isUserDataLoading, // Firestore user data yüklemesi
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    updateUserDiamonds,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

