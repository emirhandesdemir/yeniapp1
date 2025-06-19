
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
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, increment, runTransaction, deleteDoc, query, orderBy, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from 'next/navigation';
import { Loader2, Star } from 'lucide-react'; // Flame ikonu kaldırıldı, Loader2 zaten import edilmişti.
import { useToast } from '@/hooks/use-toast';
import { isPast } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_DIAMONDS = 30;
const REPORT_BAN_THRESHOLD = 5; // Ban için şikayet sayısı eşiği

export interface PrivacySettings {
  postsVisibleToFriendsOnly?: boolean;
  activeRoomsVisibleToFriendsOnly?: boolean;
  feedShowsEveryone?: boolean;
  showProfileViewCount?: boolean;
  showOnlineStatus?: boolean;
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
  isPremium?: boolean;
  reportCount?: number; 
  isBanned?: boolean;    
  profileViewCount?: number;
  lastSeen?: Timestamp | null;
}

export interface BlockedUserData {
  blockedAt: Timestamp;
  displayName: string | null;
  photoURL: string | null;
}


interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  isUserLoading: boolean;
  isUserDataLoading: boolean;
  isCurrentUserPremium: () => boolean;
  signUp: (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; newPhotoBlob?: Blob; removePhoto?: boolean; bio?: string; privacySettings?: PrivacySettings; lastSeen?: Timestamp | null }) => Promise<boolean>;
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isAdminPanelOpen: boolean;
  setIsAdminPanelOpen: (isOpen: boolean) => void;
  reportUser: (reportedUserId: string, reason?: string) => Promise<void>;
  blockUser: (blockedUserId: string, blockedUserName?: string | null, blockedUserPhoto?: string | null) => Promise<void>;
  unblockUser: (blockedUserId: string) => Promise<void>;
  checkIfUserBlocked: (targetUserId: string) => Promise<boolean>;
  checkIfCurrentUserIsBlockedBy: (targetUserId: string) => Promise<boolean>;
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

const defaultPrivacySettings: PrivacySettings = {
  postsVisibleToFriendsOnly: false,
  activeRoomsVisibleToFriendsOnly: false,
  feedShowsEveryone: true,
  showProfileViewCount: true,
  showOnlineStatus: true,
};


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
    return checkUserPremium(userData);
  }, [userData]);

  const createUserDocument = useCallback(async (
    user: User, 
    username?: string, 
    gender?: 'kadın' | 'erkek' | 'belirtilmemiş', 
    isGoogleSignUp: boolean = false,
    googlePhotoURL?: string | null
  ) => {
    const userDocRef = doc(db, "users", user.uid);
    const initialPhotoURL = isGoogleSignUp ? (googlePhotoURL || null) : null;
    const initialDisplayName = username || (isGoogleSignUp ? user.displayName : `Kullanıcı-${user.uid.substring(0,6)}`) || `Kullanıcı-${user.uid.substring(0,6)}`;
    
    const dataToSave: Omit<UserData, 'createdAt' | 'lastSeen' | 'isPremium'> = {
        uid: user.uid,
        email: user.email,
        displayName: initialDisplayName,
        photoURL: initialPhotoURL,
        diamonds: INITIAL_DIAMONDS,
        role: "user",
        bio: "",
        gender: gender || "belirtilmemiş",
        privacySettings: defaultPrivacySettings,
        premiumStatus: 'none',
        premiumExpiryDate: null,
        reportCount: 0,       
        isBanned: false,        
        profileViewCount: 0,  
    };
    
    try {
        const fullData = {
            ...dataToSave,
            isPremium: false, 
            createdAt: serverTimestamp() as Timestamp, 
            lastSeen: serverTimestamp() as Timestamp
        };
        await setDoc(userDocRef, fullData);
        setUserData({
            ...dataToSave,
            isPremium: false,
            createdAt: Timestamp.now(), 
            lastSeen: Timestamp.now(),
        });
    } catch (error: any) {
        console.error(`[AuthContext] CRITICAL: Error in createUserDocument for ${user.uid}:`, error.message, error.code, error.stack);
        toast({ title: "Hesap Detayı Kayıt Hatası", description: `Kullanıcı detayları veritabanına kaydedilemedi (Hata: ${error.message}).`, variant: "destructive" });
    }
  }, [toast]);


  const hydrateAndSyncUserData = useCallback(async (
    userAuth: User, 
    existingFirestoreData: Partial<UserData> | null
  ): Promise<UserData | null> => {
    const userDocRef = doc(db, "users", userAuth.uid);
    let finalUserData: UserData;
    const firestoreUpdates: Partial<UserData> = {};

    if (existingFirestoreData) {
        finalUserData = {
            uid: userAuth.uid,
            email: existingFirestoreData.email ?? userAuth.email ?? null,
            displayName: existingFirestoreData.displayName ?? userAuth.displayName ?? `Kullanıcı-${userAuth.uid.substring(0,6)}`,
            photoURL: existingFirestoreData.photoURL ?? userAuth.photoURL ?? null,
            diamonds: existingFirestoreData.diamonds ?? INITIAL_DIAMONDS,
            createdAt: existingFirestoreData.createdAt ?? Timestamp.now(), 
            role: existingFirestoreData.role ?? "user",
            bio: existingFirestoreData.bio ?? "",
            gender: existingFirestoreData.gender ?? "belirtilmemiş",
            privacySettings: { ...defaultPrivacySettings, ...(existingFirestoreData.privacySettings || {}) },
            premiumStatus: existingFirestoreData.premiumStatus ?? 'none',
            premiumExpiryDate: existingFirestoreData.premiumExpiryDate ?? null,
            reportCount: existingFirestoreData.reportCount ?? 0,
            isBanned: existingFirestoreData.isBanned ?? false,
            profileViewCount: existingFirestoreData.profileViewCount ?? 0,
            lastSeen: existingFirestoreData.lastSeen ?? Timestamp.now(),
            isPremium: false, 
        };
    } else {
        await createUserDocument(userAuth, userAuth.displayName || undefined, "belirtilmemiş", true, userAuth.photoURL);
        const newSnap = await getDoc(userDocRef);
        if (!newSnap.exists()) {
            toast({ title: "Kullanıcı Verisi Hatası", description: "Yeni kullanıcı verisi oluşturulamadı.", variant: "destructive" });
            return null;
        }
        const snapData = newSnap.data() as Partial<UserData>;
        finalUserData = { // Tüm alanların tanımlı olmasını sağla
            uid: newSnap.id,
            email: snapData.email ?? userAuth.email ?? null,
            displayName: snapData.displayName ?? userAuth.displayName ?? `Kullanıcı-${userAuth.uid.substring(0,6)}`,
            photoURL: snapData.photoURL ?? userAuth.photoURL ?? null,
            diamonds: snapData.diamonds ?? INITIAL_DIAMONDS,
            createdAt: snapData.createdAt ?? Timestamp.now(),
            role: snapData.role ?? "user",
            bio: snapData.bio ?? "",
            gender: snapData.gender ?? "belirtilmemiş",
            privacySettings: { ...defaultPrivacySettings, ...(snapData.privacySettings || {}) },
            premiumStatus: snapData.premiumStatus ?? 'none',
            premiumExpiryDate: snapData.premiumExpiryDate ?? null,
            reportCount: snapData.reportCount ?? 0,
            isBanned: snapData.isBanned ?? false,
            profileViewCount: snapData.profileViewCount ?? 0,
            lastSeen: snapData.lastSeen ?? Timestamp.now(),
            isPremium: false, // Aşağıda hesaplanacak
        };
    }
    
    if (finalUserData.displayName === `Kullanıcı-${userAuth.uid.substring(0,6)}` && userAuth.displayName) {
        finalUserData.displayName = userAuth.displayName;
        firestoreUpdates.displayName = userAuth.displayName;
    }
    if (finalUserData.photoURL === null && userAuth.photoURL) {
        finalUserData.photoURL = userAuth.photoURL;
        firestoreUpdates.photoURL = userAuth.photoURL;
    }
    if (finalUserData.email === null && userAuth.email) {
        finalUserData.email = userAuth.email;
        firestoreUpdates.email = userAuth.email;
    }
    
    const calculatedIsPremium = checkUserPremium(finalUserData);
    if (finalUserData.isPremium !== calculatedIsPremium) { 
        firestoreUpdates.isPremium = calculatedIsPremium;
    }
    finalUserData.isPremium = calculatedIsPremium; 

    firestoreUpdates.lastSeen = serverTimestamp() as Timestamp;

    if (Object.keys(firestoreUpdates).length > 0) {
        try {
            await updateDoc(userDocRef, firestoreUpdates);
            finalUserData.lastSeen = Timestamp.now(); 
        } catch (error) {
            console.error("[AuthContext] Firestore kullanıcı verisi senkronizasyon hatası:", error);
        }
    }
    return finalUserData;
  }, [createUserDocument, toast]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            const hydratedUser = await hydrateAndSyncUserData(user, docSnap.exists() ? (docSnap.data() as UserData) : null);

            if (hydratedUser?.isBanned) {
                await signOut(auth); 
                router.push('/login?reason=banned_auth_check');
                toast({title: "Hesap Erişimi Engellendi", description: "Hesabınız askıya alınmıştır. Destek için iletişime geçin.", variant: "destructive", duration: 7000});
                setUserData(null); 
            } else {
                setUserData(hydratedUser);
            }
        } catch (error: any) {
             console.error("[AuthContext] Error fetching/hydrating user document on auth state change:", error.message, error.code, error.stack);
             toast({ title: "Kullanıcı Verisi Yükleme Hatası", description: "Kullanıcı bilgileri alınırken bir sorun oluştu.", variant: "destructive" });
             setUserData(null); 
        } finally {
            setIsUserDataLoading(false);
        }
      } else {
        setUserData(null);
        setIsUserDataLoading(false);
        setIsAdminPanelOpen(false); 
      }
      setLoading(false); 
    });
    return unsubscribe;
  }, [router, toast, hydrateAndSyncUserData]);


  const signUp = useCallback(async (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(userCredential.user, { displayName: username, photoURL: null });
      // Firestore document creation is now handled by onAuthStateChanged -> hydrateAndSyncUserData
      // for consistency, especially if a user drops off before full Firestore write.
      // We will create it with gender during hydrateAndSyncUserData or initial onAuthStateChanged if it's the very first time.
      // For now, we rely on onAuthStateChanged to create the user document.
      // For an even better UX, createUserDocument could be called here immediately
      // and then onAuthStateChanged would just sync/confirm.
      // For this iteration, let's keep it simple and rely on onAuthStateChanged.
      
      // We can assume that onAuthStateChanged will pick up the new user and call
      // hydrateAndSyncUserData which in turn will call createUserDocument.
      // Gender needs to be passed to createUserDocument if it's called directly.
      // Since it's not, ensure hydrateAndSyncUserData (via createUserDocument) handles a gender param or defaults it.
      // `createUserDocument` was updated to accept and default gender.
      
      router.push('/');
      toast({ title: "Başarılı!", description: "Hesabınız oluşturuldu ve giriş yapıldı." });
    } catch (error: any) {
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
  }, [router, toast]); // createUserDocument kaldırıldı

  const logIn = useCallback(async (email: string, password: string) => {
    setIsUserLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      let message = `Giriş sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.`;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-posta veya şifre hatalı.";
      }
      toast({ title: "Giriş Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [toast]);

  const signInWithGoogle = useCallback(async () => {
    setIsUserLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
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
  }, [toast]);

  const logOut = useCallback(async () => {
    setIsUserLoading(true);
    try {
      if (currentUser && userData) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, { lastSeen: serverTimestamp() }).catch(e => console.warn("Failed to update lastSeen on logout", e));
      }
      await signOut(auth);
      setIsAdminPanelOpen(false); 
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [currentUser, userData, router, toast]);

  const updateUserProfile = useCallback(async (updates: { displayName?: string; newPhotoBlob?: Blob; removePhoto?: boolean; bio?: string; privacySettings?: PrivacySettings; lastSeen?: Timestamp | null }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      setIsUserLoading(false);
      return false;
    }
    setIsUserLoading(true);

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string; photoURL?: string | null } = {};
    let finalPhotoURL: string | null | undefined = undefined; 

    try {
      if (updates.newPhotoBlob) {
        const photoBlob = updates.newPhotoBlob;
        const fileExtension = photoBlob.type.split('/')[1] || 'png';
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        if (!validExtensions.includes(fileExtension.toLowerCase())) {
            toast({ title: "Dosya Hatası", description: `Desteklenmeyen dosya türü: ${photoBlob.type}. Lütfen ${validExtensions.join(', ')} uzantılı bir dosya seçin.`, variant: "destructive" });
            setIsUserLoading(false);
            return false;
        }
        
        const photoFileName = `profileImage-${uuidv4()}.${fileExtension}`;
        const photoRef = storageRef(storage, `profile_pictures/${auth.currentUser.uid}/${photoFileName}`);

        const currentPhotoURLForDelete = userData?.photoURL || auth.currentUser?.photoURL;
        if (currentPhotoURLForDelete && !currentPhotoURLForDelete.includes('placehold.co')) {
            try {
                const oldPhotoRef = storageRef(storage, currentPhotoURLForDelete);
                await deleteObject(oldPhotoRef).catch(e => console.warn("Eski profil resmi silinirken hata (yoksayıldı):", e));
            } catch (e) {
                console.warn("Eski profil resmi referansı alınırken hata (yoksayıldı):", e);
            }
        }

        await uploadBytes(photoRef, photoBlob);
        finalPhotoURL = await getDownloadURL(photoRef);
      } else if (updates.removePhoto) {
        finalPhotoURL = null; 
        const currentPhotoURLForDelete = userData?.photoURL || auth.currentUser?.photoURL;
        if (currentPhotoURLForDelete && !currentPhotoURLForDelete.includes('placehold.co')) {
          try {
            const oldPhotoRef = storageRef(storage, currentPhotoURLForDelete);
            await deleteObject(oldPhotoRef).catch(e => console.warn("Profil resmi silinirken hata (yoksayıldı):", e.message));
          } catch (e) {
            console.warn("Could not delete profile picture from storage (error caught but ignored):", e);
          }
        }
      }

      if (finalPhotoURL !== undefined) { 
        authUpdates.photoURL = finalPhotoURL;
        firestoreUpdates.photoURL = finalPhotoURL;
      }

      const currentDisplayName = userData?.displayName || auth.currentUser.displayName || "";
      if (updates.displayName && updates.displayName.trim() !== currentDisplayName) {
        if (updates.displayName.trim().length < 3) {
          toast({ title: "Hata", description: "Kullanıcı adı en az 3 karakter olmalıdır.", variant: "destructive" });
          setIsUserLoading(false);
          return false;
        }
        authUpdates.displayName = updates.displayName.trim();
        firestoreUpdates.displayName = updates.displayName.trim();
      }

      const currentBio = userData?.bio || "";
      if (updates.bio !== undefined && updates.bio.trim() !== currentBio) { 
        firestoreUpdates.bio = updates.bio.trim();
      }

      if (updates.privacySettings) {
        firestoreUpdates.privacySettings = {
          ...(userData?.privacySettings || defaultPrivacySettings), 
          ...updates.privacySettings, 
        };
      }
      
      if (updates.lastSeen !== undefined) {
        firestoreUpdates.lastSeen = updates.lastSeen;
      }


      const hasAuthUpdates = Object.keys(authUpdates).length > 0;
      const hasFirestoreUpdates = Object.keys(firestoreUpdates).length > 0;

      if (!hasAuthUpdates && !hasFirestoreUpdates && updates.lastSeen === undefined) { 
        toast({ title: "Bilgi", description: "Profilde güncellenecek bir değişiklik yok." });
        setIsUserLoading(false);
        return true; 
      }
      
      if (hasAuthUpdates && auth.currentUser) { 
        await updateFirebaseProfile(auth.currentUser, authUpdates);
      }

      if (hasFirestoreUpdates || updates.lastSeen) { 
        const finalFirestorePayload = { ...firestoreUpdates };
        if (updates.lastSeen && !hasFirestoreUpdates) { 
            finalFirestorePayload.lastSeen = updates.lastSeen;
        }
        await updateDoc(userDocRef, finalFirestorePayload);
      }
      
      setUserData(prev => {
        if (!prev) return null;
        const newLocalData = { ...prev };
        if (authUpdates.displayName !== undefined) newLocalData.displayName = authUpdates.displayName;
        if (authUpdates.photoURL !== undefined) newLocalData.photoURL = authUpdates.photoURL;
        if (firestoreUpdates.bio !== undefined) newLocalData.bio = firestoreUpdates.bio;
        if (firestoreUpdates.privacySettings !== undefined) newLocalData.privacySettings = firestoreUpdates.privacySettings;
        if (updates.lastSeen !== undefined) newLocalData.lastSeen = updates.lastSeen; 
        
        newLocalData.isPremium = checkUserPremium(newLocalData);
        return newLocalData;
      });

      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      return true;

    } catch (error: any) {
      console.error("[AuthContext] Genel profil güncelleme başarısız:", error.code, error.message, error);
      toast({
        title: "Profil Güncelleme Hatası",
        description: `Profil güncellenirken bir sorun oluştu: ${error.message || 'Bilinmeyen hata'}`,
        variant: "destructive"
      });
      return false;
    } finally {
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

  const reportUser = useCallback(async (reportedUserId: string, reason: string = "Belirtilmedi") => {
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
      let finalReportCount = 0;
      let shouldBeBanned = false;

      await runTransaction(db, async (transaction) => {
        const reportedUserSnap = await transaction.get(reportedUserRef);
        if (!reportedUserSnap.exists()) {
          throw new Error("Şikayet edilen kullanıcı bulunamadı!");
        }
        const currentReportCount = reportedUserSnap.data().reportCount || 0;
        finalReportCount = currentReportCount + 1;
        const updates: Partial<UserData> = { reportCount: finalReportCount };
        if (finalReportCount >= REPORT_BAN_THRESHOLD && !reportedUserSnap.data().isBanned) {
          updates.isBanned = true;
          shouldBeBanned = true;
        }
        transaction.update(reportedUserRef, updates);
      });
      
      toast({ title: "Şikayet Alındı", description: "Kullanıcı hakkındaki şikayetiniz tarafımıza iletilmiştir." });
      if(shouldBeBanned){
         toast({ title: "Kullanıcı Banlandı", description: `Şikayet edilen kullanıcı ${finalReportCount} şikayete ulaştığı için hesabı askıya alındı.`, variant: "destructive", duration: 7000 });
      }

    } catch (error: any) {
      console.error("Error reporting user:", error);
      toast({ title: "Hata", description: `Kullanıcı şikayet edilirken bir sorun oluştu: ${error.message || error}`, variant: "destructive" });
    } finally {
        setIsUserLoading(false);
    }
  }, [currentUser, userData, toast]);

  const blockUser = useCallback(async (blockedUserId: string, blockedUserName?: string | null, blockedUserPhoto?: string | null) => {
    if (!currentUser || !userData) {
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
      let nameToStore = blockedUserName;
      let photoToStore = blockedUserPhoto;

      if (!nameToStore && !photoToStore) { 
        const targetUserDoc = await getDoc(doc(db, "users", blockedUserId));
        if(targetUserDoc.exists()){
          nameToStore = targetUserDoc.data()?.displayName || "Bilinmeyen Kullanıcı";
          photoToStore = targetUserDoc.data()?.photoURL || null;
        }
      }

      await setDoc(blockRef, {
        blockedAt: serverTimestamp(),
        displayName: nameToStore || "Bilinmeyen Kullanıcı", 
        photoURL: photoToStore,
      });
      toast({ title: "Kullanıcı Engellendi", description: `${nameToStore || 'Kullanıcı'} engellendi.` });
    } catch (error) {
      console.error("Error blocking user:", error);
      toast({ title: "Hata", description: "Kullanıcı engellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
        setIsUserLoading(false);
    }
  }, [currentUser, userData, toast]);
  
  const unblockUser = useCallback(async (blockedUserId: string) => {
    if (!currentUser) {
      toast({ title: "Giriş Gerekli", description: "Engeli kaldırmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    setIsUserLoading(true);
    try {
      const blockRef = doc(db, `users/${currentUser.uid}/blockedUsers`, blockedUserId);
      await deleteDoc(blockRef);
      toast({ title: "Engel Kaldırıldı", description: `Kullanıcının engeli kaldırıldı.` });
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast({ title: "Hata", description: "Engeli kaldırırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [currentUser, toast]);

  const checkIfUserBlocked = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
        const blockRef = doc(db, `users/${currentUser.uid}/blockedUsers`, targetUserId);
        const docSnap = await getDoc(blockRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking if user blocked target:", error);
        return false; 
    }
  }, [currentUser]);

  const checkIfCurrentUserIsBlockedBy = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
        const blockRef = doc(db, `users/${targetUserId}/blockedUsers`, currentUser.uid);
        const docSnap = await getDoc(blockRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking if current user is blocked by target:", error);
        return false; 
    }
  }, [currentUser]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (currentUser && document.visibilityState === 'visible') {
        const userDocRef = doc(db, "users", currentUser.uid);
        try {
          await updateDoc(userDocRef, { lastSeen: serverTimestamp() });
          setUserData(prev => prev ? { ...prev, lastSeen: Timestamp.now() } : null);
        } catch (error) {
          // console.warn("Failed to update lastSeen periodically:", error);
        }
      }
    }, 5 * 60 * 1000); 

    const handleVisibilityChange = async () => {
      if (currentUser && document.visibilityState === 'visible') {
        const userDocRef = doc(db, "users", currentUser.uid);
         try {
          await updateDoc(userDocRef, { lastSeen: serverTimestamp() });
          setUserData(prev => prev ? { ...prev, lastSeen: Timestamp.now() } : null);
        } catch (error) {
          // console.warn("Failed to update lastSeen on visibility change:", error);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  if (loading || (currentUser && isUserDataLoading && !(userData && userData.uid === currentUser.uid && !userData.isBanned))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          Uygulama Yükleniyor...
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
    unblockUser,
    checkIfUserBlocked,
    checkIfCurrentUserIsBlockedBy,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  fromUserIsPremium?: boolean;
  toUserId: string;
  toUsername: string;
  toAvatarUrl: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
}

export const checkUserPremium = (user: UserData | Partial<UserData> | null): boolean => {
  if (!user) return false;
  return !!(user.premiumStatus && user.premiumStatus !== 'none' && 
         (!user.premiumExpiryDate || !isPast(user.premiumExpiryDate.toDate())));
};
