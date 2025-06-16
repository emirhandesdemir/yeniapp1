
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
import { ref as storageRefFunction, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
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
  createdAt: Timestamp; // Expect a Firestore Timestamp object here for consistent data type
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
  updateUserProfile: (updates: { displayName?: string; photoFile?: File | null }) => Promise<boolean>;
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
  const [isUserLoading, setIsUserLoading] = useState(false); // For async auth operations like login/signup
  const [isUserDataLoading, setIsUserDataLoading] = useState(true); // For fetching/creating user data from Firestore
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("[AuthContext] onAuthStateChanged triggered. User:", user ? user.uid : null);
      setCurrentUser(user);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                console.log(`[AuthContext] User document found for ${user.uid}. Data:`, docSnap.data());
                setUserData(docSnap.data() as UserData);
            } else {
                console.log(`[AuthContext] User document for ${user.uid} (email: ${user.email}, displayName: ${user.displayName}) not found. Attempting to create.`);
                const dataToSet = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    diamonds: INITIAL_DIAMONDS,
                    role: "user" as "user" | "admin",
                    createdAt: serverTimestamp(),
                };

                try {
                    await setDoc(userDocRef, dataToSet);
                    console.log(`[AuthContext] Successfully initiated user document creation for ${user.uid}. Fetching document after creation...`);
                    
                    // Attempt to get the document again to ensure serverTimestamp is resolved if possible, or use client-side as fallback
                    const freshSnap = await getDoc(userDocRef);
                    if (freshSnap.exists()) {
                        console.log(`[AuthContext] User document for ${user.uid} confirmed exists after creation. Data:`, freshSnap.data());
                        setUserData(freshSnap.data() as UserData);
                    } else {
                        console.warn(`[AuthContext] User document for ${user.uid} NOT found immediately after setDoc. This is unexpected. Using fallback with client-side timestamp.`);
                        // Fallback to client-side timestamp if server timestamp isn't immediately available or fetch fails
                        const fallbackUserData: UserData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            diamonds: INITIAL_DIAMONDS,
                            role: "user",
                            createdAt: Timestamp.now(), 
                        };
                        setUserData(fallbackUserData);
                        toast({
                            title: "Kullanıcı Verisi Senkronizasyonu",
                            description: "Kullanıcı bilgileriniz oluşturuldu ancak anlık senkronizasyonda bir gecikme olabilir.",
                        });
                    }
                } catch (creationError: any) {
                    console.error(`[AuthContext] CRITICAL: Failed to create user document for ${user.uid} in onAuthStateChanged:`, creationError.message, creationError.code, creationError.stack);
                    toast({
                        title: "Veritabanı Kayıt Hatası",
                        description: `Kullanıcı bilgileriniz veritabanına kaydedilemedi (Hata: ${creationError.message}). Lütfen tekrar deneyin veya destek ile iletişime geçin.`,
                        variant: "destructive",
                    });
                    setUserData(null); // Clear user data on critical failure
                }
            }
        } catch (error: any) {
             console.error("[AuthContext] Error fetching/creating user document on auth state change:", error.message, error.code, error.stack);
             toast({ title: "Kullanıcı Verisi Yükleme Hatası", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
             setUserData(null); // Clear user data on error
        } finally {
            console.log(`[AuthContext] Finished processing user data for ${user ? user.uid : 'null user'}. Setting isUserDataLoading to false.`);
            setIsUserDataLoading(false);
        }
      } else {
        console.log("[AuthContext] No user authenticated. Clearing user data.");
        setUserData(null);
        setIsUserDataLoading(false);
      }
      console.log("[AuthContext] Auth state processing finished. Setting loading to false.");
      setLoading(false);
    });
    return unsubscribe;
  }, [toast]); // Added toast to dependency array as it's used inside the effect

  const createUserDocument = async (user: User, username?: string) => {
    const userDocRef = doc(db, "users", user.uid);
    // Prepare data, ensuring serverTimestamp is only used for setDoc and not prematurely resolved
    const dataToSetForLog = { 
      uid: user.uid, 
      email: user.email, 
      displayName: username || user.displayName, 
      photoURL: user.photoURL, 
      diamonds: INITIAL_DIAMONDS, 
      role: "user" as "user" | "admin",
      createdAt: "serverTimestamp()" // For logging purposes
    };
    console.log(`[AuthContext] createUserDocument called for ${user.uid}. Data to set (actual createdAt will be serverTimestamp):`, dataToSetForLog);
    
    try {
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: username || user.displayName,
            photoURL: user.photoURL,
            diamonds: INITIAL_DIAMONDS,
            role: "user",
            createdAt: serverTimestamp(),
        });
        console.log(`[AuthContext] Successfully initiated user document creation via createUserDocument for ${user.uid}. Fetching document after creation...`);
        
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            console.log(`[AuthContext] User document for ${user.uid} confirmed exists after createUserDocument. Data:`, docSnap.data());
            setUserData(docSnap.data() as UserData);
        } else {
            console.warn(`[AuthContext] User document for ${user.uid} NOT found immediately after setDoc in createUserDocument. Using fallback with client-side timestamp.`);
            const fallbackUserData: UserData = {
                uid: user.uid,
                email: user.email,
                displayName: username || user.displayName,
                photoURL: user.photoURL,
                diamonds: INITIAL_DIAMONDS,
                role: "user",
                createdAt: Timestamp.now(),
            };
            setUserData(fallbackUserData);
             toast({
                title: "Kullanıcı Verisi Senkronizasyonu",
                description: "Kullanıcı bilgileriniz oluşturuldu (CD) ancak anlık senkronizasyonda bir gecikme olabilir.",
            });
        }
    } catch (error: any) {
        console.error(`[AuthContext] CRITICAL: Error in createUserDocument for ${user.uid}:`, error.message, error.code, error.stack);
        toast({ title: "Hesap Detayı Kayıt Hatası", description: `Kullanıcı detayları veritabanına kaydedilemedi (Hata: ${error.message}).`, variant: "destructive" });
        // Optionally, re-throw or handle more gracefully depending on app requirements
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    setIsUserLoading(true);
    console.log(`[AuthContext] Attempting signUp for email: ${email}, username: ${username}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`[AuthContext] Firebase Auth user created: ${userCredential.user.uid}. Updating profile...`);
      await updateFirebaseProfile(userCredential.user, { displayName: username });
      console.log(`[AuthContext] Firebase Auth profile updated for ${userCredential.user.uid}. Creating user document...`);
      await createUserDocument(userCredential.user, username);
      console.log(`[AuthContext] User document process finished for ${userCredential.user.uid}. Navigating to /`);
      router.push('/');
      toast({ title: "Başarılı!", description: "Hesabınız oluşturuldu ve giriş yapıldı." });
    } catch (error: any) {
      console.error("[AuthContext] Signup error:", error.message, "Code:", error.code, error.stack);
      let message = "Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin ve tekrar deneyin.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Bu e-posta adresi zaten kullanımda.";
      } else if (error.code === 'auth/weak-password') {
        message = "Şifre çok zayıf. Lütfen en az 6 karakterli daha güçlü bir şifre seçin.";
      } else if (error.code === 'auth/invalid-email') {
        message = "Geçersiz e-posta adresi formatı.";
      }
      toast({ title: "Kayıt Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const logIn = async (email: string, password: string) => {
    setIsUserLoading(true);
    console.log(`[AuthContext] Attempting logIn for email: ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle fetching user data
      console.log(`[AuthContext] LogIn successful for email: ${email}. Navigating to /`);
      router.push('/');
      toast({ title: "Başarılı!", description: "Giriş yapıldı." });
    } catch (error: any) {
      console.error("[AuthContext] Login error:", error.message, "Code:", error.code, error.stack);
      let message = `Giriş sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.`;
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
    console.log("[AuthContext] Attempting signInWithGoogle.");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log(`[AuthContext] Google sign-in successful for user: ${user.uid}. Checking/creating document...`);
      // onAuthStateChanged will typically handle document creation/fetching, but we can pre-fetch here for quicker UI update
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        console.log(`[AuthContext] User document for Google user ${user.uid} does not exist. Calling createUserDocument (will be picked up by onAuthStateChanged too).`);
        await createUserDocument(user); // This might be redundant if onAuthStateChanged handles it, but ensures quick creation
      } else {
        console.log(`[AuthContext] User document for Google user ${user.uid} already exists. Data:`, docSnap.data());
        // Ensure local state is updated if onAuthStateChanged hasn't fired or completed yet
        setUserData(docSnap.data() as UserData);
      }
      console.log(`[AuthContext] Google sign-in process complete for ${user.uid}. Navigating to /`);
      router.push('/');
      toast({ title: "Başarılı!", description: "Google ile giriş yapıldı." });
    } catch (error: any) { // Added missing opening brace for catch block
      console.error("[AuthContext] Google sign-in error:", error.message, "Code:", error.code, error.stack);
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
    console.log("[AuthContext] Attempting logOut.");
    try {
      await signOut(auth);
      console.log("[AuthContext] LogOut successful. Navigating to /login.");
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      console.error("[AuthContext] Logout error:", error.message, "Code:", error.code, error.stack);
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
    let authUpdates: { displayName?: string; photoURL?: string | null } = {};
    let newPhotoURL: string | null = null;

    try {
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
                if (deleteError.code !== 'storage/object-not-found') { // Don't warn if already deleted
                    console.warn("[AuthContext] Could not delete previous profile picture:", deleteError.code, deleteError.message);
                }
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
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log("[AuthContext] File available at", downloadURL);
                resolve(downloadURL);
              } catch (urlError: any) {
                console.error("[AuthContext] Error getting download URL:", urlError.code, urlError.message);
                reject(urlError);
              }
            }
          );
        });
        console.log("[AuthContext] New photo URL obtained:", newPhotoURL);
        authUpdates.photoURL = newPhotoURL;
        firestoreUpdates.photoURL = newPhotoURL;
      } else if (updates.photoFile === null && userData?.photoURL) { // Explicitly null means remove
            console.log("[AuthContext] User requested to remove profile picture.");
             if (userData.photoURL.includes("firebasestorage.googleapis.com")) {
                try {
                    const imageToDeleteRef = storageRefFunction(storage, userData.photoURL);
                    await deleteObject(imageToDeleteRef);
                    console.log("[AuthContext] Profile picture deleted from storage.");
                } catch (deleteError: any) {
                     if (deleteError.code !== 'storage/object-not-found') {
                        console.warn("[AuthContext] Could not delete profile picture from storage:", deleteError.code, deleteError.message);
                    }
                }
            }
            authUpdates.photoURL = null; 
            firestoreUpdates.photoURL = null; 
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
      
      // It's important to update local state after successful updates
      // Fetching fresh data is best, or selectively update
      const updatedDocSnap = await getDoc(userDocRef);
      if (updatedDocSnap.exists()) {
        setUserData(updatedDocSnap.data() as UserData);
      }
      // Also ensure currentUser reflects changes if displayName/photoURL in Auth changed
      // Firebase Auth's currentUser object might not update immediately, onAuthStateChanged listener handles this best.
      // Triggering a reload of the user can sometimes help, but can also cause complexities.
      // For now, Firestore data update is primary.

      console.log("[AuthContext] Profile update successful.");
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("[AuthContext] General profile update failed:", error.code, error.message, error.stack);
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
    // No need for isUserLoading here as it's a quick Firestore update, unless it's part of a larger user action
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { diamonds: newDiamondCount });
      setUserData(prev => prev ? { ...prev, diamonds: newDiamondCount } : null);
      // toast({ title: "Başarılı", description: "Elmas bakiyeniz güncellendi." }); // Potentially too noisy
      return Promise.resolve();
    } catch (error) {
      console.error("[AuthContext] Error updating diamonds:", error);
      toast({ title: "Elmas Güncelleme Hatası", description: "Elmaslar güncellenirken bir sorun oluştu.", variant: "destructive" });
      return Promise.reject(error);
    }
  };

  // This loading screen is for the initial auth state check and initial user data load
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
    loading, // True until initial onAuthStateChanged completes
    isUserLoading, // True during async auth operations (login, signup, profile update)
    isUserDataLoading, // True when fetching/creating user data for an authenticated user
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    updateUserDiamonds,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
