import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, LogIn } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sohbet Odaları - Sohbet Küresi',
  description: 'Aktif sohbet odalarını keşfedin veya yenisini oluşturun.',
};

const chatRooms = [
  { id: "1", name: "Geyik Muhabbeti", description: "Serbest takılmaca, güncel konular.", participants: 12, image: "https://placehold.co/600x400.png", dataAiHint: "chat fun" },
  { id: "2", name: "Oyun Severler", description: "En yeni oyunlar, turnuvalar ve ekip arayışları.", participants: 45, image: "https://placehold.co/600x400.png", dataAiHint: "gaming controller" },
  { id: "3", name: "Müzik Tutkunları", description: "Her telden müzik, konser haberleri, enstrümanlar.", participants: 23, image: "https://placehold.co/600x400.png", dataAiHint: "headphones music" },
  { id: "4", name: "Kitap Kulübü", description: "Okunan kitaplar üzerine tartışmalar, yazar önerileri.", participants: 8, image: "https://placehold.co/600x400.png", dataAiHint: "books library" },
];

export default function ChatRoomsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Sohbet Odaları</h1>
          <p className="text-muted-foreground">İlgi alanlarınıza uygun odalara katılın veya kendi odanızı oluşturun.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground animate-subtle-pulse">
          <PlusCircle className="mr-2 h-5 w-5" />
          Yeni Oda Oluştur
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {chatRooms.map((room) => (
          <Card key={room.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 rounded-xl bg-card">
            <div className="relative h-48 w-full">
              <Image 
                src={room.image} 
                alt={room.name} 
                layout="fill" 
                objectFit="cover" 
                className="rounded-t-xl"
                data-ai-hint={room.dataAiHint}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-xl"></div>
            </div>
            <CardHeader className="pt-4">
              <CardTitle className="text-xl font-semibold text-primary-foreground/90">{room.name}</CardTitle>
              <CardDescription className="h-10 overflow-hidden text-ellipsis">{room.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                {room.participants} katılımcı
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href={`/chat/${room.id}`}>
                  <LogIn className="mr-2 h-4 w-4" /> Odaya Katıl
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
