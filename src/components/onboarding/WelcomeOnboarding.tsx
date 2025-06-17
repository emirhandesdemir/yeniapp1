
"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Users, UserCircle, Gem, ArrowRight, CheckCircle, Palette, Sparkles, Rocket } from 'lucide-react';

interface OnboardingStep {
  icon: ReactNode;
  title: string;
  description: string;
  bgColorClass: string;
  textColorClass: string;
}

const steps: OnboardingStep[] = [
  {
    icon: <Rocket className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "HiweWalk'e Hoş Geldin!",
    description: "Yeni bağlantılar kurmaya ve harika sohbetlere katılmaya hazır mısın? Hadi, sana etrafı gezdirelim!",
    bgColorClass: "bg-gradient-to-br from-primary to-accent",
    textColorClass: "text-primary-foreground",
  },
  {
    icon: <MessageSquare className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "Sohbet Odalarını Keşfet",
    description: "Ana sayfadan veya 'Odalar' sekmesinden aktif sohbet odalarına göz atabilir, ilgi alanlarına uygun odalara katılabilir veya kendi odanı oluşturabilirsin.",
    bgColorClass: "bg-gradient-to-br from-blue-500 to-cyan-400",
    textColorClass: "text-white",
  },
  {
    icon: <Users className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "Arkadaş Edin ve DM Gönder",
    description: "'Arkadaşlar' sekmesinden yeni kullanıcılar arayabilir, arkadaşlık isteği gönderebilir ve kabul edilen arkadaşlarınla özel (DM) mesajlaşabilirsin.",
    bgColorClass: "bg-gradient-to-br from-green-500 to-teal-400",
    textColorClass: "text-white",
  },
  {
    icon: <UserCircle className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "Profilini Kişiselleştir",
    description: "'Profil' sekmesinden kullanıcı adını ve profil fotoğrafını güncelleyebilir, uygulama ayarlarını yönetebilirsin.",
    bgColorClass: "bg-gradient-to-br from-purple-500 to-pink-500",
    textColorClass: "text-white",
  },
  {
    icon: <Gem className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "Elmas Kazan ve Kullan",
    description: "Sohbet odası oluşturmak veya odaların süresini uzatmak için elmaslara ihtiyacın olacak. Bazı sohbet odası oyunlarından elmas kazanabilirsin!",
    bgColorClass: "bg-gradient-to-br from-yellow-400 to-orange-500",
    textColorClass: "text-gray-900",
  },
  {
    icon: <Sparkles className="h-12 w-12 sm:h-16 sm:w-16" />,
    title: "Hazırsın!",
    description: "Artık HiweWalk'i keşfetmeye hazırsın. İyi eğlenceler ve harika sohbetler dileriz!",
    bgColorClass: "bg-gradient-to-br from-gray-700 via-gray-800 to-black",
    textColorClass: "text-white",
  },
];

const STORAGE_KEY = 'onboardingCompleted_v1_hiwewalk'; // Storage key updated

interface WelcomeOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeOnboarding({ isOpen, onClose }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Client-side olduğunu belirt
  }, []);

  if (!isMounted) {
    return null; // SSR sırasında render etme
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
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden shadow-2xl border-0 !rounded-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: currentStep > 0 ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: currentStep < steps.length - 1 ? -50 : 50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className={`flex flex-col items-center justify-center text-center p-6 sm:p-10 min-h-[380px] sm:min-h-[450px] ${currentStepData.bgColorClass} ${currentStepData.textColorClass}`}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 120 }}
              className="mb-6"
            >
              {currentStepData.icon}
            </motion.div>
            <DialogHeader className="space-y-2 sm:space-y-3">
              <DialogTitle className={`text-2xl sm:text-3xl font-bold ${currentStepData.textColorClass}`}>{currentStepData.title}</DialogTitle>
              <DialogDescription className={`text-sm sm:text-base ${currentStepData.textColorClass} opacity-90 leading-relaxed max-w-sm mx-auto`}>
                {currentStepData.description}
              </DialogDescription>
            </DialogHeader>
          </motion.div>
        </AnimatePresence>
        <div className="p-4 sm:p-6 bg-card border-t border-border">
            <div className="flex justify-center mb-3">
                {steps.map((_, index) => (
                    <motion.div
                    key={index}
                    className={`h-1.5 w-6 rounded-full mx-0.5 ${index === currentStep ? 'bg-primary' : 'bg-muted'}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: index === currentStep ? 1 : 0.7 }}
                    transition={{ duration: 0.3 }}
                    />
                ))}
            </div>
          <DialogFooter className="gap-2 sm:gap-3">
            {currentStep === 0 && (
                 <Button type="button" variant="ghost" onClick={handleClose} className="w-full sm:w-auto">
                    Atla
                 </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              className={`w-full sm:w-auto ${currentStep === steps.length -1 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
            >
              {currentStep === steps.length - 1 ? (
                <>Harika, Başlayalım! <CheckCircle className="ml-2 h-5 w-5" /></>
              ) : (
                <>Sonraki <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
