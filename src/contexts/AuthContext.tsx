
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
} from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Bu satırın .env.local doğru yapılandırıldığında çalışması beklenir
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isUserLoading: boolean; // To differentiate initial auth check from operation loading
  signUp: (email: string, password: string, username: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string, photoURL?: string }) => Promise<void>;
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
  const [loading, setLoading] = useState(true); // For initial auth state check
  const [isUserLoading, setIsUserLoading] = useState(false); // For async operations like login/signup
  const router = useRouter();

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
      // Firebase onAuthStateChanged will update currentUser
      // For immediate UI update (optional, as onAuthStateChanged will fire):
      setCurrentUser(auth.currentUser); 
      router.push('/');
    } catch (error: any) {
      console.error("Signup error:", error, "Code:", error.code); // Hata kodunu konsola yazdır
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
      throw new Error(message);
    } finally {
      setIsUserLoading(false);
    }
  };

  const logIn = async (email: string, password: string) => {
    setIsUserLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      console.error("Login error:", error);
      let message = "Giriş sırasında bir hata oluştu.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-posta veya şifre hatalı.";
      }
      throw new Error(message);
    } finally {
      setIsUserLoading(false);
    }
  };

  const logOut = async () => {
    setIsUserLoading(true);
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      console.error("Logout error:", error);
      throw new Error("Çıkış yapılırken bir hata oluştu.");
    } finally {
      setIsUserLoading(false);
    }
  };
  
  const updateUserProfile = async (updates: { displayName?: string, photoURL?: string }) => {
    if (!auth.currentUser) {
      throw new Error("Kullanıcı bulunamadı.");
    }
    setIsUserLoading(true);
    try {
      await updateProfile(auth.currentUser, updates);
      // Refresh currentUser state
      setCurrentUser(auth.currentUser ? { ...auth.currentUser } : null);
    } catch (error: any) {
      console.error("Profile update error:", error);
      throw new Error("Profil güncellenirken bir hata oluştu.");
    } finally {
      setIsUserLoading(false);
    }
  };


  if (loading) { // This is for the initial auth state check
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Kimlik durumu yükleniyor...</p>
      </div>
    );
  }

  const value = {
    currentUser,
    loading: loading, // Initial auth check loading
    isUserLoading, // Operation specific loading
    signUp,
    logIn,
    logOut,
    updateUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
