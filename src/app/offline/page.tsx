
"use client";

import { WifiOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";

export default function OfflinePage() {
  useEffect(() => {
    document.title = "Çevrimdışı - HiweWalk";
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-primary/10 p-6 text-center">
      <Card className="w-full max-w-md shadow-2xl bg-card/90 backdrop-blur-md">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <WifiOff className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            İnternet Bağlantısı Yok
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Görünüşe göre şu anda çevrimdışısınız. İçeriği görebilmek için lütfen internet bağlantınızı kontrol edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bağlantınız geri geldiğinde sayfa otomatik olarak yenilenmeyebilir. Anasayfaya dönmeyi veya sayfayı manuel olarak yenilemeyi deneyebilirsiniz.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Anasayfaya Dön
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
