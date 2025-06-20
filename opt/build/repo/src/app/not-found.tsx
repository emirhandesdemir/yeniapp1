"use client"; // Added to ensure client-side rendering context

import React from "react"; // Eklendi
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <Frown className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-5xl font-bold text-primary-foreground mb-4">404</h1>
      <h2 className="text-2xl font-medium text-muted-foreground mb-2">Sayfa Bulunamadı</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Aradığınız sayfa mevcut değil gibi görünüyor. URL'yi kontrol edin veya anasayfaya dönün.
      </p>
      <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
        <Link href="/">Anasayfaya Dön</Link>
      </Button>
    </div>
  );
}
