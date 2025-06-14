
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider, // GoogleAuthProvider import edildi
  signInWithPopup,    // signInWithPopup import edildi
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Toast hook'u import edildi

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isUserLoading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string, photoURL?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>; // Google ile giriş fonksiyonu eklendi
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
  const [loading, setLoading] = useState(true);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); // Toast hook'u kullanıma alındı

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    setIsUserLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: username });
      setCurrentUser(auth.currentUser); 
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
      // throw new Error(message); // Hata fırlatmak yerine toast gösteriyoruz
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
      // throw new Error(message);
    } finally {
      setIsUserLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsUserLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
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
      // throw new Error(message);
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
      // throw new Error("Çıkış yapılırken bir hata oluştu.");
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
      await updateProfile(auth.currentUser, updates);
      setCurrentUser(auth.currentUser ? { ...auth.currentUser } : null);
      toast({ title: "Başarılı", description: "Profiliniz güncellendi." });
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({ title: "Profil Güncelleme Hatası", description: "Profil güncellenirken bir hata oluştu.", variant: "destructive" });
      // throw new Error("Profil güncellenirken bir hata oluştu.");
    } finally {
      setIsUserLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Kimlik durumu yükleniyor...</p>
      </div>
    );
  }

  const value = {
    currentUser,
    loading: loading,
    isUserLoading,
    signUp,
    logIn,
    logOut,
    updateUserProfile,
    signInWithGoogle, // signInWithGoogle context değerine eklendi
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
