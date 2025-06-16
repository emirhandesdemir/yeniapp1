
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Gem, X } from "lucide-react";
import { useEffect, useState } from 'react';

interface GameQuestion {
  id: string;
  text: string;
  answer: string;
  reward: number;
}

interface GameQuestionCardProps {
  question: GameQuestion;
  onClose: () => void;
}

const GameQuestionCard: FC<GameQuestionCardProps> = ({ question, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Component mount olduğunda görünür yap (animasyon için)
    const timer = setTimeout(() => setIsVisible(true), 100); // Kısa bir gecikme animasyonun başlamasını sağlar
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Animasyonun bitmesi için bekle
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md transition-all duration-500 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"
      }`}
    >
      <Card className="shadow-2xl border-primary/50 bg-gradient-to-br from-card via-card to-primary/10 dark:from-card dark:via-card dark:to-primary/20">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-6 w-6 text-primary" />
              <CardTitle className="text-lg font-semibold text-primary">Oyun Zamanı!</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-7 w-7 text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
              <span className="sr-only">Soruyu Kapat</span>
            </Button>
          </div>
          <CardDescription className="text-sm pt-1">Aşağıdaki soruyu doğru cevapla, elmasları kap!</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-base font-medium text-foreground/90">
            {question.text}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between items-center pt-3 pb-4 bg-secondary/30 dark:bg-card/60 rounded-b-lg px-4">
          <div className="text-sm text-muted-foreground">
            Cevap için: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/answer &lt;cevabınız&gt;</code>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold text-yellow-500 dark:text-yellow-400">
            <Gem className="h-4 w-4" />
            <span>{question.reward} Elmas</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default GameQuestionCard;
  
