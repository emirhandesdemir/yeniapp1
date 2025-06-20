
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Users, Zap, MessageSquareHeart, Shuffle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function MatchPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState("Uygun bir sohbet partneri bulmak için butona tıkla.");
  const { currentUser, userData, isUserLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    document.title = "Rastgele Eşleşme - HiweWalk";
  }, []);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace("/login?redirect=/match");
    }
  }, [currentUser, authLoading, router]);

  const handleStartSearch = useCallback(() => {
    if (!currentUser || !userData) {
      // Toast message could be added here if useToast was imported and setup
      console.error("Kullanıcı girişi yapılmamış veya kullanıcı verisi yüklenmemiş.");
      setSearchStatus("Eşleşme başlatılamadı. Lütfen giriş yapın ve tekrar deneyin.");
      return;
    }
    setIsSearching(true);
    setSearchStatus("Sizin için uygun bir sohbet partneri aranıyor...");
    console.log("Searching for match started by user:", currentUser.uid);
    // TODO: Implement actual matching logic here in future steps
  }, [currentUser, userData]);

  const handleCancelSearch = useCallback(() => {
    setIsSearching(false);
    setSearchStatus("Eşleşme arama iptal edildi. Tekrar denemek için butona tıkla.");
    console.log("Searching for match cancelled by user:", currentUser?.uid);
    // TODO: Implement logic to remove user from matchmaking queue if applicable
  }, [currentUser?.uid]);


  if (authLoading || (currentUser && !userData)) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-semibold text-foreground">Eşleşme Sayfası Yükleniyor</h2>
            <p className="text-muted-foreground mt-2">Lütfen bekleyin...</p>
        </div>
      );
  }
  
  if (!currentUser) return null; // Will be redirected by useEffect

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl rounded-xl border-border/40 bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
              className="mx-auto mb-4 p-3 bg-primary/20 rounded-full inline-block"
            >
              <Shuffle className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl sm:text-3xl font-headline text-foreground">
              Rastgele Eşleşme
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-muted-foreground mt-1">
              Yeni insanlarla tanışmak için bir sohbet partneri bul!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground text-sm min-h-[40px] flex items-center justify-center px-4">
              {searchStatus}
            </p>
            
            {!isSearching ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Button
                  onClick={handleStartSearch}
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-primary-foreground rounded-lg py-3 text-base shadow-lg hover:shadow-xl transition-all duration-300 ease-out transform hover:scale-105"
                  disabled={!currentUser || !userData}
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Sohbet Partneri Bul
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center text-primary">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <Button
                  onClick={handleCancelSearch}
                  variant="outline"
                  size="lg"
                  className="w-full rounded-lg py-3 text-base border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  <XCircle className="mr-2 h-5 w-5" />
                  Aramayı İptal Et
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
