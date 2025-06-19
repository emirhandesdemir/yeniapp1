
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
import { Flame, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isPast } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const INITIAL_DIAMONDS = 30;
const REPORT_BAN_THRESHOLD = 5;

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
  isPremium?: boolean; // Dinamik olarak hesaplanacak veya senkronize edilecek
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

  const createUserDocument = useCallback(async (user: User, username?: string, gender?: 'kadın' | 'erkek' | 'belirtilmemiş', isGoogleSignUp: boolean = false) => {
    const userDocRef = doc(db, "users", user.uid);
    const initialPhotoURL = user.photoURL;
    
    const currentPremiumStatus = 'none'; 
    const currentPremiumExpiryDate = null;
    const dynamicIsPremium = false; // Initially false, will be updated

    const dataToSave: Omit<UserData, 'createdAt' | 'lastSeen' | 'isPremium'> & { createdAt: Timestamp, lastSeen: Timestamp, isPremium?: boolean } = { 
        uid: user.uid,
        email: user.email,
        displayName: username || user.displayName,
        photoURL: initialPhotoURL,
        diamonds: INITIAL_DIAMONDS,
        role: "user",
        bio: "",
        gender: gender || "belirtilmemiş",
        privacySettings: {
            postsVisibleToFriendsOnly: false,
            activeRoomsVisibleToFriendsOnly: false,
            feedShowsEveryone: true,
            showProfileViewCount: true,
            showOnlineStatus: true,
        },
        premiumStatus: currentPremiumStatus,
        premiumExpiryDate: currentPremiumExpiryDate,
        reportCount: 0,
        isBanned: false,
        profileViewCount: 0,
    };
    
    try {
        await setDoc(userDocRef, { 
            ...dataToSave, 
            isPremium: dynamicIsPremium,
            createdAt: serverTimestamp(), 
            lastSeen: serverTimestamp() 
        });
        const docSnap = await getDoc(userDocRef); // Fetch after creation
        if (docSnap.exists()) {
            setUserData({ ...docSnap.data(), uid: docSnap.id, isPremium: checkUserPremium(docSnap.data() as UserData) } as UserData);
        } else {
             const fallbackUserData: UserData = {
                ...dataToSave,
                isPremium: dynamicIsPremium,
                createdAt: Timestamp.now(), 
                lastSeen: Timestamp.now(),
            };
            setUserData(fallbackUserData);
        }
    } catch (error: any) {
        console.error(`[AuthContext] CRITICAL: Error in createUserDocument for ${user.uid}:`, error.message, error.code, error.stack);
        toast({ title: "Hesap Detayı Kayıt Hatası", description: `Kullanıcı detayları veritabanına kaydedilemedi (Hata: ${error.message}).`, variant: "destructive" });
    }
  }, [toast]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const existingData = docSnap.data() as UserData;
                if (existingData.isBanned) {
                    await signOut(auth);
                    router.push('/login?reason=banned_firestore_check');
                    toast({title: "Hesap Erişimi Engellendi", description: "Hesabınız askıya alınmıştır. Destek için iletişime geçin.", variant: "destructive", duration: 7000});
                    setUserData(null);
                    setIsUserDataLoading(false);
                    setLoading(false);
                    return; 
                }

                const updatedIsPremium = checkUserPremium(existingData);
                const updatedData: UserData = {
                    ...existingData,
                    uid: docSnap.id,
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
                        showProfileViewCount: existingData.privacySettings?.showProfileViewCount ?? true,
                        showOnlineStatus: existingData.privacySettings?.showOnlineStatus ?? true,
                    },
                    premiumStatus: existingData.premiumStatus ?? 'none',
                    premiumExpiryDate: existingData.premiumExpiryDate ?? null,
                    isPremium: updatedIsPremium, // Use calculated value
                    reportCount: existingData.reportCount ?? 0,
                    isBanned: existingData.isBanned ?? false,
                    profileViewCount: existingData.profileViewCount ?? 0,
                    lastSeen: existingData.lastSeen ?? serverTimestamp() as Timestamp,
                };

                let needsFirestoreUpdate = false;
                const firestoreUpdatePayload: Partial<UserData> = {};

                if (updatedData.displayName !== existingData.displayName) { firestoreUpdatePayload.displayName = updatedData.displayName; needsFirestoreUpdate = true; }
                if (updatedData.photoURL !== existingData.photoURL) { firestoreUpdatePayload.photoURL = updatedData.photoURL; needsFirestoreUpdate = true; }
                if (updatedData.email !== existingData.email) { firestoreUpdatePayload.email = updatedData.email; needsFirestoreUpdate = true; }
                if (updatedData.isPremium !== existingData.isPremium) { firestoreUpdatePayload.isPremium = updatedData.isPremium; needsFirestoreUpdate = true; }
                
                firestoreUpdatePayload.lastSeen = serverTimestamp() as Timestamp; // Always update lastSeen
                needsFirestoreUpdate = true; // Ensure lastSeen is updated
                
                if (needsFirestoreUpdate) {
                    await updateDoc(userDocRef, firestoreUpdatePayload).catch(err => console.error("Error syncing auth profile to firestore:", err));
                    updatedData.lastSeen = Timestamp.now(); 
                }
                setUserData(updatedData);

            } else {
                await createUserDocument(user, user.displayName || undefined, "belirtilmemiş");
            }
        } catch (error: any) {
             console.error("[AuthContext] Error fetching/creating user document on auth state change:", error.message, error.code, error.stack);
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
  }, [router, toast, createUserDocument]);


  const signUp = useCallback(async (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(userCredential.user, { displayName: username, photoURL: null });
      await createUserDocument(userCredential.user, username, gender, false);
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
  }, [createUserDocument, router, toast]);

  const logIn = useCallback(async (email: string, password: string) => {
    setIsUserLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists() && docSnap.data().isBanned) {
        await signOut(auth);
        toast({ title: "Erişim Engellendi", description: "Hesabınız askıya alınmıştır. Destek için iletişime geçin.", variant: "destructive", duration: 7000 });
        router.push('/login?reason=banned_login_check');
        setIsUserLoading(false);
        return;
      }
      if (docSnap.exists()) {
        await updateDoc(userDocRef, { lastSeen: serverTimestamp() });
      }
      router.push('/');
      toast({ title: "Başarılı!", description: "Giriş yapıldı." });
    } catch (error: any) {
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
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await createUserDocument(user, user.displayName || undefined, "belirtilmemiş", true);
      } else {
        const firestoreData = docSnap.data() as UserData;
         if (firestoreData.isBanned) {
            await signOut(auth);
            toast({ title: "Erişim Engellendi", description: "Hesabınız askıya alınmıştır. Destek için iletişime geçin.", variant: "destructive", duration: 7000 });
            router.push('/login?reason=banned_google_check');
            setIsUserLoading(false);
            return;
        }
        
        const updatesToFirestore: Partial<UserData> = {
            lastSeen: serverTimestamp() as Timestamp,
            isPremium: checkUserPremium(firestoreData),
        };
        
        if (user.displayName && user.displayName !== firestoreData.displayName) {
            updatesToFirestore.displayName = user.displayName;
        }
        if (user.photoURL && user.photoURL !== firestoreData.photoURL) {
            updatesToFirestore.photoURL = user.photoURL;
        } else if (!firestoreData.photoURL && user.photoURL) {
             updatesToFirestore.photoURL = user.photoURL;
        }
        if (firestoreData.bio === undefined) updatesToFirestore.bio = "";
        if (firestoreData.gender === undefined) updatesToFirestore.gender = "belirtilmemiş";
        if (firestoreData.privacySettings === undefined) {
            updatesToFirestore.privacySettings = {
                postsVisibleToFriendsOnly: false, activeRoomsVisibleToFriendsOnly: false, feedShowsEveryone: true, showProfileViewCount: true, showOnlineStatus: true
            };
        }
        if (firestoreData.premiumStatus === undefined) updatesToFirestore.premiumStatus = 'none';
        if (firestoreData.premiumExpiryDate === undefined) updatesToFirestore.premiumExpiryDate = null;
        if (firestoreData.reportCount === undefined) updatesToFirestore.reportCount = 0;
        if (firestoreData.isBanned === undefined) updatesToFirestore.isBanned = false;
        if (firestoreData.profileViewCount === undefined) updatesToFirestore.profileViewCount = 0;


        if (Object.keys(updatesToFirestore).length > 0) {
            await updateDoc(userDocRef, updatesToFirestore);
            setUserData({ ...firestoreData, ...updatesToFirestore, lastSeen: Timestamp.now(), isPremium: checkUserPremium({...firestoreData, ...updatesToFirestore}) });
        } else {
            setUserData({...firestoreData, lastSeen: Timestamp.now(), isPremium: checkUserPremium(firestoreData)});
        }
      }
      router.push('/');
      toast({ title: "Başarılı!", description: "Google ile giriş yapıldı." });
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
  }, [createUserDocument, router, toast]);

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

        if (!validExtensions.includes(fileExtension)) {
            toast({ title: "Dosya Hatası", description: `Desteklenmeyen dosya türü: ${photoBlob.type}. Lütfen ${validExtensions.join(', ')} uzantılı bir dosya seçin.`, variant: "destructive" });
            setIsUserLoading(false);
            return false;
        }
        
        const photoRef = storageRef(storage, `profile_pictures/${auth.currentUser.uid}/profileImage.${fileExtension}`);
        await uploadBytes(photoRef, photoBlob);
        finalPhotoURL = await getDownloadURL(photoRef);
      } else if (updates.removePhoto) {
        finalPhotoURL = null;
        const currentPhotoURL = userData?.photoURL || auth.currentUser?.photoURL;
        if (currentPhotoURL) {
          try {
            const oldPhotoFileName = currentPhotoURL.split('/').pop()?.split('?')[0];
            if (oldPhotoFileName && oldPhotoFileName.includes("profileImage.")) { 
                 const oldPhotoRef = storageRef(storage, `profile_pictures/${auth.currentUser.uid}/${decodeURIComponent(oldPhotoFileName)}`);
                 await deleteObject(oldPhotoRef).catch(e => console.warn("Old photo deletion minor error (ignored):", e.message));
            }
          } catch (e) {
            console.warn("Could not delete old profile picture from storage (error caught but ignored):", e);
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
          ...(userData?.privacySettings || {
            postsVisibleToFriendsOnly: false,
            activeRoomsVisibleToFriendsOnly: false,
            feedShowsEveryone: true,
            showProfileViewCount: true,
            showOnlineStatus: true,
          }),
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

      if (hasFirestoreUpdates || updates.lastSeen) { // Ensure lastSeen update even if no other firestore changes
        const finalFirestorePayload = { ...firestoreUpdates };
        if (updates.lastSeen && !hasFirestoreUpdates) { // If only lastSeen is updated
            finalFirestorePayload.lastSeen = updates.lastSeen;
        }
        await updateDoc(userDocRef, finalFirestorePayload);
      }
      
      setUserData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...(authUpdates.displayName && { displayName: authUpdates.displayName }),
          ...(authUpdates.photoURL !== undefined && { photoURL: authUpdates.photoURL }),
          ...(firestoreUpdates.bio && { bio: firestoreUpdates.bio }),
          ...(firestoreUpdates.privacySettings && { privacySettings: firestoreUpdates.privacySettings }),
          ...(updates.lastSeen && { lastSeen: updates.lastSeen }),
        };
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
        if (finalReportCount >= REPORT_BAN_THRESHOLD) {
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

      if (!nameToStore && !photoToStore) { // Fetch if not provided
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

export const checkUserPremium = (user: UserData | null): boolean => {
  if (!user) return false;
  return user.premiumStatus !== 'none' && user.premiumStatus !== undefined &&
         (!user.premiumExpiryDate || !isPast(user.premiumExpiryDate.toDate()));
};
