
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
import { auth, db, storage } from '@/lib/firebase'; // storage import edildi
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref as storageRefFunction, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"; // Firebase Storage fonksiyonları eklendi
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
  updateUserProfile: (updates: { displayName?: string; photoFile?: File | null }) => Promise<boolean>; // photoFile eklendi
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
            const newUserProfileData: UserData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                diamonds: INITIAL_DIAMONDS,
                createdAt: serverTimestamp() as Timestamp,
                role: "user",
            };
            await setDoc(userDocRef, { ...newUserProfileData, createdAt: serverTimestamp() });
            const freshSnap = await getDoc(userDocRef);
             if (freshSnap.exists()){
                setUserData(freshSnap.data() as UserData);
            } else {
                setUserData({...newUserProfileData, createdAt: Timestamp.now() });
            }
            }
        } catch (error) {
             console.error("[AuthContext] Error fetching/creating user document on auth state change:", error);
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
            setUserData({...userDataToSet, createdAt: Timestamp.now()} as UserData);
        }
    } catch (error) {
        console.error("[AuthContext] Error in createUserDocument:", error);
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
      console.error("[AuthContext] Signup error:", error, "Code:", error.code);
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
      console.error("[AuthContext] Login error:", error.code, error.message);
      let message = `Giriş sırasında bir hata oluştu. (Kod: ${error.code || 'Bilinmiyor'}) Lütfen daha sonra tekrar deneyin veya konsolu kontrol edin.`;
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
      console.error("[AuthContext] Google sign-in error:", error);
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
      console.error("[AuthContext] Logout error:", error);
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const updateUserProfile = async (updates: { displayName?: string; photoFile?: File | null }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return false;
    }
    setIsUserLoading(true);
    console.log("[AuthContext] Attempting profile update for user:", auth.currentUser.uid, "with updates:", { displayName: updates.displayName, photoFileName: updates.photoFile?.name });
    
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string; photoURL?: string | null } = {}; // photoURL eklendi
    let newPhotoURL: string | null = null;

    try {
      // 1. Fotoğraf Yükleme (eğer varsa)
      if (updates.photoFile) {
        console.log("[AuthContext] Photo file provided, starting upload:", updates.photoFile.name);
        const fileExtension = updates.photoFile.name.split('.').pop();
        const imageFileName = `profile_${auth.currentUser.uid}_${Date.now()}.${fileExtension}`;
        const imageRef = storageRefFunction(storage, `profile_pictures/${auth.currentUser.uid}/${imageFileName}`);
        
        if (userData?.photoURL && userData.photoURL.includes("firebasestorage.googleapis.com")) {
            try {
                const previousImageRef = storageRefFunction(storage, userData.photoURL);
                console.log("[AuthContext] Attempting to delete previous profile picture:", userData.photoURL);
                await deleteObject(previousImageRef);
                console.log("[AuthContext] Previous profile picture deleted successfully.");
            } catch (deleteError: any) {
                console.warn("[AuthContext] Could not delete previous profile picture:", deleteError.code, deleteError.message);
            }
        }


        const uploadTask = uploadBytesResumable(imageRef, updates.photoFile);

        newPhotoURL = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("[AuthContext] Upload is " + progress + "% done");
            },
            (error) => {
              console.error("[AuthContext] Firebase Storage upload error:", error.code, error.message, error.serverResponse);
              toast({
                title: "Fotoğraf Yükleme Hatası",
                description: `Yükleme sırasında bir sorun oluştu: ${error.code || error.message}`,
                variant: "destructive",
              });
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("[AuthContext] File available at", downloadURL);
                resolve(downloadURL);
              } catch (urlError: any) {
                console.error("[AuthContext] Error getting download URL:", urlError.code, urlError.message);
                toast({
                  title: "Fotoğraf URL Hatası",
                  description: `URL alınırken bir sorun oluştu: ${urlError.code || urlError.message}`,
                  variant: "destructive",
                });
                reject(urlError);
              }
            }
          );
        });
        console.log("[AuthContext] New photo URL obtained:", newPhotoURL);
        authUpdates.photoURL = newPhotoURL;
        firestoreUpdates.photoURL = newPhotoURL;
      } else {
         if (updates.photoFile === null && userData?.photoURL) {
            console.log("[AuthContext] User requested to remove profile picture.");
             if (userData.photoURL.includes("firebasestorage.googleapis.com")) {
                try {
                    const imageToDeleteRef = storageRefFunction(storage, userData.photoURL);
                    await deleteObject(imageToDeleteRef);
                    console.log("[AuthContext] Profile picture deleted from storage.");
                } catch (deleteError: any) {
                    console.warn("[AuthContext] Could not delete profile picture from storage:", deleteError.code, deleteError.message);
                }
            }
            authUpdates.photoURL = null; 
            firestoreUpdates.photoURL = null; 
         }
      }


      const currentDisplayName = userData?.displayName || auth.currentUser.displayName || "";
      if (updates.displayName && updates.displayName.trim() !== currentDisplayName) {
          if(updates.displayName.trim().length < 3){
              toast({ title: "Hata", description: "Kullanıcı adı en az 3 karakter olmalıdır.", variant: "destructive" });
              setIsUserLoading(false);
              return false; 
          }
          console.log("[AuthContext] Display name update provided:", updates.displayName);
          authUpdates.displayName = updates.displayName.trim();
          firestoreUpdates.displayName = updates.displayName.trim();
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
      
      await auth.currentUser?.reload(); 
      const refreshedUser = auth.currentUser;

      setUserData(prev => {
          if (!prev) return null;
          const newLocalData: Partial<UserData> = {};
          if (firestoreUpdates.displayName) newLocalData.displayName = firestoreUpdates.displayName;
          if (firestoreUpdates.hasOwnProperty('photoURL')) newLocalData.photoURL = firestoreUpdates.photoURL; 

          if (refreshedUser?.displayName && !newLocalData.displayName) newLocalData.displayName = refreshedUser.displayName;
          if (refreshedUser?.photoURL !== undefined && !newLocalData.hasOwnProperty('photoURL')) newLocalData.photoURL = refreshedUser.photoURL;

          return { ...prev, ...newLocalData };
      });
       if (refreshedUser) {
        setCurrentUser({ ...refreshedUser });
      }


      console.log("[AuthContext] Profile update successful.");
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("[AuthContext] General profile update failed:", error.code, error.message, error);
      toast({ 
        title: "Profil Güncelleme Hatası", 
        description: `Genel bir sorun oluştu: ${error.code || error.message}`, 
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
      return Promise.resolve();
    } catch (error) {
      console.error("[AuthContext] Error updating diamonds:", error);
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
