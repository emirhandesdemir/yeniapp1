
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, AlertTriangle } from "lucide-react";

export default function AdminProjectAssistantContent() {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Bot className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Proje Asistanı Geçici Olarak Devre Dışı</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Paket kurulumu sorunlarını çözmek için AI özellikleri geçici olarak kaldırıldı.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Uygulamanın temel işlevselliğini etkileyen kurulum hatalarını gidermek amacıyla bu bölüm devre dışı bırakılmıştır. Sorun çözüldükten sonra asistan tekrar aktif hale getirilecektir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
