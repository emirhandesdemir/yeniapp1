
"use client";

import type { ReactNode } from 'react';
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert, LayoutDashboard, Users, ListChecks, Settings2 as GameSettingsIcon, Bot, Palette, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: "/admin/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/chat-rooms", label: "Odalar", icon: ListChecks },
  { href: "/admin/game-settings", label: "Oyun", icon: GameSettingsIcon },
  { href: "/admin/appearance", label: "Görünüm", icon: Palette },
  { href: "/admin/project-assistant", label: "Asistan", icon: Bot },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser, userData, isUserLoading, isUserDataLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !isUserDataLoading) {
      if (!currentUser) {
        router.replace('/login?redirect=/admin/dashboard');
      } else if (userData?.role !== 'admin') {
        router.replace('/');
      }
    }
  }, [currentUser, userData, isUserLoading, isUserDataLoading, router]);

  if (isUserLoading || isUserDataLoading || (currentUser && !userData)) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Admin paneli yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser || userData?.role !== 'admin') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-2xl">
          <CardHeader>
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10 mb-4">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold text-destructive">Erişim Reddedildi</CardTitle>
            <CardDescription className="text-muted-foreground">
              Bu sayfayı görüntülemek için yönetici yetkiniz bulunmamaktadır.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="w-64 flex-col border-r bg-background hidden sm:flex">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
            <ArrowLeft className="h-5 w-5" />
            <span>Siteye Dön</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {adminNavItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                pathname === item.href && "bg-muted text-primary"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6 sm:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
                <ArrowLeft className="h-5 w-5" />
                <span>Siteye Dön</span>
            </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
