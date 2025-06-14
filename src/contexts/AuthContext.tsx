
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
import { auth, db, storage } from '@/lib/firebase'; 
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore"; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  updateUserProfile: (updates: { displayName?: string, photoFile?: File | null }) => Promise<boolean>; 
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
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
        } else {
          const newUserProfileData: UserData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            diamonds: INITIAL_DIAMONDS,
            createdAt: serverTimestamp() as Timestamp, 
            role: "user", 
          };
          try {
            await setDoc(userDocRef, { 
              ...newUserProfileData,
              createdAt: serverTimestamp() 
            });
            const freshSnap = await getDoc(userDocRef);
            if (freshSnap.exists()){
                setUserData(freshSnap.data() as UserData);
            } else {
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
    await setDoc(userDocRef, userDataToSet);
    const docSnap = await getDoc(userDocRef); 
    if (docSnap.exists()) {
      setUserData(docSnap.data() as UserData);
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
  
  const updateUserProfile = async (updates: { displayName?: string, photoFile?: File | null }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return false;
    }
    setIsUserLoading(true);
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string; photoURL?: string } = {};

    try {
      if (updates.photoFile) {
        const file = updates.photoFile;
        const fileExtension = file.name.split('.').pop();
        const profileImageRef = storageRef(storage, `profile_pictures/${auth.currentUser.uid}/profileImage.${fileExtension}`);
        
        const uploadTask = uploadBytesResumable(profileImageRef, file);
        
        // Wait for the upload to complete
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => { /* Optional: Handle progress */ },
            (error) => {
              console.error("Image upload error:", error);
              toast({ title: "Fotoğraf Yükleme Hatası", description: "Fotoğraf yüklenirken bir sorun oluştu: " + error.message, variant: "destructive" });
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                authUpdates.photoURL = downloadURL;
                firestoreUpdates.photoURL = downloadURL;
                resolve();
              } catch (urlError: any) {
                console.error("Error getting download URL:", urlError);
                toast({ title: "Fotoğraf URL Hatası", description: "Yüklenen fotoğrafın adresi alınamadı: " + urlError.message, variant: "destructive" });
                reject(urlError);
              }
            }
          );
        });
      }

      if (updates.displayName && updates.displayName !== (userData?.displayName || auth.currentUser.displayName || "")) {
        authUpdates.displayName = updates.displayName;
        firestoreUpdates.displayName = updates.displayName;
      }

      // Only proceed if there are actual changes to apply
      const hasAuthUpdates = Object.keys(authUpdates).length > 0;
      const hasFirestoreUpdates = Object.keys(firestoreUpdates).length > 0;

      if (!hasAuthUpdates && !hasFirestoreUpdates) {
        // No actual changes were processed (e.g. photo upload failed before setting URLs, or display name was the same)
        // If photo upload failed, a toast was already shown. If only display name was the same, it's not an error.
        // toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        return true; // Considered "successful" as there was nothing to do or failure was handled.
      }

      if (hasAuthUpdates && auth.currentUser) { // Double check auth.currentUser
        await updateFirebaseProfile(auth.currentUser, authUpdates);
      }
      
      if (hasFirestoreUpdates) {
        await updateDoc(userDocRef, firestoreUpdates);
      }
      
      // Manually trigger a refresh of the user object to get the latest photoURL/displayName from Auth
      // This is important because onAuthStateChanged might not fire immediately or might provide a cached user.
      await auth.currentUser?.reload();
      const refreshedUser = auth.currentUser; // Get the reloaded user

      setCurrentUser(refreshedUser ? { ...refreshedUser } : null); 
      setUserData(prev => {
          const newLocalData: Partial<UserData> = {};
          if (firestoreUpdates.displayName) newLocalData.displayName = firestoreUpdates.displayName;
          if (firestoreUpdates.photoURL) newLocalData.photoURL = firestoreUpdates.photoURL;
          // If displayName came from refreshedUser and not in firestoreUpdates (e.g. only photo was in firestoreUpdates)
          if (refreshedUser?.displayName && !newLocalData.displayName) newLocalData.displayName = refreshedUser.displayName;
          if (refreshedUser?.photoURL && !newLocalData.photoURL) newLocalData.photoURL = refreshedUser.photoURL;
          
          return prev ? { ...prev, ...newLocalData } : null
      });

      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("Profile update error (outer catch):", error);
      // Avoid double-toasting if a specific upload error was already shown
      if (!(error.message?.includes("Fotoğraf yüklenirken") || error.message?.includes("adresi alınamadı"))) {
          toast({ title: "Profil Güncelleme Hatası", description: "Profil güncellenirken bir sorun oluştu: " + error.message, variant: "destructive" });
      }
      return false;
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
