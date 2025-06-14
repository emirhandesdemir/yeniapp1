"use client";

import * as React from 'react'; // Added React import
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Globe, 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  UserCircle, 
  LogOut,
  Menu,
  Settings,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Anasayfa', icon: LayoutDashboard },
  { href: '/chat', label: 'Sohbet Odaları', icon: MessageSquare },
  { href: '/friends', label: 'Arkadaşlar', icon: Users },
  { href: '/profile', label: 'Profilim', icon: UserCircle },
];

function NavLink({ item, onClick }: { item: NavItem, onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-primary/10 hover:text-primary",
        isActive ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const router = useRouter();
  const handleLogout = () => {
    // Placeholder for logout logic
    console.log("Logout clicked");
    router.push('/login');
    if (onLinkClick) onLinkClick();
  };

  return (
    <div className="flex h-full max-h-screen flex-col gap-2 bg-card border-r">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <Globe className="h-7 w-7" />
          <span className="text-xl font-headline">Sohbet Küresi</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-4 text-sm font-medium">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} onClick={onLinkClick} />
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const router = useRouter();

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-card lg:block">
        <SidebarContent />
      </div>
      <div className="flex flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-6 sticky top-0 z-10">
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Navigasyon menüsünü aç/kapat</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
              <SidebarContent onLinkClick={() => setMobileSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div className="w-full flex-1">
            {/* Header content like search can go here */}
          </div>

          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Bildirimler</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="https://placehold.co/100x100.png" alt="Kullanıcı avatarı" data-ai-hint="user avatar" />
                  <AvatarFallback>SK</AvatarFallback>
                </Avatar>
                <span className="sr-only">Kullanıcı menüsünü aç/kapat</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hesabım</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <UserCircle className="mr-2 h-4 w-4" /> Profili Görüntüle
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" /> Ayarlar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/login')} className="text-destructive hover:!text-destructive focus:!text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 bg-background overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
