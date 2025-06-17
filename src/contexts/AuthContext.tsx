
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
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from 'next/navigation';
import { Flame } from 'lucide-react'; // Globe yerine Flame import edildi
import { useToast } from '@/hooks/use-toast';

const INITIAL_DIAMONDS = 10;

export interface PrivacySettings {
  postsVisibleToFriendsOnly?: boolean;
  activeRoomsVisibleToFriendsOnly?: boolean;
  feedShowsEveryone?: boolean;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  diamonds: number;
  createdAt: Timestamp;
  role?: "admin" | "user";
  bio?: string;
  gender?: 'kadın' | 'erkek' | 'belirtilmemiş';
  privacySettings?: PrivacySettings;
  premiumStatus?: 'none' | 'weekly' | 'monthly';
  premiumExpiryDate?: Timestamp | null;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  isUserLoading: boolean;
  isUserDataLoading: boolean;
  signUp: (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; newPhotoURL?: string | null; bio?: string; privacySettings?: PrivacySettings }) => Promise<boolean>;
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: (isOpen: boolean) => void;
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
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
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
                const existingData = docSnap.data() as UserData;
                const updatedData: UserData = {
                    ...existingData,
                    privacySettings: {
                        postsVisibleToFriendsOnly: existingData.privacySettings?.postsVisibleToFriendsOnly ?? false,
                        activeRoomsVisibleToFriendsOnly: existingData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
                        feedShowsEveryone: existingData.privacySettings?.feedShowsEveryone ?? true,
                    },
                    premiumStatus: existingData.premiumStatus ?? 'none',
                    premiumExpiryDate: existingData.premiumExpiryDate ?? null,
                };
                setUserData(updatedData);
            } else {
                console.log(`[AuthContext] User document for ${user.uid} (email: ${user.email}, displayName: ${user.displayName}) not found. Attempting to create.`);
                const dataToSet: UserData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    diamonds: INITIAL_DIAMONDS,
                    role: "user",
                    createdAt: Timestamp.now(), 
                    bio: "",
                    gender: "belirtilmemiş",
                    privacySettings: { 
                        postsVisibleToFriendsOnly: false,
                        activeRoomsVisibleToFriendsOnly: false,
                        feedShowsEveryone: true, 
                    },
                    premiumStatus: 'none',
                    premiumExpiryDate: null,
                };

                try {
                    await setDoc(userDocRef, { ...dataToSet, createdAt: serverTimestamp() });
                    console.log(`[AuthContext] Successfully initiated user document creation for ${user.uid}. Fetching document after creation...`);

                    const freshSnap = await getDoc(userDocRef);
                    if (freshSnap.exists()) {
                        console.log(`[AuthContext] User document for ${user.uid} confirmed exists after creation. Data:`, freshSnap.data());
                        setUserData(freshSnap.data() as UserData);
                    } else {
                        console.warn(`[AuthContext] User document for ${user.uid} NOT found immediately after setDoc. This is unexpected. Using fallback with client-side timestamp.`);
                        setUserData(dataToSet); 
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
                    setUserData(null);
                }
            }
        } catch (error: any) {
             console.error("[AuthContext] Error fetching/creating user document on auth state change:", error.message, error.code, error.stack);
             toast({ title: "Kullanıcı Verisi Yükleme Hatası", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
             setUserData(null);
        } finally {
            console.log(`[AuthContext] Finished processing user data for ${user ? user.uid : 'null user'}. Setting isUserDataLoading to false.`);
            setIsUserDataLoading(false);
        }
      } else {
        console.log("[AuthContext] No user authenticated. Clearing user data.");
        setUserData(null);
        setIsUserDataLoading(false);
        setIsAdminPanelOpen(false);
      }
      console.log("[AuthContext] Auth state processing finished. Setting loading to false.");
      setLoading(false);
    });
    return unsubscribe;
  }, [toast]);

  const createUserDocument = async (user: User, username?: string, gender?: 'kadın' | 'erkek' | 'belirtilmemiş') => {
    const userDocRef = doc(db, "users", user.uid);
    const initialPhotoURL = user.photoURL; 
    const dataToSetForLog: Partial<UserData> & {createdAt: string} = {
      uid: user.uid,
      email: user.email,
      displayName: username || user.displayName,
      photoURL: initialPhotoURL,
      diamonds: INITIAL_DIAMONDS,
      role: "user",
      createdAt: "serverTimestamp()",
      bio: "",
      gender: gender || "belirtilmemiş",
      privacySettings: {
        postsVisibleToFriendsOnly: false,
        activeRoomsVisibleToFriendsOnly: false,
        feedShowsEveryone: true, 
      },
      premiumStatus: 'none',
      premiumExpiryDate: null,
    };
    console.log(`[AuthContext] createUserDocument called for ${user.uid}. Data to set (actual createdAt will be serverTimestamp):`, dataToSetForLog);

    try {
        const dataToSave: UserData = {
            uid: user.uid,
            email: user.email,
            displayName: username || user.displayName,
            photoURL: initialPhotoURL,
            diamonds: INITIAL_DIAMONDS,
            role: "user",
            createdAt: serverTimestamp() as Timestamp, 
            bio: "",
            gender: gender || "belirtilmemiş",
            privacySettings: {
                postsVisibleToFriendsOnly: false,
                activeRoomsVisibleToFriendsOnly: false,
                feedShowsEveryone: true,
            },
            premiumStatus: 'none',
            premiumExpiryDate: null,
        };
        await setDoc(userDocRef, dataToSave);
        console.log(`[AuthContext] Successfully initiated user document creation via createUserDocument for ${user.uid}. Fetching document after creation...`);

        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            console.log(`[AuthContext] User document for ${user.uid} confirmed exists after createUserDocument. Data:`, docSnap.data());
            setUserData(docSnap.data() as UserData);
        } else {
            console.warn(`[AuthContext] User document for ${user.uid} NOT found immediately after setDoc in createUserDocument. Using fallback with client-side timestamp.`);
            const fallbackUserData: UserData = {
                ...dataToSave,
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
    }
  };

  const signUp = async (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => {
    setIsUserLoading(true);
    console.log(`[AuthContext] Attempting signUp for email: ${email}, username: ${username}, gender: ${gender}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`[AuthContext] Firebase Auth user created: ${userCredential.user.uid}. Updating profile...`);
      await updateFirebaseProfile(userCredential.user, { displayName: username, photoURL: null }); // New users start with no photo
      console.log(`[AuthContext] Firebase Auth profile updated for ${userCredential.user.uid}. Creating user document...`);
      await createUserDocument(userCredential.user, username, gender);
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
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        console.log(`[AuthContext] User document for Google user ${user.uid} does not exist. Calling createUserDocument.`);
        await createUserDocument(user, user.displayName || undefined, "belirtilmemiş");
      } else {
        console.log(`[AuthContext] User document for Google user ${user.uid} already exists. Data:`, docSnap.data());
        const firestoreData = docSnap.data() as UserData;
        const updatesToFirestore: Partial<UserData> = {};
        const currentPrivacySettings = firestoreData.privacySettings || {};
        updatesToFirestore.privacySettings = {
            postsVisibleToFriendsOnly: currentPrivacySettings.postsVisibleToFriendsOnly ?? false,
            activeRoomsVisibleToFriendsOnly: currentPrivacySettings.activeRoomsVisibleToFriendsOnly ?? false,
            feedShowsEveryone: currentPrivacySettings.feedShowsEveryone ?? true,
        };
        updatesToFirestore.premiumStatus = firestoreData.premiumStatus ?? 'none';
        updatesToFirestore.premiumExpiryDate = firestoreData.premiumExpiryDate ?? null;


        if (user.displayName && user.displayName !== firestoreData.displayName) {
            updatesToFirestore.displayName = user.displayName;
        }
        if (user.photoURL && user.photoURL !== firestoreData.photoURL) {
            updatesToFirestore.photoURL = user.photoURL;
        } else if (!firestoreData.photoURL && user.photoURL) {
            updatesToFirestore.photoURL = user.photoURL;
        }

        if (firestoreData.bio === undefined) {
            updatesToFirestore.bio = "";
        }
        if (firestoreData.gender === undefined) {
            updatesToFirestore.gender = "belirtilmemiş";
        }
        
        let needsUpdate = false;
        if (updatesToFirestore.displayName) needsUpdate = true;
        if (updatesToFirestore.photoURL) needsUpdate = true;
        if (updatesToFirestore.bio !== undefined) needsUpdate = true;
        if (updatesToFirestore.gender !== undefined) needsUpdate = true;
        if (updatesToFirestore.privacySettings.postsVisibleToFriendsOnly !== (firestoreData.privacySettings?.postsVisibleToFriendsOnly ?? false) ||
            updatesToFirestore.privacySettings.activeRoomsVisibleToFriendsOnly !== (firestoreData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false) ||
            updatesToFirestore.privacySettings.feedShowsEveryone !== (firestoreData.privacySettings?.feedShowsEveryone ?? true)
        ) {
            needsUpdate = true;
        }
        if (updatesToFirestore.premiumStatus !== (firestoreData.premiumStatus ?? 'none')) needsUpdate = true;
        // premiumExpiryDate is usually managed by grants, not by Google sign-in sync

        if (needsUpdate) {
            await updateDoc(userDocRef, updatesToFirestore);
            setUserData({ ...firestoreData, ...updatesToFirestore });
        } else {
            setUserData(firestoreData);
        }
      }
      console.log(`[AuthContext] Google sign-in process complete for ${user.uid}. Navigating to /`);
      router.push('/');
      toast({ title: "Başarılı!", description: "Google ile giriş yapıldı." });
    } catch (error: any) {
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
      setIsAdminPanelOpen(false);
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      console.error("[AuthContext] Logout error:", error.message, "Code:", error.code, error.stack);
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  };

  const updateUserProfile = async (updates: { displayName?: string; newPhotoURL?: string | null; bio?: string; privacySettings?: PrivacySettings }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return false;
    }
    setIsUserLoading(true);
    console.log("[AuthContext] Attempting profile update for user:", auth.currentUser.uid, "with updates:", JSON.stringify(updates));

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string; photoURL?: string | null } = {};

    try {
      const currentDisplayName = userData?.displayName || auth.currentUser.displayName || "";
      if (updates.displayName && updates.displayName.trim() !== currentDisplayName) {
          if(updates.displayName.trim().length < 3){
              toast({ title: "Hata", description: "Kullanıcı adı en az 3 karakter olmalıdır.", variant: "destructive" });
              setIsUserLoading(false);
              return false;
          }
          console.log("[AuthContext] Görünen ad güncellemesi sağlandı:", updates.displayName);
          authUpdates.displayName = updates.displayName.trim();
          firestoreUpdates.displayName = updates.displayName.trim();
      }
      
      const currentPhotoURL = userData?.photoURL || auth.currentUser.photoURL || null;
      if (updates.newPhotoURL !== undefined && updates.newPhotoURL !== currentPhotoURL) {
          console.log("[AuthContext] Fotoğraf URL güncellemesi sağlandı:", updates.newPhotoURL);
          authUpdates.photoURL = updates.newPhotoURL; 
          firestoreUpdates.photoURL = updates.newPhotoURL; 
      }


      const currentBio = userData?.bio || "";
      if (updates.bio !== undefined && updates.bio.trim() !== currentBio) {
          console.log("[AuthContext] Bio güncellemesi sağlandı:", updates.bio);
          firestoreUpdates.bio = updates.bio.trim();
      }

      if (updates.privacySettings) {
        console.log("[AuthContext] Gizlilik ayarları güncellemesi sağlandı:", updates.privacySettings);
        firestoreUpdates.privacySettings = { 
            ...(userData?.privacySettings || { 
                postsVisibleToFriendsOnly: false, 
                activeRoomsVisibleToFriendsOnly: false,
                feedShowsEveryone: true,
             }), 
            ...updates.privacySettings 
        };
      }

      const hasAuthUpdates = Object.keys(authUpdates).length > 0;
      const hasFirestoreUpdates = Object.keys(firestoreUpdates).length > 0;

      if (!hasAuthUpdates && !hasFirestoreUpdates) {
        console.log("[AuthContext] Profile uygulanacak gerçek bir değişiklik yok.");
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        setIsUserLoading(false);
        return true;
      }

      if (hasAuthUpdates && auth.currentUser) {
        console.log("[AuthContext] Firebase Auth profili şununla güncelleniyor:", authUpdates);
        await updateFirebaseProfile(auth.currentUser, authUpdates);
      }

      if (hasFirestoreUpdates) {
        console.log("[AuthContext] Firestore kullanıcı belgesi şununla güncelleniyor:", firestoreUpdates);
        await updateDoc(userDocRef, firestoreUpdates);
      }

      const updatedDocSnap = await getDoc(userDocRef);
      if (updatedDocSnap.exists()) {
        setUserData(updatedDocSnap.data() as UserData);
      }

      console.log("[AuthContext] Profil güncelleme başarılı.");
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("[AuthContext] Genel profil güncelleme başarısız:", error.code || error.name, error.message, error.stack);
      toast({
        title: "Profil Güncelleme Hatası",
        description: `Profil güncellenirken bir sorun oluştu: ${error.message || 'Bilinmeyen hata'}`,
        variant: "destructive"
      });
      return false;
    } finally {
      console.log("[AuthContext] Profil güncelleme işlemi bitti. isUserLoading false olarak ayarlanıyor.");
      setIsUserLoading(false);
    }
  };

  const updateUserDiamonds = async (newDiamondCount: number) => {
    if (!currentUser || !userData) {
      toast({ title: "Hata", description: "Elmaslar güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      return Promise.reject("Kullanıcı bulunamadı");
    }
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { diamonds: newDiamondCount });
      setUserData(prev => prev ? { ...prev, diamonds: newDiamondCount } : null);
      return Promise.resolve();
    } catch (error) {
      console.error("[AuthContext] Error updating diamonds:", error);
      toast({ title: "Elmas Güncelleme Hatası", description: "Elmaslar güncellenirken bir sorun oluştu.", variant: "destructive" });
      return Promise.reject(error);
    }
  };

  if (loading || (currentUser && isUserDataLoading)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <div className="mb-4">
          <Flame className="h-20 w-20 text-primary animate-pulse mx-auto" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary mb-2">
          HiweWalk
        </h1>
        <p className="text-xl text-muted-foreground">
          Hazırlanıyor...
        </p>
      </div>
    );
  }

  const value = {
    currentUser,
    userData,
    loading,
    isUserLoading,
    isUserDataLoading,
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    updateUserDiamonds,
    signInWithGoogle,
    isAdminPanelOpen,
    setIsAdminPanelOpen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  toUsername: string;
  toAvatarUrl: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
}
