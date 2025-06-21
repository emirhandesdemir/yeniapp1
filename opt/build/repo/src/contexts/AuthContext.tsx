
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
import { Loader2, Star } from 'lucide-react';
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
  isPremium?: boolean;
  reportCount?: number;
  isBanned?: boolean;
  profileViewCount?: number;
  lastSeen?: Timestamp | null;
  bubbleStyle?: string;
  avatarFrameStyle?: string;
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
  updateUserProfile: (updates: { displayName?: string; newPhotoBlob?: Blob; removePhoto?: boolean; bio?: string; privacySettings?: PrivacySettings; lastSeen?: Timestamp | null; bubbleStyle?: string; avatarFrameStyle?: string; }) => Promise<boolean>;
  updateUserDiamonds: (newDiamondCount: number) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

export function checkUserPremium(user: UserData | Partial<UserData> | null): boolean {
  if (!user) return false;
  return !!(user.premiumStatus && user.premiumStatus !== 'none' &&
         (!user.premiumExpiryDate || !isPast(user.premiumExpiryDate.toDate())));
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const isCurrentUserPremium = useCallback(() => {
    if (!userData) return false;
    return checkUserPremium(userData);
  }, [userData]);
  
  const createUserDocument = useCallback(async (user: User, username?: string, gender?: 'kadın' | 'erkek' | 'belirtilmemiş', isGoogleSignUp = false) => {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) return; // Don't overwrite if it somehow exists
  
    const initialDisplayName = username || (isGoogleSignUp ? user.displayName : null) || `kullanici_${user.uid.substring(0, 6)}`;
    const initialPhotoURL = isGoogleSignUp ? user.photoURL : null;
  
    const dataToSave: Omit<UserData, 'uid' | 'createdAt' | 'lastSeen' | 'isPremium'> = {
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
      bubbleStyle: 'default',
      avatarFrameStyle: 'default',
    };
  
    await setDoc(userDocRef, {
      ...dataToSave,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setIsUserDataLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const fetchedData = docSnap.data() as UserData;
            if (fetchedData.isBanned) {
              toast({ title: "Hesap Erişimi Engellendi", description: "Hesabınız askıya alınmıştır.", variant: "destructive", duration: 7000 });
              await signOut(auth); // This will trigger onAuthStateChanged again with user=null
            } else {
              setCurrentUser(user);
              setUserData({ uid: user.uid, ...fetchedData });
            }
          } else {
            // This is a critical recovery path for users that exist in Auth but not Firestore.
            // E.g., first-time Google Sign-In or if sign-up doc creation failed.
            await createUserDocument(user, user.displayName || undefined, "belirtilmemiş", true);
            const newSnap = await getDoc(userDocRef);
            if (newSnap.exists()) {
              setCurrentUser(user);
              setUserData({ uid: user.uid, ...newSnap.data() } as UserData);
            } else {
              toast({ title: "Hesap Kurulum Hatası", description: "Kullanıcı veritabanı kaydı oluşturulamadı. Lütfen tekrar giriş yapmayı deneyin.", variant: "destructive" });
              await signOut(auth);
            }
          }
        } catch (error) {
          console.error("[AuthContext] Error processing user data:", error);
          toast({ title: "Veri Yükleme Hatası", description: "Kullanıcı bilgileriniz yüklenirken bir sorun oluştu.", variant: "destructive" });
          await signOut(auth);
        } finally {
          setIsUserDataLoading(false);
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
        setIsUserDataLoading(false);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [toast, createUserDocument]);


  const signUp = useCallback(async (email: string, password: string, username: string, gender: 'kadın' | 'erkek') => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(userCredential.user, { displayName: username });
      await createUserDocument(userCredential.user, username, gender, false);
      router.push('/');
      toast({ title: "Başarılı!", description: "Hesabınız oluşturuldu ve giriş yapıldı." });
    } catch (error: any) {
      let message = "Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin ve tekrar deneyin.";
      if (error.code === 'auth/email-already-in-use') message = "Bu e-posta adresi zaten kullanımda.";
      else if (error.code === 'auth/weak-password') message = "Şifre çok zayıf. Lütfen en az 6 karakterli daha güçlü bir şifre seçin.";
      else if (error.code === 'auth/invalid-email') message = "Geçersiz e-posta adresi formatı.";
      toast({ title: "Kayıt Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [toast, createUserDocument, router]);

  const logIn = useCallback(async (email: string, password: string) => {
    setIsUserLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
      toast({ title: "Başarılı!", description: "Giriş yapıldı." });
    } catch (error: any) {
      let message = `Giriş sırasında bir hata oluştu.`;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-posta veya şifre hatalı.";
      }
      toast({ title: "Giriş Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [toast, router]);

  const signInWithGoogle = useCallback(async () => {
    setIsUserLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      let message = "Google ile giriş sırasında bir hata oluştu.";
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        message = "Giriş penceresi kapatıldı veya istek iptal edildi.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        message = "Bu e-posta adresiyle zaten bir hesap mevcut. Lütfen diğer yöntemle giriş yapmayı deneyin.";
      }
      toast({ title: "Google Giriş Hatası", description: message, variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [toast, router]);

  const logOut = useCallback(async () => {
    setIsUserLoading(true);
    try {
      if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), { lastSeen: serverTimestamp() });
      }
      await signOut(auth);
      router.push('/login');
      toast({ title: "Başarılı", description: "Çıkış yapıldı." });
    } catch (error: any) {
      toast({ title: "Çıkış Hatası", description: "Çıkış yapılırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUserLoading(false);
    }
  }, [currentUser, toast, router]);

  const updateUserProfile = useCallback(async (updates: { displayName?: string; newPhotoBlob?: Blob; removePhoto?: boolean; bio?: string; privacySettings?: PrivacySettings; lastSeen?: Timestamp | null; bubbleStyle?: string; avatarFrameStyle?: string; }): Promise<boolean> => {
    if (!auth.currentUser) {
      toast({ title: "Hata", description: "Profil güncellenemedi, kullanıcı bulunamadı.", variant: "destructive" });
      setIsUserLoading(false);
      return false;
    }
    setIsUserLoading(true);
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const firestoreUpdates: Partial<UserData> = {};
    let authUpdates: { displayName?: string; photoURL?: string | null } = {};
    try {
      if (updates.newPhotoBlob) {
        const photoBlob = updates.newPhotoBlob;
        const fileExtension = photoBlob.type.split('/')[1] || 'png';
        const photoFileName = `profileImage-${uuidv4()}.${fileExtension}`;
        const photoRef = storageRef(storage, `profile_pictures/${auth.currentUser.uid}/${photoFileName}`);
        if (userData?.photoURL && !userData.photoURL.includes('placehold.co')) {
            try {
                const oldPhotoRef = storageRef(storage, userData.photoURL);
                await deleteObject(oldPhotoRef).catch(e => console.warn("Eski profil resmi silinirken hata (yoksayıldı):", e));
            } catch (e) { console.warn("Eski profil resmi referansı alınırken hata (yoksayıldı):", e); }
        }
        await uploadBytes(photoRef, photoBlob);
        const downloadURL = await getDownloadURL(photoRef);
        authUpdates.photoURL = downloadURL;
        firestoreUpdates.photoURL = downloadURL;
      } else if (updates.removePhoto) {
        authUpdates.photoURL = null;
        firestoreUpdates.photoURL = null;
      }

      if (updates.displayName && updates.displayName.trim() !== (userData?.displayName || "")) {
        authUpdates.displayName = updates.displayName.trim();
        firestoreUpdates.displayName = updates.displayName.trim();
      }
      if (updates.bio !== undefined) firestoreUpdates.bio = updates.bio;
      if (updates.privacySettings) firestoreUpdates.privacySettings = updates.privacySettings;
      if (updates.bubbleStyle) firestoreUpdates.bubbleStyle = updates.bubbleStyle;
      if (updates.avatarFrameStyle) firestoreUpdates.avatarFrameStyle = updates.avatarFrameStyle;
      if (updates.lastSeen) firestoreUpdates.lastSeen = updates.lastSeen;

      if (Object.keys(authUpdates).length > 0 && auth.currentUser) await updateFirebaseProfile(auth.currentUser, authUpdates);
      if (Object.keys(firestoreUpdates).length > 0) await updateDoc(userDocRef, firestoreUpdates);
      
      setUserData(prev => prev ? { ...prev, ...firestoreUpdates, ...authUpdates } : null);
      
      if (Object.keys(firestoreUpdates).length > 0 || Object.keys(authUpdates).length > 0) {
        toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
      }
      return true;
    } catch (error: any) {
      toast({ title: "Profil Güncelleme Hatası", description: `Bir sorun oluştu: ${error.message}`, variant: "destructive" });
      return false;
    } finally {
      setIsUserLoading(false);
    }
  }, [toast, userData]);

  const updateUserDiamonds = useCallback(async (newDiamondCount: number) => {
    if (!currentUser) return Promise.reject("Kullanıcı bulunamadı");
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { diamonds: newDiamondCount });
      setUserData(prev => prev ? { ...prev, diamonds: newDiamondCount } : null);
    } catch (error) {
      toast({ title: "Elmas Güncelleme Hatası", variant: "destructive" });
      return Promise.reject(error);
    }
  }, [currentUser, toast]);

  const reportUser = useCallback(async (reportedUserId: string, reason: string = "Belirtilmedi") => {
    if (!currentUser || !userData) return;
    setIsUserLoading(true);
    try {
      await addDoc(collection(db, "reports"), { /*...*/ });
      const reportedUserRef = doc(db, "users", reportedUserId);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(reportedUserRef);
        if (!snap.exists()) throw new Error("Kullanıcı bulunamadı!");
        const newCount = (snap.data().reportCount || 0) + 1;
        const updates: Partial<UserData> = { reportCount: newCount };
        if (newCount >= REPORT_BAN_THRESHOLD) updates.isBanned = true;
        transaction.update(reportedUserRef, updates);
      });
      toast({ title: "Şikayet Alındı" });
    } catch (e) { toast({ title: "Hata", description: "Şikayet gönderilemedi.", variant: "destructive" }); }
    finally { setIsUserLoading(false); }
  }, [currentUser, userData, toast]);

  const blockUser = useCallback(async (blockedUserId, blockedUserName, blockedUserPhoto) => {
    if (!currentUser) return;
    setIsUserLoading(true);
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/blockedUsers`, blockedUserId), {
        blockedAt: serverTimestamp(),
        displayName: blockedUserName,
        photoURL: blockedUserPhoto,
      });
      toast({ title: "Kullanıcı Engellendi" });
    } catch (e) { toast({ title: "Hata", description: "Engelleme başarısız.", variant: "destructive" }); }
    finally { setIsUserLoading(false); }
  }, [currentUser, toast]);

  const unblockUser = useCallback(async (blockedUserId) => {
    if (!currentUser) return;
    setIsUserLoading(true);
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/blockedUsers`, blockedUserId));
      toast({ title: "Engel Kaldırıldı" });
    } catch (e) { toast({ title: "Hata", description: "Engel kaldırılamadı.", variant: "destructive" }); }
    finally { setIsUserLoading(false); }
  }, [currentUser, toast]);

  const checkIfUserBlocked = useCallback(async (targetUserId) => {
    if (!currentUser) return false;
    const snap = await getDoc(doc(db, `users/${currentUser.uid}/blockedUsers`, targetUserId));
    return snap.exists();
  }, [currentUser]);

  const checkIfCurrentUserIsBlockedBy = useCallback(async (targetUserId) => {
    if (!currentUser) return false;
    const snap = await getDoc(doc(db, `users/${targetUserId}/blockedUsers`, currentUser.uid));
    return snap.exists();
  }, [currentUser]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (currentUser && document.visibilityState === 'visible') {
        try { await updateDoc(doc(db, "users", currentUser.uid), { lastSeen: serverTimestamp() }); }
        catch (error) {}
      }
    }, 5 * 60 * 1000);
    const handleVisibilityChange = async () => {
      if (currentUser && document.visibilityState === 'visible') {
        try { await updateDoc(doc(db, "users", currentUser.uid), { lastSeen: serverTimestamp() }); }
        catch (error) {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);
  
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Uygulama Yükleniyor...</p>
        </div>
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

    