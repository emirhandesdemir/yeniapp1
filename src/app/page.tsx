
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Gem, MessagesSquare, Compass, PlusCircle, Sparkles, Globe } from "lucide-react"; 
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import CreatePostForm from "@/components/feed/CreatePostForm";
import FeedList from "@/components/feed/FeedList";

const cardVariants = {
  hidden: { opacity: 0, y: -20, height: 0 },
  visible: { 
    opacity: 1, 
    y: 0, 
    height: 'auto',
    transition: { 
      type: "spring",
      stiffness: 100,
      damping: 20,
      duration: 0.5
    } 
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    height: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

const itemVariants = { // Bunları daha küçük kart için basitleştirebiliriz veya olduğu gibi bırakabiliriz.
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } },
};

const buttonsContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const buttonItemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 10 } },
};

const SCROLL_HIDE_THRESHOLD = 100; // Piksel cinsinden kaydırma eşiği
const WELCOME_CARD_SESSION_KEY = 'welcomeCardHiddenPermanently_v1';


export default function HomePage() {
  const router = useRouter();
  const { currentUser, userData, loading: authLoading, isUserDataLoading } = useAuth();
  
  const [isWelcomeCardVisible, setIsWelcomeCardVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(WELCOME_CARD_SESSION_KEY) !== 'true';
    }
    return true; // SSR veya pencere yoksa varsayılan
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !isWelcomeCardVisible) return;

    const handleScroll = () => {
      if (window.scrollY > SCROLL_HIDE_THRESHOLD) {
        setIsWelcomeCardVisible(false);
        sessionStorage.setItem(WELCOME_CARD_SESSION_KEY, 'true');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isWelcomeCardVisible]);


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  if (authLoading || (currentUser && isUserDataLoading)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
        <div className="mb-6">
          <MessagesSquare className="h-16 w-16 text-primary animate-pulse mx-auto" />
        </div>
        <h1 className="text-3xl font-headline font-semibold text-primary mb-3">
          Anasayfanız Hazırlanıyor
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Sizin için en taze bilgileri ve sohbetleri getiriyoruz. Bu işlem birkaç saniye sürebilir...
        </p>
      </div>
    );
  }

  if (currentUser && userData) {
    const greetingName = userData?.displayName || currentUser?.displayName || "Kullanıcı";
    return (
      <AppLayout>
        <div className="space-y-6">
          <AnimatePresence>
            {isWelcomeCardVisible && (
              <motion.div
                key="welcome-card"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="shadow-lg bg-gradient-to-br from-primary/15 via-accent/5 to-primary/15 border-primary/20 overflow-hidden rounded-xl">
                  <CardHeader className="p-4">
                    <motion.div 
                      className="flex justify-between items-start mb-3"
                      variants={itemVariants}
                    >
                      <div>
                        <CardTitle className="text-xl font-semibold text-primary-foreground/90">
                          Hoş Geldin, {greetingName}!
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground mt-1">
                          Yeni bağlantılar kurmaya veya sohbetlere katılmaya ne dersin?
                        </CardDescription>
                      </div>
                      <Sparkles className="h-6 w-6 text-accent opacity-70" />
                    </motion.div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <motion.div 
                      className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3"
                      variants={itemVariants}
                    >
                      <Gem className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="font-medium">Elmasların: {userData?.diamonds ?? 0}</span>
                    </motion.div>
                    <motion.div 
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      variants={buttonsContainerVariants}
                    >
                      <motion.div variants={buttonItemVariants}>
                        <Button asChild size="sm" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-md py-2 text-xs">
                          <Link href="/chat">
                            <Compass className="mr-1.5 h-4 w-4" />
                            Odalara Göz At
                          </Link>
                        </Button>
                      </motion.div>
                      <motion.div variants={buttonItemVariants}>
                        <Button asChild size="sm" variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary rounded-md py-2 text-xs">
                          <Link href="/chat"> 
                            <PlusCircle className="mr-1.5 h-4 w-4" />
                            Yeni Oda Oluştur
                          </Link>
                        </Button>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          
          <CreatePostForm />
          <FeedList />
          
        </div>
      </AppLayout>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center p-4">
      <div className="mb-6">
        <Globe className="h-16 w-16 text-primary animate-pulse mx-auto" />
      </div>
      <h1 className="text-3xl font-headline font-semibold text-primary mb-3">
        Bir An...
      </h1>
      <p className="text-lg text-muted-foreground max-w-md">
        Sayfa yükleniyor veya yönlendiriliyor. Lütfen bekleyin.
      </p>
    </div>
  );
}
