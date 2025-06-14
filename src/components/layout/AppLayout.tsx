
"use client";

import * as React from 'react';
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
  Bell,
  Loader2,
  Gem,
  Sun, 
  Moon,
  ShieldCheck,
  UserCheck, 
  UserX, 
  Send // Send ikonu zaten vardı, gereksiz importu kaldırdım.
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useAuth, type UserData } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext'; 
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc, // updateDoc eklendi, gerekiyorsa.
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  orderBy 
} from "firebase/firestore";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Anasayfa', icon: LayoutDashboard },
  { href: '/chat', label: 'Sohbet Odaları', icon: MessageSquare },
  { href: '/friends', label: 'Arkadaşlar', icon: Users },
  { href: '/profile', label: 'Profilim', icon: UserCircle },
  { href: '/admin/dashboard', label: 'Admin Paneli', icon: ShieldCheck, adminOnly: true },
];

interface FriendRequestForPopover {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  createdAt: Timestamp;
  userProfile?: UserData; // Gönderen kullanıcının profil bilgileri
}

function NavLink({ item, onClick, isAdmin }: { item: NavItem, onClick?: () => void, isAdmin?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

  if (item.adminOnly && !isAdmin) {
    return null;
  }

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
  const { logOut, isUserLoading, userData } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logOut();
      toast({ title: "Başarıyla çıkış yapıldı."});
      if (onLinkClick) onLinkClick();
    } catch (error: any) {
      toast({ title: "Çıkış Hatası", description: error.message, variant: "destructive" });
    }
  };

  const isAdmin = userData?.role === 'admin';

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
            <NavLink key={item.href} item={item} onClick={onLinkClick} isAdmin={isAdmin} />
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={handleLogout} disabled={isUserLoading}>
          {isUserLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const router = useRouter();
  const { currentUser, userData, logOut, isUserLoading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme(); 
  
  const [incomingRequests, setIncomingRequests] = React.useState<FriendRequestForPopover[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(true);
  const [performingAction, setPerformingAction] = React.useState<Record<string, boolean>>({}); // For accept/decline buttons

  React.useEffect(() => {
    if (!currentUser?.uid) {
      setIncomingRequests([]);
      setLoadingRequests(false);
      return () => {}; // Unsubscribe fonksiyonu döndür
    }

    setLoadingRequests(true);
    const incomingQuery = query(
      collection(db, "friendRequests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc") 
    );

    const unsubscribe = onSnapshot(incomingQuery, async (snapshot) => {
      const reqPromises = snapshot.docs.map(async (reqDoc) => {
        const data = reqDoc.data();
        let userProfileData: UserData | undefined = undefined;
        try {
            const senderProfileDoc = await getDoc(doc(db, "users", data.fromUserId));
            if (senderProfileDoc.exists()) {
                userProfileData = { uid: senderProfileDoc.id, ...senderProfileDoc.data() } as UserData;
            }
        } catch (profileError) {
            console.error(`Error fetching profile for sender ${data.fromUserId}:`, profileError);
            // Profil alınamazsa bile isteği göstermeye devam et, sadece kullanıcı adı ile.
        }
        return {
          id: reqDoc.id,
          fromUserId: data.fromUserId,
          fromUsername: data.fromUsername, // Firestore'da bu alanın olduğundan emin olun
          fromAvatarUrl: data.fromAvatarUrl, // Firestore'da bu alanın olduğundan emin olun
          createdAt: data.createdAt as Timestamp, // Tip zorlaması
          userProfile: userProfileData,
        } as FriendRequestForPopover;
      });
      
      try {
        const resolvedRequests = await Promise.all(reqPromises);
        setIncomingRequests(resolvedRequests.filter(req => req !== null) as FriendRequestForPopover[]);
      } catch (error) {
        console.error("Error resolving request promises:", error);
        toast({ title: "Bildirim Hatası", description: "İstekler işlenirken bir sorun oluştu.", variant: "destructive" });
      } finally {
        setLoadingRequests(false);
      }
    }, (error) => {
      console.error("Error fetching incoming requests for popover:", error);
      toast({ title: "Bildirim Yükleme Hatası", description: "Arkadaşlık istekleri yüklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.", variant: "destructive" });
      setLoadingRequests(false);
    });
    
    return () => unsubscribe(); // Cleanup on unmount
  }, [currentUser?.uid, toast]);

  const setActionLoading = (id: string, isLoading: boolean) => {
    setPerformingAction(prev => ({ ...prev, [id]: isLoading }));
  };

  const handleAcceptRequestPopover = async (request: FriendRequestForPopover) => {
    if (!currentUser || !userData || !request.userProfile) { // request.userProfile kontrolü eklendi
        toast({ title: "Hata", description: "İstek kabul edilemedi, gönderen bilgileri eksik.", variant: "destructive" });
        return;
    }
    setActionLoading(request.id, true);
    try {
      const batch = writeBatch(db);
      // Friend request status'unu güncelle
      const requestRef = doc(db, "friendRequests", request.id);
      batch.update(requestRef, { status: "accepted" });

      // Mevcut kullanıcının arkadaş listesine ekle
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, request.fromUserId);
      batch.set(myFriendRef, { 
        displayName: request.userProfile.displayName, 
        photoURL: request.userProfile.photoURL,
        addedAt: serverTimestamp() 
      });

      // Diğer kullanıcının (isteği gönderenin) arkadaş listesine ekle
      const theirFriendRef = doc(db, `users/${request.fromUserId}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { 
        displayName: userData.displayName, 
        photoURL: userData.photoURL,
        addedAt: serverTimestamp() 
      });
      
      await batch.commit();
      toast({ title: "Başarılı", description: `${request.userProfile.displayName} ile arkadaş oldunuz.` });
      // incomingRequests onSnapshot ile otomatik güncellenecek
    } catch (error) {
      console.error("Error accepting friend request from popover:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(request.id, false);
    }
  };
  
  const handleDeclineRequestPopover = async (requestId: string) => {
    setActionLoading(requestId, true);
    try {
      // İsteği silmek yerine durumunu 'declined' olarak güncelleyebilir veya silebilirsiniz.
      // Silmek daha temiz bir yaklaşım olabilir.
      await deleteDoc(doc(db, "friendRequests", requestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği reddedildi." });
      // incomingRequests onSnapshot ile otomatik güncellenecek
    } catch (error) {
      console.error("Error declining friend request from popover:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği reddedilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(requestId, false);
    }
  };

  const getAvatarFallback = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (currentUser?.email) return currentUser.email.substring(0, 2).toUpperCase();
    return "SK"; // Sohbet Küresi
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-card lg:block">
        <SidebarContent />
      </div>
      <div className="flex flex-col">
        <header className="flex h-16 items-center gap-2 sm:gap-4 border-b bg-card px-4 sm:px-6 sticky top-0 z-30">
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Navigasyon menüsünü aç/kapat</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px] sm:w-[320px] z-50">
               <SheetHeader className="p-4 border-b"> {/* SheetHeader eklendi */}
                <SheetTitle className="text-lg font-semibold">Navigasyon Menüsü</SheetTitle>
              </SheetHeader>
              <SidebarContent onLinkClick={() => setMobileSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div className="w-full flex-1">
            {/* Header içeriği buraya gelebilir, örneğin arama çubuğu */}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {userData && (
              <div className="flex items-center gap-1 sm:gap-2 text-sm font-medium text-primary">
                <Gem className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                <span>{userData.diamonds}</span>
              </div>
            )}

            <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
              <span className="sr-only">Temayı Değiştir</span>
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {incomingRequests.length > 0 && (
                    <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                    </span>
                  )}
                  <span className="sr-only">Bildirimler</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <h3 className="text-sm font-medium text-foreground">Arkadaşlık İstekleri</h3>
                </div>
                {loadingRequests ? (
                  <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
                ) : incomingRequests.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Yeni arkadaşlık isteği yok.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {incomingRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 hover:bg-secondary/50 dark:hover:bg-secondary/20 border-b last:border-b-0">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={req.userProfile?.photoURL || req.fromAvatarUrl || "https://placehold.co/40x40.png"} data-ai-hint="person avatar request" />
                            <AvatarFallback>{getAvatarFallback(req.userProfile?.displayName || req.fromUsername)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate">{req.userProfile?.displayName || req.fromUsername || "Bilinmeyen Kullanıcı"}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-800/50 dark:text-green-400"
                            onClick={() => handleAcceptRequestPopover(req)}
                            disabled={performingAction[req.id] || !req.userProfile} // Eğer profil yoksa da disable et
                            aria-label="Kabul Et"
                          >
                            {performingAction[req.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-800/50 dark:text-red-400"
                            onClick={() => handleDeclineRequestPopover(req.id)}
                            disabled={performingAction[req.id]}
                            aria-label="Reddet"
                          >
                           {performingAction[req.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" disabled={!currentUser}>
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={currentUser?.photoURL || userData?.photoURL || "https://placehold.co/100x100.png"} alt="Kullanıcı avatarı" data-ai-hint="user avatar" />
                    <AvatarFallback>{getAvatarFallback(userData?.displayName || currentUser?.displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Kullanıcı menüsünü aç/kapat</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{userData?.displayName || currentUser?.displayName || currentUser?.email || "Hesabım"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" /> Profili Görüntüle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({title: "Ayarlar", description:"Bu özellik yakında eklenecektir."})}>
                  <Settings className="mr-2 h-4 w-4" /> Ayarlar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logOut} disabled={isUserLoading} className="text-destructive hover:!text-destructive focus:!text-destructive">
                  {isUserLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4" />} 
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 bg-background overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
