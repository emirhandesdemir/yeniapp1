
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Removed storage import as it's not used here anymore
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
// Removed storageRef, uploadBytesResumable, getDownloadURL as they are no longer used for profile pictures here
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const INITIAL_DIAMONDS = 10;

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  diamonds: number;
  createdAt: Timestamp;
  role?: "admin" | "user";
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  isUserLoading: boolean;
  isUserDataLoading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string }) => Promise<boolean>; // Removed photoFile
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
            } else {
            // This case should ideally be handled during sign-up or first Google sign-in
            // For robustness, we can try to create it here if it's missing
            const newUserProfileData: UserData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                diamonds: INITIAL_DIAMONDS,
                createdAt: serverTimestamp() as Timestamp, // This will be a server-side timestamp
                role: "user",
            };
            await setDoc(userDocRef, { ...newUserProfileData, createdAt: serverTimestamp() });
            // Fetch again to get the server-generated timestamp or use local for immediate UI
            const freshSnap = await getDoc(userDocRef);
             if (freshSnap.exists()){
                setUserData(freshSnap.data() as UserData);
            } else {
                // Fallback if re-fetch fails, use local timestamp for UI consistency
                setUserData({...newUserProfileData, createdAt: Timestamp.now() });
            }
            }
        } catch (error) {
             console.error("Error fetching/creating user document on auth state change:", error);
             toast({ title: "Kullanıcı Verisi Yükleme Hatası", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
        } finally {
            setIsUserDataLoading(false);
        }
      } else {
        setUserData(null);
        setIsUserDataLoading(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [toast]);

  const createUserDocument = async (user: User, username?: string) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDataToSet: Omit<UserData, 'createdAt'> & { createdAt: any } = {
      uid: user.uid,
      email: user.email,
      displayName: username || user.displayName,
      photoURL: user.photoURL,
      diamonds: INITIAL_DIAMONDS,
      createdAt: serverTimestamp(),
      role: "user",
    };
    try {
        await setDoc(userDocRef, userDataToSet);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
        setUserData(docSnap.data() as UserData);
        } else {
             // Fallback if docSnap doesn't exist immediately (should be rare)
            setUserData({...userDataToSet, createdAt: Timestamp.now()} as UserData);
        }
    } catch (error) {
        console.error("Error in createUserDocument:", error);
        toast({ title: "Hesap Oluşturma Hatası", description: "Kullanıcı veritabanı kaydı oluşturulurken bir sorun oluştu.", variant: "destructive" });
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(userCredential.user, { displayName: username });
      await createUserDocument(userCredential.user, username);
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
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await createUserDocument(user);
      }
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
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const updateUserProfile = async (updates: { displayName?: string }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return false;
    }
    setIsUserLoading(true);
    console.log("[AuthContext] Attempting profile update for user:", auth.currentUser.uid, "with updates:", updates);
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string } = {}; // photoURL update removed

    try {
      if (updates.displayName && updates.displayName !== (userData?.displayName || auth.currentUser.displayName || "")) {
        console.log("[AuthContext] Display name update provided:", updates.displayName);
        authUpdates.displayName = updates.displayName;
        firestoreUpdates.displayName = updates.displayName;
      }

      const hasAuthUpdates = Object.keys(authUpdates).length > 0;
      const hasFirestoreUpdates = Object.keys(firestoreUpdates).length > 0;

      if (!hasAuthUpdates && !hasFirestoreUpdates) {
        console.log("[AuthContext] No actual changes to apply to profile.");
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        setIsUserLoading(false);
        return true;
      }

      if (hasAuthUpdates && auth.currentUser) {
        console.log("[AuthContext] Updating Firebase Auth profile with:", authUpdates);
        await updateFirebaseProfile(auth.currentUser, authUpdates);
      }

      if (hasFirestoreUpdates) {
        console.log("[AuthContext] Updating Firestore user document with:", firestoreUpdates);
        await updateDoc(userDocRef, firestoreUpdates);
      }

      console.log("[AuthContext] Reloading Firebase user data...");
      await auth.currentUser?.reload(); // Reload to get the latest auth profile
      const refreshedUser = auth.currentUser; // Get the refreshed user

      // Update local state based on refreshedUser and firestoreUpdates
      setCurrentUser(refreshedUser ? { ...refreshedUser } : null); // Update currentUser state
      setUserData(prev => {
          const newLocalData: Partial<UserData> = {};
          if (firestoreUpdates.displayName) newLocalData.displayName = firestoreUpdates.displayName;
          // Ensure local state reflects Auth profile if Firestore didn't update it (or vice-versa)
          if (refreshedUser?.displayName && !newLocalData.displayName) newLocalData.displayName = refreshedUser.displayName;
          
          return prev ? { ...prev, ...newLocalData } : null
      });


      console.log("[AuthContext] Profile update successful.");
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("[AuthContext] Profile update failed:", error);
      toast({ 
        title: "Profil Güncelleme Hatası", 
        description: `Bir sorun oluştu: ${error.code || error.message}`, 
        variant: "destructive" 
      });
      return false;
    } finally {
      console.log("[AuthContext] Profile update process finished. Setting isUserLoading to false.");
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
      // toast({ title: "Başarılı", description: "Elmaslarınız güncellendi." }); // Optional: Can be too noisy
      return Promise.resolve();
    } catch (error) {
      console.error("Error updating diamonds:", error);
      toast({ title: "Elmas Güncelleme Hatası", description: "Elmaslar güncellenirken bir sorun oluştu.", variant: "destructive" });
      return Promise.reject(error);
    } finally {
      setIsUserLoading(false);
    }
  };

  if (loading || (currentUser && isUserDataLoading)) {
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
    loading: loading,
    isUserLoading,
    isUserDataLoading,
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    updateUserDiamonds,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
