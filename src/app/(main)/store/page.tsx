
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Gem, ShoppingBag, Tag, CreditCard, AlertTriangle, Youtube } from "lucide-react"; // Youtube ikonu buraya eklendi
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";

interface DiamondPackage {
  id: string;
  name: string;
  diamonds: number;
  price: string; // Fiyatı string olarak tutalım, "X TL" veya "Ücretsiz (Reklam)" gibi olabilir
  description: string;
  icon: React.ReactNode;
  actionType: "buy" | "watch_ad";
  highlight?: boolean;
}

const diamondPackages: DiamondPackage[] = [
  {
    id: "starter_pack",
    name: "Başlangıç Paketi",
    diamonds: 25,
    price: "₺2.99",
    description: "Sohbet dünyasına hızlı bir giriş yapın!",
    icon: <Gem className="h-8 w-8 text-blue-500" />,
    actionType: "buy",
  },
  {
    id: "value_pack",
    name: "Avantaj Paketi",
    diamonds: 75,
    price: "₺7.99",
    description: "Daha fazla oda, daha fazla eğlence.",
    icon: <Gem className="h-8 w-8 text-green-500" />,
    actionType: "buy",
    highlight: true,
  },
  {
    id: "mega_pack",
    name: "Mega Paket",
    diamonds: 200,
    price: "₺19.99",
    description: "Sohbetin kralı olun!",
    icon: <Gem className="h-8 w-8 text-purple-500" />,
    actionType: "buy",
  },
  {
    id: "ad_reward",
    name: "Video İzle Kazan",
    diamonds: 5, // Örnek bir miktar
    price: "Ücretsiz",
    description: "Kısa bir video izleyerek elmas kazanın.",
    icon: <Youtube className="h-8 w-8 text-red-500" />,
    actionType: "watch_ad",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};

export default function DiamondStorePage() {
  const { userData, isUserLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Elmas Mağazası - Sohbet Küresi';
  }, []);

  const handlePackageAction = (pkg: DiamondPackage) => {
    if (pkg.actionType === "buy") {
      toast({
        title: "Satın Alma İşlemi",
        description: `${pkg.name} için ödeme sistemi yakında eklenecektir.`,
        variant: "default",
        duration: 5000,
      });
    } else if (pkg.actionType === "watch_ad") {
      toast({
        title: "Video Reklam",
        description: "Video izleyerek elmas kazanma özelliği şu anda aktif değil, yakında eklenecektir!",
        variant: "default",
        duration: 5000,
      });
    }
  };


  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="shadow-xl bg-gradient-to-br from-primary/10 via-card to-accent/10 dark:from-primary/15 dark:via-card dark:to-accent/15 border-primary/20">
          <CardHeader className="text-center pb-4">
            <ShoppingBag className="h-16 w-16 mx-auto text-primary mb-3 animate-pulse" />
            <CardTitle className="text-3xl sm:text-4xl font-headline text-primary-foreground/95">Elmas Mağazası</CardTitle>
            <CardDescription className="text-base sm:text-lg text-muted-foreground mt-1">
              Sohbet deneyimini zenginleştirmek için elmas satın al veya kazan!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
             {userData && !isUserLoading && (
              <p className="text-lg font-medium text-muted-foreground">
                Mevcut Elmasların: <Gem className="inline h-5 w-5 mb-0.5 text-yellow-400" /> {userData.diamonds ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {diamondPackages.map((pkg, index) => (
          <motion.div
            key={pkg.id}
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className={`flex flex-col h-full shadow-lg hover:shadow-2xl transition-all duration-300 rounded-xl border ${pkg.highlight ? 'border-yellow-500 dark:border-yellow-400 ring-2 ring-yellow-500/70 dark:ring-yellow-400/70 bg-yellow-500/5 dark:bg-yellow-400/10' : 'border-border/30'}`}>
              <CardHeader className="items-center text-center pt-6 pb-3">
                <div className={`p-3 rounded-full mb-3 ${pkg.highlight ? 'bg-yellow-500/20' : 'bg-secondary'}`}>
                    {pkg.icon}
                </div>
                <CardTitle className={`text-xl font-semibold ${pkg.highlight ? 'text-yellow-700 dark:text-yellow-300' : 'text-foreground'}`}>{pkg.name}</CardTitle>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Gem className={`h-5 w-5 ${pkg.highlight ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'}`} /> 
                  <span className={`text-lg font-bold ${pkg.highlight ? 'text-yellow-700 dark:text-yellow-300' : 'text-primary'}`}>{pkg.diamonds} Elmas</span>
                </div>
              </CardHeader>
              <CardContent className="text-center flex-grow">
                <p className="text-sm text-muted-foreground min-h-[40px]">{pkg.description}</p>
              </CardContent>
              <CardFooter className="flex-col items-center gap-3 p-5 border-t bg-muted/20 dark:bg-card/30">
                <p className={`text-2xl font-bold ${pkg.highlight ? 'text-yellow-600 dark:text-yellow-300' : 'text-foreground'}`}>{pkg.price}</p>
                <Button 
                  className={`w-full ${pkg.highlight ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                  onClick={() => handlePackageAction(pkg)}
                  disabled={isUserLoading}
                >
                  {pkg.actionType === "buy" ? <CreditCard className="mr-2 h-4 w-4" /> : <Youtube className="mr-2 h-4 w-4" />}
                  {pkg.actionType === "buy" ? "Satın Al" : "İzle ve Kazan"}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
      
      <Card className="mt-8 border-blue-500/30 bg-blue-500/5 dark:bg-blue-400/10 p-6 shadow-md">
        <CardHeader className="p-0">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-10 w-10 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0"/>
                <div>
                    <CardTitle className="text-lg text-blue-700 dark:text-blue-300">Bilgilendirme</CardTitle>
                    <CardDescription className="text-xs text-blue-600 dark:text-blue-200 mt-1">
                        Elmas satın alma ve video izleyerek kazanma özellikleri şu anda geliştirme aşamasındadır. 
                        Bu sayfa, gelecekteki işlevsellik için bir önizlemedir. Anlayışınız için teşekkür ederiz!
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
      </Card>

    </div>
  );
}
