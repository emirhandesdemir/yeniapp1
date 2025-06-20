
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Gem, ShoppingBag, Tag, CreditCard, AlertTriangle, Youtube, Star, Zap } from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";

interface StorePackage { 
  id: string;
  name: string;
  price: string; 
  description: string;
  icon: React.ReactNode;
  actionType: "buy_diamonds" | "watch_ad_diamonds" | "buy_premium"; 
  diamonds?: number; 
  durationDays?: number; 
  highlight?: boolean;
}

const diamondPackages: StorePackage[] = [
  {
    id: "starter_pack",
    name: "Başlangıç Paketi",
    diamonds: 25,
    price: "₺2.99",
    description: "Sohbet dünyasına hızlı bir giriş yapın!",
    icon: <Gem className="h-8 w-8 text-blue-500" />,
    actionType: "buy_diamonds",
  },
  {
    id: "value_pack",
    name: "Avantaj Paketi",
    diamonds: 75,
    price: "₺7.99",
    description: "Daha fazla oda, daha fazla eğlence.",
    icon: <Gem className="h-8 w-8 text-green-500" />,
    actionType: "buy_diamonds",
    highlight: true,
  },
  {
    id: "mega_pack",
    name: "Mega Paket",
    diamonds: 200,
    price: "₺19.99",
    description: "Sohbetin kralı olun!",
    icon: <Gem className="h-8 w-8 text-purple-500" />,
    actionType: "buy_diamonds",
  },
  {
    id: "ad_reward",
    name: "Video İzle Kazan",
    diamonds: 5, 
    price: "Ücretsiz",
    description: "Kısa bir video izleyerek elmas kazanın.",
    icon: <Youtube className="h-8 w-8 text-red-500" />,
    actionType: "watch_ad_diamonds",
  },
];

const premiumPackages: StorePackage[] = [
  {
    id: "premium_weekly",
    name: "Haftalık Premium",
    price: "₺9.99", 
    description: "Bir hafta boyunca premium özelliklerin keyfini çıkarın!",
    icon: <Star className="h-8 w-8 text-amber-400" />,
    actionType: "buy_premium",
    durationDays: 7,
  },
  {
    id: "premium_monthly",
    name: "Aylık Premium",
    price: "₺29.99", 
    description: "Bir ay boyunca tüm premium avantajlara sahip olun!",
    icon: <Zap className="h-8 w-8 text-yellow-500" />,
    actionType: "buy_premium",
    durationDays: 30,
    highlight: true,
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

export default function StorePage() { 
  const { userData, isUserLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Mağaza - HiweWalk';
  }, []);

  const handlePackageAction = (pkg: StorePackage) => {
    if (pkg.actionType === "buy_diamonds" || pkg.actionType === "buy_premium") {
      toast({
        title: "Satın Alma İşlemi",
        description: `${pkg.name} için ödeme sistemi yakında eklenecektir.`,
        variant: "default",
        duration: 5000,
      });
    } else if (pkg.actionType === "watch_ad_diamonds") {
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
        <Card className="shadow-xl bg-gradient-to-br from-primary/10 via-card to-accent/10 dark:from-primary/15 dark:via-card dark:to-accent/15 border-primary/20 rounded-xl">
          <CardHeader className="text-center pb-4 pt-6">
            <ShoppingBag className="h-16 w-16 mx-auto text-primary mb-3 animate-pulse" />
            <CardTitle className="text-3xl sm:text-4xl font-headline text-primary-foreground/95">Mağaza</CardTitle>
            <CardDescription className="text-base sm:text-lg text-muted-foreground mt-1">
              Sohbet deneyimini zenginleştirmek için elmas ve premium paketler!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
             {userData && !isUserLoading && (
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4">
                <p className="text-lg font-medium text-muted-foreground">
                  Mevcut Elmasların: <Gem className="inline h-5 w-5 mb-0.5 text-yellow-400" /> {userData.diamonds ?? 0}
                </p>
                <p className="text-lg font-medium text-muted-foreground">
                  Premium Durumu: {userData.premiumStatus === 'none' || !userData.premiumStatus ? 
                    <span className="text-destructive">Yok</span> : 
                    <span className="text-green-500 capitalize">{userData.premiumStatus}</span>
                  }
                </p>
              </div>
            )}
             {isUserLoading && (
                <div className="flex justify-center items-center h-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
             )}
          </CardContent>
        </Card>
      </motion.div>

      
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-center sm:text-left flex items-center gap-2">
            <Star className="h-7 w-7 text-yellow-500" /> Premium Paketler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {premiumPackages.map((pkg, index) => (
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
                      
                      {pkg.durationDays && <Tag className={`h-5 w-5 ${pkg.highlight ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'}`} /> }
                      <span className={`text-lg font-bold ${pkg.highlight ? 'text-yellow-700 dark:text-yellow-300' : 'text-primary'}`}>{pkg.durationDays ? `${pkg.durationDays} Gün` : ''}</span>
                    </div>
                </CardHeader>
                <CardContent className="text-center flex-grow">
                    <p className="text-sm text-muted-foreground min-h-[40px]">{pkg.description}</p>
                </CardContent>
                <CardFooter className="flex-col items-center gap-3 p-5 border-t bg-muted/20 dark:bg-card/30 rounded-b-xl">
                    <p className={`text-2xl font-bold ${pkg.highlight ? 'text-yellow-600 dark:text-yellow-300' : 'text-foreground'}`}>{pkg.price}</p>
                    <Button 
                    className={`w-full rounded-md ${pkg.highlight ? 'bg-yellow-500 hover:bg-yellow-600 text-black dark:text-yellow-950' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                    onClick={() => handlePackageAction(pkg)}
                    disabled={isUserLoading}
                    >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Satın Al
                    </Button>
                </CardFooter>
                </Card>
            </motion.div>
            ))}
        </div>
      </section>

      
      <section className="space-y-4 pt-6">
        <h2 className="text-2xl font-semibold text-center sm:text-left flex items-center gap-2">
            <Gem className="h-7 w-7 text-blue-500" /> Elmas Paketleri
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {diamondPackages.map((pkg, index) => (
            <motion.div
                key={pkg.id}
                custom={index + premiumPackages.length} 
                variants={cardVariants}
                initial="hidden"
                animate="visible"
            >
                <Card className={`flex flex-col h-full shadow-lg hover:shadow-2xl transition-all duration-300 rounded-xl border ${pkg.highlight ? 'border-green-500 dark:border-green-400 ring-2 ring-green-500/70 dark:ring-green-400/70 bg-green-500/5 dark:bg-green-400/10' : 'border-border/30'}`}>
                <CardHeader className="items-center text-center pt-6 pb-3">
                    <div className={`p-3 rounded-full mb-3 ${pkg.highlight ? 'bg-green-500/20' : 'bg-secondary'}`}>
                        {pkg.icon}
                    </div>
                    <CardTitle className={`text-xl font-semibold ${pkg.highlight ? 'text-green-700 dark:text-green-300' : 'text-foreground'}`}>{pkg.name}</CardTitle>
                    {pkg.diamonds && (
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                        <Gem className={`h-5 w-5 ${pkg.highlight ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} /> 
                        <span className={`text-lg font-bold ${pkg.highlight ? 'text-green-700 dark:text-green-300' : 'text-primary'}`}>{pkg.diamonds} Elmas</span>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="text-center flex-grow">
                    <p className="text-sm text-muted-foreground min-h-[40px]">{pkg.description}</p>
                </CardContent>
                <CardFooter className="flex-col items-center gap-3 p-5 border-t bg-muted/20 dark:bg-card/30 rounded-b-xl">
                    <p className={`text-2xl font-bold ${pkg.highlight ? 'text-green-600 dark:text-green-300' : 'text-foreground'}`}>{pkg.price}</p>
                    <Button 
                    className={`w-full rounded-md ${pkg.highlight ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'}`}
                    onClick={() => handlePackageAction(pkg)}
                    disabled={isUserLoading}
                    >
                    {pkg.actionType === "buy_diamonds" ? <CreditCard className="mr-2 h-4 w-4" /> : <Youtube className="mr-2 h-4 w-4" />}
                    {pkg.actionType === "buy_diamonds" ? "Satın Al" : "İzle ve Kazan"}
                    </Button>
                </CardFooter>
                </Card>
            </motion.div>
            ))}
        </div>
      </section>
      
      <Card className="mt-8 border-blue-500/30 bg-blue-500/5 dark:bg-blue-400/10 p-6 shadow-md rounded-xl">
        <CardHeader className="p-0">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-10 w-10 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0"/>
                <div>
                    <CardTitle className="text-lg text-blue-700 dark:text-blue-300 font-semibold">Bilgilendirme</CardTitle>
                    <CardDescription className="text-xs text-blue-600 dark:text-blue-200 mt-1">
                        Elmas ve premium paket satın alma ile video izleyerek kazanma özellikleri şu anda geliştirme aşamasındadır. 
                        Bu sayfa, gelecekteki işlevsellik için bir önizlemedir. Anlayışınız için teşekkür ederiz!
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
      </Card>

    </div>
  );
}


    
