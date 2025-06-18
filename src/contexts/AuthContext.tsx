
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, increment, runTransaction } from "firebase/firestore";
import { useRouter } from 'next/navigation';
import { Flame, Star } from 'lucide-react'; // Star eklendi
import { useToast } from '@/hooks/use-toast';
import { isPast } from 'date-fns'; // isPast eklendi

const INITIAL_DIAMONDS = 30;

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
  isPremium?: boolean; // Dinamik olarak hesaplanacak veya Firestore'a eklenecek
  reportCount?: number;
  isBanned?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  isUserLoading: boolean;
  isUserDataLoading: boolean;
  isCurrentUserPremium: () => boolean; // isPremium kontrol fonksiyonu eklendi
  signUp: (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; newPhotoURL?: string | null; bio?: string; privacySettings?: PrivacySettings }) => Promise<boolean>;
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: (isOpen: boolean) => void;
  reportUser: (reportedUserId: string, reason?: string) => Promise<void>;
  blockUser: (blockedUserId: string) => Promise<void>;
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

  const isCurrentUserPremium = useCallback(() => {
    if (!userData) return false;
    return userData.premiumStatus !== 'none' && userData.premiumStatus !== undefined &&
           (!userData.premiumExpiryDate || !isPast(userData.premiumExpiryDate.toDate()));
  }, [userData]);

  const createUserDocument = useCallback(async (user: User, username?: string, gender?: 'kadın' | 'erkek' | 'belirtilmemiş', isGoogleSignUp: boolean = false) => {
    const userDocRef = doc(db, "users", user.uid);
    const initialPhotoURL = user.photoURL;
    
    const currentPremiumStatus = isGoogleSignUp ? 'none' : 'none'; // Google ile kayıtta başlangıçta premium yok
    const currentPremiumExpiryDate = null;
    const dynamicIsPremium = currentPremiumStatus !== 'none' && (!currentPremiumExpiryDate || !isPast(currentPremiumExpiryDate.toDate()));

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
      premiumStatus: currentPremiumStatus,
      premiumExpiryDate: currentPremiumExpiryDate,
      isPremium: dynamicIsPremium,
      reportCount: 0,
      isBanned: false,
    };
    console.log(`[AuthContext] createUserDocument called for ${user.uid}. Data to set (actual createdAt will be serverTimestamp):`, dataToSetForLog);

    try {
        const dataToSave: Omit<UserData, 'createdAt'> & { createdAt: Timestamp } = { // createdAt Firestore.Timestamp olmalı
            uid: user.uid,
            email: user.email,
            displayName: username || user.displayName,
            photoURL: initialPhotoURL,
            diamonds: INITIAL_DIAMONDS,
            role: "user",
            // createdAt: serverTimestamp() as Timestamp, // Bu satır doğrudan kullanılamaz setDoc içinde.
            bio: "",
            gender: gender || "belirtilmemiş",
            privacySettings: {
                postsVisibleToFriendsOnly: false,
                activeRoomsVisibleToFriendsOnly: false,
                feedShowsEveryone: true,
            },
            premiumStatus: currentPremiumStatus,
            premiumExpiryDate: currentPremiumExpiryDate,
            isPremium: dynamicIsPremium,
            reportCount: 0,
            isBanned: false,
        };
        await setDoc(userDocRef, { ...dataToSave, createdAt: serverTimestamp() }); // serverTimestamp burada kullanılır.
        console.log(`[AuthContext] Successfully initiated user document creation via createUserDocument for ${user.uid}. Fetching document after creation...`);

        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const fetchedData = docSnap.data() as UserData;
            const finalUserData = {
                ...fetchedData,
                isPremium: fetchedData.premiumStatus !== 'none' && fetchedData.premiumStatus !== undefined &&
                           (!fetchedData.premiumExpiryDate || !isPast(fetchedData.premiumExpiryDate.toDate()))
            };
            console.log(`[AuthContext] User document for ${user.uid} confirmed exists after createUserDocument. Data:`, finalUserData);
            setUserData(finalUserData);
        } else {
            console.warn(`[AuthContext] User document for ${user.uid} NOT found immediately after setDoc in createUserDocument. Using fallback with client-side timestamp.`);
            const fallbackUserData: UserData = {
                ...dataToSave,
                createdAt: Timestamp.now(), // Fallback
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
  }, [toast]);


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
                const existingData = docSnap.data() as UserData;
                if (existingData.isBanned) {
                    console.log(`[AuthContext] Firestore check: User ${user.uid} is banned. Forcing logout.`);
                    await signOut(auth);
                    router.push('/login?reason=banned_firestore_check');
                    toast({title: "Hesap Erişimi Engellendi", description: "Hesabınız askıya alınmıştır.", variant: "destructive"});
                    return; 
                }

                console.log(`[AuthContext] User document found for ${user.uid}. Data:`, existingData);
                const dynamicIsPremium = existingData.premiumStatus !== 'none' && existingData.premiumStatus !== undefined &&
                                       (!existingData.premiumExpiryDate || !isPast(existingData.premiumExpiryDate.toDate()));
                const updatedData: UserData = {
                    ...existingData,
                    displayName: existingData.displayName !== undefined ? existingData.displayName : (user.displayName || null),
                    photoURL: existingData.photoURL !== undefined ? existingData.photoURL : (user.photoURL || null),
                    email: existingData.email !== undefined ? existingData.email : (user.email || null),
                    diamonds: existingData.diamonds ?? INITIAL_DIAMONDS,
                    role: existingData.role ?? "user",
                    bio: existingData.bio ?? "",
                    gender: existingData.gender ?? "belirtilmemiş",
                    privacySettings: {
                        postsVisibleToFriendsOnly: existingData.privacySettings?.postsVisibleToFriendsOnly ?? false,
                        activeRoomsVisibleToFriendsOnly: existingData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false,
                        feedShowsEveryone: existingData.privacySettings?.feedShowsEveryone ?? true,
                    },
                    premiumStatus: existingData.premiumStatus ?? 'none',
                    premiumExpiryDate: existingData.premiumExpiryDate ?? null,
                    isPremium: dynamicIsPremium,
                    reportCount: existingData.reportCount ?? 0,
                    isBanned: existingData.isBanned ?? false,
                };

                let needsFirestoreUpdate = false;
                if (updatedData.displayName !== existingData.displayName || 
                    updatedData.photoURL !== existingData.photoURL ||
                    updatedData.email !== existingData.email ||
                    updatedData.isPremium !== existingData.isPremium // isPremium da senkronize edilebilir
                    ) {
                    needsFirestoreUpdate = true;
                }
                
                if (needsFirestoreUpdate) {
                    console.log(`[AuthContext] Syncing Firebase Auth display name/photo/isPremium for ${user.uid} to Firestore.`);
                    await updateDoc(userDocRef, {
                        displayName: updatedData.displayName,
                        photoURL: updatedData.photoURL,
                        email: updatedData.email,
                        isPremium: updatedData.isPremium, // Firestore'a isPremium ekle
                    }).catch(err => console.error("Error syncing auth profile to firestore:", err));
                }
                setUserData(updatedData);

            } else {
                console.log(`[AuthContext] User document for ${user.uid} (email: ${user.email}, displayName: ${user.displayName}) not found. Attempting to create.`);
                await createUserDocument(user, user.displayName || undefined, "belirtilmemiş");
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
  }, [router, toast, createUserDocument]);


  const signUp = useCallback(async (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => {
    setIsUserLoading(true);
    console.log(`[AuthContext] Attempting signUp for email: ${email}, username: ${username}, gender: ${gender}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`[AuthContext] Firebase Auth user created: ${userCredential.user.uid}. Updating profile...`);
      await updateFirebaseProfile(userCredential.user, { displayName: username, photoURL: null });
      console.log(`[AuthContext] Firebase Auth profile updated for ${userCredential.user.uid}. Creating user document...`);
      await createUserDocument(userCredential.user, username, gender, false);
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
  }, [createUserDocument, router, toast]);

  const logIn = useCallback(async (email: string, password: string) => {
    setIsUserLoading(true);
    console.log(`[AuthContext] Attempting logIn for email: ${email}`);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists() && docSnap.data().isBanned) {
        await signOut(auth);
        toast({ title: "Erişim Engellendi", description: "Hesabınız askıya alınmıştır.", variant: "destructive" });
        router.push('/login?reason=banned_login_check');
        setIsUserLoading(false);
        return;
      }

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
  }, [router, toast]);

  const signInWithGoogle = useCallback(async () => {
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
        await createUserDocument(user, user.displayName || undefined, "belirtilmemiş", true);
      } else {
        const firestoreData = docSnap.data() as UserData;
         if (firestoreData.isBanned) {
            await signOut(auth);
            toast({ title: "Erişim Engellendi", description: "Hesabınız askıya alınmıştır.", variant: "destructive" });
            router.push('/login?reason=banned_google_check');
            setIsUserLoading(false);
            return;
        }
        console.log(`[AuthContext] User document for Google user ${user.uid} already exists. Data:`, firestoreData);
        const dynamicIsPremium = firestoreData.premiumStatus !== 'none' && firestoreData.premiumStatus !== undefined &&
                               (!firestoreData.premiumExpiryDate || !isPast(firestoreData.premiumExpiryDate.toDate()));

        const updatesToFirestore: Partial<UserData> = {
            isPremium: dynamicIsPremium,
        };
        const currentPrivacySettings = firestoreData.privacySettings || {};
        updatesToFirestore.privacySettings = {
            postsVisibleToFriendsOnly: currentPrivacySettings.postsVisibleToFriendsOnly ?? false,
            activeRoomsVisibleToFriendsOnly: currentPrivacySettings.activeRoomsVisibleToFriendsOnly ?? false,
            feedShowsEveryone: currentPrivacySettings.feedShowsEveryone ?? true,
        };
        updatesToFirestore.premiumStatus = firestoreData.premiumStatus ?? 'none';
        updatesToFirestore.premiumExpiryDate = firestoreData.premiumExpiryDate ?? null;
        updatesToFirestore.reportCount = firestoreData.reportCount ?? 0;
        updatesToFirestore.isBanned = firestoreData.isBanned ?? false;


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
        if (updatesToFirestore.displayName && updatesToFirestore.displayName !== firestoreData.displayName) needsUpdate = true;
        if (updatesToFirestore.photoURL && updatesToFirestore.photoURL !== firestoreData.photoURL) needsUpdate = true;
        if (updatesToFirestore.bio !== undefined && updatesToFirestore.bio !== firestoreData.bio) needsUpdate = true;
        if (updatesToFirestore.gender !== undefined && updatesToFirestore.gender !== firestoreData.gender) needsUpdate = true;
        if (updatesToFirestore.isPremium !== firestoreData.isPremium) needsUpdate = true;
        
        if (updatesToFirestore.privacySettings && (
                updatesToFirestore.privacySettings.postsVisibleToFriendsOnly !== (firestoreData.privacySettings?.postsVisibleToFriendsOnly ?? false) ||
                updatesToFirestore.privacySettings.activeRoomsVisibleToFriendsOnly !== (firestoreData.privacySettings?.activeRoomsVisibleToFriendsOnly ?? false) ||
                updatesToFirestore.privacySettings.feedShowsEveryone !== (firestoreData.privacySettings?.feedShowsEveryone ?? true)
            )
        ) {
            needsUpdate = true;
        }
        if (updatesToFirestore.premiumStatus !== (firestoreData.premiumStatus ?? 'none')) needsUpdate = true;


        if (needsUpdate) {
            console.log("[AuthContext] Google sign-in: Firestore document needs update. Updates:", updatesToFirestore);
            await updateDoc(userDocRef, updatesToFirestore);
            setUserData({ ...firestoreData, ...updatesToFirestore });
        } else {
            console.log("[AuthContext] Google sign-in: No Firestore document update needed.");
            setUserData({...firestoreData, isPremium: dynamicIsPremium});
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
  }, [createUserDocument, router, toast]);

  const logOut = useCallback(async () => {
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
  }, [router, toast]);

  const updateUserProfile = useCallback(async (updates: { displayName?: string; newPhotoURL?: string | null; bio?: string; privacySettings?: PrivacySettings }): Promise<boolean> => {
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
      const currentLocalUserData = userData; 

      const currentDisplayName = currentLocalUserData?.displayName || auth.currentUser.displayName || "";
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

      const currentPhotoURL = currentLocalUserData?.photoURL || auth.currentUser?.photoURL || null;
      if (updates.newPhotoURL !== undefined && updates.newPhotoURL !== currentPhotoURL) { 
          console.log("[AuthContext] Fotoğraf URL güncellemesi sağlandı:", updates.newPhotoURL);
          authUpdates.photoURL = updates.newPhotoURL; 
          firestoreUpdates.photoURL = updates.newPhotoURL;
      }


      const currentBio = currentLocalUserData?.bio || "";
      if (updates.bio !== undefined && updates.bio.trim() !== currentBio) {
          console.log("[AuthContext] Bio güncellemesi sağlandı:", updates.bio);
          firestoreUpdates.bio = updates.bio.trim();
      }

      if (updates.privacySettings) {
        console.log("[AuthContext] Gizlilik ayarları güncellemesi sağlandı:", updates.privacySettings);
        firestoreUpdates.privacySettings = {
            ...(currentLocalUserData?.privacySettings || {
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

      if (hasFirestoreUpdates) {
        setUserData(prev => prev ? { ...prev, ...firestoreUpdates } : null);
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
  }, [toast, userData]);

  const updateUserDiamonds = useCallback(async (newDiamondCount: number) => {
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
  }, [currentUser, userData, toast]);

  const reportUser = useCallback(async (reportedUserId: string, reason: string = "DM üzerinden şikayet") => {
    if (!currentUser || !userData) {
      toast({ title: "Giriş Gerekli", description: "Kullanıcıyı şikayet etmek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (currentUser.uid === reportedUserId) {
      toast({ title: "Hata", description: "Kendinizi şikayet edemezsiniz.", variant: "destructive" });
      return;
    }
    setIsUserLoading(true);
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: currentUser.uid,
        reporterName: userData.displayName || currentUser.displayName,
        reportedUserId: reportedUserId,
        reason: reason,
        timestamp: serverTimestamp(),
        status: "pending_review",
      });

      const reportedUserRef = doc(db, "users", reportedUserId);
      let newReportCount = 0;
      let shouldBeBanned = false;
      await runTransaction(db, async (transaction) => {
        const reportedUserSnap = await transaction.get(reportedUserRef);
        if (!reportedUserSnap.exists()) {
          throw "Şikayet edilen kullanıcı bulunamadı!";
        }
        const currentReportCount = reportedUserSnap.data().reportCount || 0;
        newReportCount = currentReportCount + 1;
        const updates: Partial<UserData> = { reportCount: newReportCount };
        if (newReportCount >= 3) {
          updates.isBanned = true;
          shouldBeBanned = true;
        }
        transaction.update(reportedUserRef, updates);
      });
      
      if (userData && reportedUserId === userData.uid) { // Bu blok muhtemelen gereksiz, şikayet eden kendi verisini güncellemez.
         setUserData(prev => prev ? {...prev, reportCount: newReportCount, isBanned: shouldBeBanned || prev.isBanned} : null);
      }


      toast({ title: "Şikayet Alındı", description: "Kullanıcı hakkındaki şikayetiniz tarafımıza iletilmiştir." });
      if(shouldBeBanned){
         toast({ title: "Kullanıcı Banlandı (Simülasyon)", description: `Şikayet edilen kullanıcı ${newReportCount} şikayete ulaştığı için otomatik olarak banlandı.`, variant: "destructive", duration: 7000 });
      }

    } catch (error: any) {
      console.error("Error reporting user:", error);
      toast({ title: "Hata", description: `Kullanıcı şikayet edilirken bir sorun oluştu: ${error.message || error}`, variant: "destructive" });
    } finally {
        setIsUserLoading(false);
    }
  }, [currentUser, userData, toast]);

  const blockUser = useCallback(async (blockedUserId: string) => {
    if (!currentUser) {
      toast({ title: "Giriş Gerekli", description: "Kullanıcıyı engellemek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    if (currentUser.uid === blockedUserId) {
        toast({ title: "Hata", description: "Kendinizi engelleyemezsiniz.", variant: "destructive" });
        return;
    }
    setIsUserLoading(true);
    try {
      const blockRef = doc(db, `users/${currentUser.uid}/blockedUsers`, blockedUserId);
      const targetUserDoc = await getDoc(doc(db, "users", blockedUserId));
      let blockedUserName = "Bilinmeyen Kullanıcı";
      let blockedUserPhoto: string | null = null;
      if(targetUserDoc.exists()){
        blockedUserName = targetUserDoc.data()?.displayName || "Bilinmeyen Kullanıcı";
        blockedUserPhoto = targetUserDoc.data()?.photoURL || null;
      }

      await setDoc(blockRef, {
        blockedAt: serverTimestamp(),
        displayName: blockedUserName, 
        photoURL: blockedUserPhoto,        
      });
      toast({ title: "Kullanıcı Engellendi", description: `${blockedUserName} engellendi. Bu kullanıcının içeriklerini görmeyeceksiniz (Filtreleme yakında aktif olacak).` });
    } catch (error) {
      console.error("Error blocking user:", error);
      toast({ title: "Hata", description: "Kullanıcı engellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
        setIsUserLoading(false);
    }
  }, [currentUser, toast]);


  if (loading || (currentUser && isUserDataLoading && !(userData && userData.uid === currentUser.uid && !userData.isBanned))) {
    // Ban kontrolü için `!userData.isBanned` eklendi. Eğer banlıysa yükleme ekranında takılı kalmasın.
    // Zaten onAuthStateChanged içinde banlıysa logout ediliyor.
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
    isCurrentUserPremium,
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    updateUserDiamonds,
    signInWithGoogle,
    isAdminPanelOpen,
    setIsAdminPanelOpen,
    reportUser,
    blockUser,
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

// Helper function to check premium status, can be used in other components if UserData is available
export const checkUserPremium = (user: UserData | null): boolean => {
  if (!user) return false;
  return user.premiumStatus !== 'none' && user.premiumStatus !== undefined &&
         (!user.premiumExpiryDate || !isPast(user.premiumExpiryDate.toDate()));
};

    