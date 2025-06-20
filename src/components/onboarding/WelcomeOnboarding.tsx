
"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MessagesSquare, RadioTower, Send, Newspaper, Rocket, ArrowRight, CheckCircle, Sparkles } from 'lucide-react'; // İkonlar güncellendi

interface OnboardingStep {
  icon: ReactNode;
  title: string;
  description: string;
  bgColorClass: string;
  textColorClass: string;
  details?: string[]; // İsteğe bağlı detaylar için
}

const steps: OnboardingStep[] = [
  {
    icon: <Sparkles className="h-16 w-16 sm:h-20 sm:w-20 text-yellow-300" />,
    title: "HiweWalk Dünyasına Hoş Geldin!",
    description: "Canlı topluluklar, dinamik sohbetler ve sonsuz eğlence seni bekliyor. Maceraya atılmaya hazır mısın?",
    bgColorClass: "bg-gradient-to-br from-primary via-purple-600 to-pink-500",
    textColorClass: "text-white",
  },
  {
    icon: <RadioTower className="h-16 w-16 sm:h-20 sm:w-20 text-sky-300" />,
    title: "Dinamik Sohbet Odaları ve Sesli Maceralar",
    description: "İlgi alanlarına göre odalar keşfet, kendi odanı oluştur veya yönet. WebRTC tabanlı canlı sesli sohbetlere katıl, oyunlar oyna ve Elmas kazan!",
    details: ["Metin & Sesli Sohbet", "Oda Oyunları", "Elmas Ekonomisi"],
    bgColorClass: "bg-gradient-to-tr from-sky-500 via-cyan-400 to-teal-400",
    textColorClass: "text-white",
  },
  {
    icon: <Send className="h-16 w-16 sm:h-20 sm:w-20 text-green-300" />,
    title: "Özel Bağlantılar Kur",
    description: "Arkadaşlarınla birebir özel mesajlaş (DM) veya WebRTC üzerinden kesintisiz özel sesli aramalar gerçekleştir. HiweWalk'te bağların hiç olmadığı kadar güçlü!",
    details: ["Direkt Mesajlaşma", "Birebir Sesli Arama"],
    bgColorClass: "bg-gradient-to-bl from-green-500 via-emerald-500 to-lime-400",
    textColorClass: "text-white",
  },
  {
    icon: <Newspaper className="h-16 w-16 sm:h-20 sm:w-20 text-orange-300" />,
    title: "Etkileşimli Akışta Kal",
    description: "Düşüncelerini, oda davetlerini veya en son haberlerini gönderi olarak paylaş. Beğen, yorum yap, yeniden paylaş ve toplulukla sürekli etkileşimde ol.",
    details: ["Gönderi Paylaşımı", "Beğeni & Yorumlar", "Repost Özelliği"],
    bgColorClass: "bg-gradient-to-tl from-orange-500 via-amber-500 to-yellow-400",
    textColorClass: "text-gray-900",
  },
  {
    icon: <Rocket className="h-16 w-16 sm:h-20 sm:w-20 text-red-300" />,
    title: "Keşfe Hazırsın!",
    description: "Artık HiweWalk'in tüm özelliklerini biliyorsun. Hemen topluluğa katıl, yeni insanlarla tanış, eğlen ve HiweWalk deneyiminin tadını çıkar!",
    bgColorClass: "bg-gradient-to-br from-red-600 via-rose-500 to-pink-600",
    textColorClass: "text-white",
  },
];

const STORAGE_KEY = 'onboardingCompleted_v1_hiwewalk';

interface WelcomeOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeOnboarding({ isOpen, onClose }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
      console.warn("Failed to set onboarding flag in localStorage:", error);
    }
    onClose();
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden shadow-2xl border-0 !rounded-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: currentStep > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: currentStep < steps.length - 1 ? -60 : 60 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className={`flex flex-col items-center justify-center text-center p-6 sm:p-8 min-h-[400px] sm:min-h-[480px] ${currentStepData.bgColorClass} ${currentStepData.textColorClass}`}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.25, duration: 0.6, type: 'spring', stiffness: 100, damping: 10 }}
              className="mb-5 sm:mb-7 p-3 bg-white/10 dark:bg-black/10 rounded-full shadow-lg"
            >
              {currentStepData.icon}
            </motion.div>
            <DialogHeader className="space-y-2 sm:space-y-2.5">
              <DialogTitle className={`text-2xl sm:text-3xl font-bold ${currentStepData.textColorClass} !tracking-tight`}>{currentStepData.title}</DialogTitle>
              <DialogDescription className={`text-sm sm:text-base ${currentStepData.textColorClass} opacity-90 leading-relaxed max-w-xs sm:max-w-sm mx-auto`}>
                {currentStepData.description}
              </DialogDescription>
            </DialogHeader>
            {currentStepData.details && currentStepData.details.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mt-4 sm:mt-5 space-y-1.5"
              >
                {currentStepData.details.map((detail, index) => (
                  <p key={index} className={`text-xs sm:text-sm ${currentStepData.textColorClass} opacity-80 flex items-center justify-center gap-1.5`}>
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {detail}
                  </p>
                ))}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="p-4 sm:p-5 bg-card border-t border-border/30">
            <div className="flex justify-center mb-3 sm:mb-4">
                {steps.map((_, index) => (
                    <motion.div
                    key={index}
                    className={`h-1.5 w-5 sm:w-6 rounded-full mx-0.5 transition-colors duration-300 ${index === currentStep ? 'bg-primary' : 'bg-muted'}`}
                    animate={{ 
                        backgroundColor: index === currentStep ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                        scale: index === currentStep ? 1.1 : 1,
                     }}
                    />
                ))}
            </div>
          <DialogFooter className="gap-2 sm:gap-3">
            {currentStep === 0 && (
                 <Button type="button" variant="ghost" onClick={handleClose} className="w-full sm:w-auto text-muted-foreground hover:text-foreground">
                    Atla
                 </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              className={`w-full ${currentStep === 0 ? 'sm:w-auto' : 'sm:flex-1'} rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ease-out transform hover:scale-105 ${currentStep === steps.length -1 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
            >
              {currentStep === steps.length - 1 ? (
                <>Harika, Başlayalım! <Rocket className="ml-2 h-4 w-4" /></>
              ) : (
                <>Devam Et <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

