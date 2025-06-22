
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Gem, Loader2, Star, Youtube, Sparkles, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const diamondPackages = [
  { id: 'd100', diamonds: 100, price: 9.99, bonus: '5%', bestValue: false, icon: <Gem className="h-8 w-8 text-cyan-400" /> },
  { id: 'd250', diamonds: 250, price: 22.99, bonus: '10%', bestValue: false, icon: <Gem className="h-8 w-8 text-blue-500" /> },
  { id: 'd550', diamonds: 550, price: 44.99, bonus: '15%', bestValue: true, icon: <Gem className="h-8 w-8 text-purple-500" /> },
  { id: 'd1200', diamonds: 1200, price: 89.99, bonus: '20%', bestValue: false, icon: <Gem className="h-8 w-8 text-pink-500" /> },
];

const premiumPackages = [
  { id: 'p_weekly', duration: 'Haftalık', price: 14.99, perks: ["Ücretsiz Oda Oluşturma", "Özel Profil Rozeti", "Daha Fazla Oda Kapasitesi"], icon: <Star className="h-8 w-8 text-yellow-400"/> },
  { id: 'p_monthly', duration: 'Aylık', price: 49.99, perks: ["Haftalık Tüm Avantajlar", "Özel Sohbet Baloncuğu", "Daha Fazla Elmas Kazanımı"], icon: <Sparkles className="h-8 w-8 text-orange-400"/> },
];


export default function StorePage() {
    const { currentUser, userData, isUserLoading } = useAuth();
    const { toast } = useToast();
    const [purchasingId, setPurchasingId] = useState<string | null>(null);

    const handlePurchase = (id: string, type: 'diamond' | 'premium') => {
        if (!currentUser) {
            toast({ title: "Giriş Gerekli", description: "Satın alım yapmak için giriş yapmalısınız.", variant: "destructive" });
            return;
        }
        setPurchasingId(id);
        toast({
            title: "Satın Alma Simülasyonu",
            description: `${type === 'diamond' ? 'Elmas' : 'Premium'} paketi satın alma işlemi simüle ediliyor... (Bu özellik henüz aktif değil)`,
        });
        setTimeout(() => {
            setPurchasingId(null);
        }, 1500);
    };

    return (
        <div className="space-y-8">
            <header className="mb-8 text-center">
                <motion.h1 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl font-headline font-bold text-foreground"
                >
                    Elmas & Premium Mağazası
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-muted-foreground mt-2"
                >
                    Deneyiminizi geliştirmek için elmas ve premium abonelik paketleri.
                </motion.p>
                 {userData && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="inline-flex items-center gap-2 mt-4 bg-muted text-muted-foreground px-4 py-2 rounded-full"
                    >
                        <Gem className="h-5 w-5 text-yellow-400"/>
                        <span className="font-medium text-foreground">{userData.diamonds}</span> Elmas
                    </motion.div>
                )}
            </header>

            <section>
                <h2 className="text-2xl font-semibold mb-4 text-center text-primary">Elmas Paketleri</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {diamondPackages.map((pkg, index) => (
                        <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 * index }}
                        >
                        <Card className="relative overflow-hidden shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                            {pkg.bestValue && <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-md">En Avantajlı</div>}
                            <CardHeader className="items-center text-center">
                                {pkg.icon}
                                <CardTitle className="text-xl">{pkg.diamonds.toLocaleString()} Elmas</CardTitle>
                                <CardDescription>+ %{pkg.bonus} Bonus!</CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                                <p className="text-3xl font-bold text-foreground">${pkg.price}</p>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handlePurchase(pkg.id, 'diamond')} disabled={purchasingId === pkg.id || isUserLoading}>
                                    {purchasingId === pkg.id ? <Loader2 className="h-5 w-5 animate-spin"/> : "Satın Al"}
                                </Button>
                            </CardFooter>
                        </Card>
                        </motion.div>
                    ))}
                </div>
            </section>

             <section>
                <h2 className="text-2xl font-semibold mb-4 text-center text-primary">Premium Paketler</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {premiumPackages.map((pkg, index) => (
                        <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 * index + 0.4 }}
                        >
                        <Card className="shadow-lg hover:shadow-yellow-400/20 transition-shadow duration-300 flex flex-col h-full">
                            <CardHeader className="items-center text-center">
                                {pkg.icon}
                                <CardTitle className="text-xl">{pkg.duration} Premium</CardTitle>
                                <p className="text-3xl font-bold text-foreground mt-2">${pkg.price}</p>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    {pkg.perks.map(perk => (
                                        <li key={perk} className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500"/>
                                            <span>{perk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black" onClick={() => handlePurchase(pkg.id, 'premium')} disabled={purchasingId === pkg.id || isUserLoading}>
                                    {purchasingId === pkg.id ? <Loader2 className="h-5 w-5 animate-spin"/> : "Abone Ol"}
                                </Button>
                            </CardFooter>
                        </Card>
                         </motion.div>
                    ))}
                </div>
            </section>

            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
            >
                <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
                    <CardHeader className="flex-row items-center gap-4">
                        <Youtube className="h-10 w-10 text-destructive flex-shrink-0"/>
                        <div>
                            <CardTitle>Ücretsiz Elmas Kazan!</CardTitle>
                            <CardDescription>Kısa videolar izleyerek elmas kazanabilirsin.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <Button variant="outline" className="w-full sm:w-auto" onClick={() => toast({ title: "Yakında!", description: "Video izleyerek elmas kazanma özelliği yakında eklenecektir."})}>
                            <Youtube className="mr-2 h-5 w-5"/> Video İzle
                         </Button>
                    </CardContent>
                </Card>
            </motion.section>
        </div>
    );
}

