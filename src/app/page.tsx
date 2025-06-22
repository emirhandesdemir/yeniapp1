
"use client";

import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// This is a temporary diagnostic page to resolve the 404 error.
export default function HomePage() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center text-center py-20">
        <h1 className="text-4xl font-bold mb-4">Sunucu Çalışıyor!</h1>
        <p className="text-lg text-muted-foreground mb-8">Bu sayfayı görüyorsanız, yönlendirme sorunu çözülmüştür.</p>
        <p className="mb-4">Sorunun kaynağı, orijinal ana sayfa (Akış) bileşenindeki bir kod hatası gibi görünüyor. Şimdi bu sorunu araştırabiliriz.</p>
        <Button asChild>
            <Link href="/friends">
              Test için başka bir sayfaya git
            </Link>
        </Button>
      </div>
    </AppLayout>
  );
}
