
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
  UserCog, 
  ListChecks,
  BellRing, // Bildirim için ikon
  BellOff, // Bildirim kapalıyken ikon
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
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  requestNotificationPermission, 
  subscribeUserToPush, 
  unsubscribeUserFromPush,
  isPushSubscribed as checkIsPushSubscribed,
  getNotificationPermissionStatus
} from '@/lib/notificationUtils';


interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  subItems?: NavItem[];
  isHeaderOnly?: boolean; 
}

const navItems: NavItem[] = [
  { href: '/', label: 'Anasayfa', icon: LayoutDashboard },
  { href: '/chat', label: 'Sohbet Odaları', icon: MessageSquare },
  { href: '/friends', label: 'Arkadaşlar', icon: Users },
  { href: '/profile', label: 'Profilim', icon: UserCircle },
  {
    href: '/admin/dashboard', 
    label: 'Admin Paneli',
    icon: ShieldCheck,
    adminOnly: true,
    isHeaderOnly: true, 
    subItems: [
      { href: '/admin/users', label: 'Kullanıcı Yönetimi', icon: UserCog, adminOnly: true },
      { href: '/admin/chat-rooms', label: 'Oda Yönetimi', icon: ListChecks, adminOnly: true },
    ],
  },
];

interface FriendRequestForPopover {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  createdAt: Timestamp;
  userProfile?: UserData;
}

function NavLink({ item, onClick, isAdmin, currentPathname }: { item: NavItem, onClick?: () => void, isAdmin?: boolean, currentPathname: string }) {
  const isActivePath = (path: string) => {
    if (path === '/') return currentPathname === '/';
    if (item.href.startsWith('/admin/') && item.subItems) {
        return currentPathname.startsWith(item.href) || item.subItems.some(sub => currentPathname === sub.href);
    }
    return currentPathname.startsWith(path);
  };
  
  const isDirectActive = currentPathname === item.href;
  const isParentOfActive = item.subItems?.some(subItem => currentPathname.startsWith(subItem.href)) ?? false;
  const finalIsActive = isDirectActive || isParentOfActive;


  if (item.adminOnly && !isAdmin) {
    return null;
  }

  if (item.subItems && item.subItems.length > 0) {
    return (
      <Accordion type="single" collapsible className="w-full" defaultValue={finalIsActive ? item.href : undefined}>
        <AccordionItem value={item.href} className="border-b-0">
          <AccordionTrigger
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all text-base lg:text-sm w-full justify-between hover:no-underline",
              finalIsActive 
                ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary"
                : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-primary/10",
              "dark:text-sidebar-foreground/70 dark:hover:text-sidebar-foreground dark:hover:bg-sidebar-primary/20",
              "[&[data-state=open]>svg:last-child]:rotate-180"
            )}
          >
             <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
          </AccordionTrigger>
          <AccordionContent className="pb-0 pl-5 pr-1 pt-1">
            <nav className="grid items-start gap-1">
              {item.subItems.map((subItem) => (
                <NavLink key={subItem.href} item={subItem} onClick={onClick} isAdmin={isAdmin} currentPathname={currentPathname}/>
              ))}
            </nav>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all text-base lg:text-sm",
        isDirectActive
          ? "bg-primary text-primary-foreground font-semibold shadow-sm" 
          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-primary/10",
        "dark:text-sidebar-foreground/70 dark:hover:text-sidebar-foreground dark:hover:bg-sidebar-primary/20",
        isDirectActive && "dark:bg-sidebar-primary dark:text-sidebar-primary-foreground"
      )}
      aria-current={isDirectActive ? "page" : undefined}
    >
      <item.icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const { logOut, isUserLoading: isAuthActionLoading, userData } = useAuth(); // Renamed isUserLoading to avoid conflict
  const { toast } = useToast(); 
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await logOut();
      if (onLinkClick) onLinkClick();
    } catch (error: any) {
      toast({ title: "Çıkış Hatası", description: error.message, variant: "destructive" });
    }
  };

  const isAdmin = userData?.role === 'admin';

  return (
    <div className="flex h-full max-h-screen flex-col gap-2 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-20 items-center border-b border-sidebar-border px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-primary dark:text-sidebar-primary">
          <Globe className="h-8 w-8" />
          <span className="text-xl font-headline">Sohbet Küresi</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-4 text-sm font-medium gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} onClick={onLinkClick} isAdmin={isAdmin} currentPathname={pathname} />
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 dark:text-sidebar-foreground/60 dark:hover:text-destructive-foreground dark:hover:bg-destructive/80 py-2.5" onClick={handleLogout} disabled={isAuthActionLoading}>
          {isAuthActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const router = useRouter();
  const { currentUser, userData, logOut, isUserLoading: isAuthActionLoading } = useAuth(); // Renamed isUserLoading
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [incomingRequests, setIncomingRequests] = React.useState<FriendRequestForPopover[]>([]);
  const [loadingRequests, setLoadingRequests] = React.useState(true);
  const [performingAction, setPerformingAction] = React.useState<Record<string, boolean>>({});
  const [incomingInitialized, setIncomingInitialized] = React.useState(false);

  // Notification states
  const [isNotificationPermissionGranted, setIsNotificationPermissionGranted] = React.useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = React.useState(false);
  const [isNotificationProcessing, setIsNotificationProcessing] = React.useState(false);


  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setIsNotificationPermissionGranted(getNotificationPermissionStatus() === 'granted');
      setIsPushSubscribed(checkIsPushSubscribed());
    }
  }, []);

  const handleTogglePushSubscription = async () => {
    setIsNotificationProcessing(true);
    if (isPushSubscribed) {
      const success = await unsubscribeUserFromPush();
      if (success) {
        toast({ title: "Bildirimler Kapatıldı", description: "Artık push bildirimleri almayacaksınız." });
        setIsPushSubscribed(false);
      } else {
        toast({ title: "Hata", description: "Bildirim aboneliği iptal edilemedi.", variant: "destructive" });
      }
    } else {
      if (!isNotificationPermissionGranted) {
        const permission = await requestNotificationPermission();
        if (permission === 'granted') {
          setIsNotificationPermissionGranted(true);
          const subscription = await subscribeUserToPush();
          if (subscription) {
            toast({ title: "Bildirimler Açıldı!", description: "Yeni mesajlar ve güncellemeler için bildirim alacaksınız." });
            setIsPushSubscribed(true);
          } else {
            toast({ title: "Abonelik Hatası", description: "Bildirimlere abone olunurken bir sorun oluştu.", variant: "destructive" });
            setIsNotificationPermissionGranted(false); // Geri al
          }
        } else {
          toast({ title: "İzin Verilmedi", description: "Bildirimlere izin vermediğiniz için abone olunamadı.", variant: "destructive" });
        }
      } else { // İzin zaten var, sadece abone ol
        const subscription = await subscribeUserToPush();
        if (subscription) {
          toast({ title: "Bildirimler Açıldı!", description: "Yeni mesajlar ve güncellemeler için bildirim alacaksınız." });
          setIsPushSubscribed(true);
        } else {
          toast({ title: "Abonelik Hatası", description: "Bildirimlere abone olunurken bir sorun oluştu.", variant: "destructive" });
        }
      }
    }
    setIsNotificationProcessing(false);
  };


  React.useEffect(() => {
    if (!currentUser?.uid) {
      setIncomingRequests([]);
      if (!incomingInitialized) {
        setLoadingRequests(false);
        setIncomingInitialized(true);
      }
      return () => {};
    }
    
    if (!incomingInitialized) setLoadingRequests(true);

    const incomingQuery = query(
      collection(db, "friendRequests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubscribeIncoming = onSnapshot(incomingQuery, async (snapshot) => {
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
        }
        return {
          id: reqDoc.id,
          fromUserId: data.fromUserId,
          fromUsername: data.fromUsername,
          fromAvatarUrl: data.fromAvatarUrl,
          createdAt: data.createdAt as Timestamp,
          userProfile: userProfileData,
        } as FriendRequestForPopover;
      });

      try {
        const resolvedRequests = (await Promise.all(reqPromises)).filter(req => req !== null) as FriendRequestForPopover[];
        setIncomingRequests(resolvedRequests);
      } catch (error) {
        console.error("Error resolving request promises for notifications:", error);
        if(incomingInitialized) { 
            toast({title: "Bildirim Hatası", description: "Arkadaşlık istekleri yüklenirken bir hata oluştu.", variant: "destructive"});
        }
      } finally {
         setLoadingRequests(false);
         if (!incomingInitialized) {
            setIncomingInitialized(true);
        }
      }
    }, (error) => {
      console.error("Error fetching incoming requests for popover:", error);
       if(incomingInitialized){
            toast({title: "Bildirim Hatası", description: "Arkadaşlık istekleri yüklenirken bir sorun oluştu.", variant: "destructive"});
       }
       setLoadingRequests(false); 
       if (!incomingInitialized) {
        setIncomingInitialized(true);
      }
    });

    return () => {
        unsubscribeIncoming();
    };
  }, [currentUser?.uid, incomingInitialized, toast]);


  const setActionLoading = (id: string, isLoading: boolean) => {
    setPerformingAction(prev => ({ ...prev, [id]: isLoading }));
  };

  const handleAcceptRequestPopover = async (request: FriendRequestForPopover) => {
    if (!currentUser || !userData || !request.userProfile) {
        toast({ title: "Hata", description: "İstek kabul edilemedi, gönderen bilgileri eksik.", variant: "destructive" });
        return;
    }
    setActionLoading(request.id, true);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, "friendRequests", request.id);
      batch.update(requestRef, { status: "accepted" });

      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, request.fromUserId);
      batch.set(myFriendRef, {
        displayName: request.userProfile.displayName,
        photoURL: request.userProfile.photoURL,
        addedAt: serverTimestamp()
      });

      const theirFriendRef = doc(db, `users/${request.fromUserId}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, {
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        addedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Başarılı", description: `${request.userProfile.displayName} ile arkadaş oldunuz.` });
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
      await deleteDoc(doc(db, "friendRequests", requestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği reddedildi." });
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
    return "SK";
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr] bg-background">
      <div className="hidden border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent />
      </div>
      <div className="flex flex-col">
        <header className="flex h-20 items-center gap-2 sm:gap-4 border-b border-border bg-card px-4 sm:px-6 sticky top-0 z-30">
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Navigasyon menüsünü aç/kapat</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px] sm:w-[320px] z-50 bg-sidebar border-r border-sidebar-border">
               <SheetHeader className="p-4 border-b border-sidebar-border">
                <SheetTitle className="text-lg font-semibold text-sidebar-foreground">Navigasyon Menüsü</SheetTitle>
              </SheetHeader>
              <SidebarContent onLinkClick={() => setMobileSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="w-full flex-1">
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userData && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-primary dark:text-yellow-400">
                <Gem className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>{userData.diamonds ?? 0}</span>
              </div>
            )}

            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Temayı Değiştir</span>
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full relative text-muted-foreground hover:text-foreground">
                  <Bell className="h-5 w-5" />
                  {incomingRequests.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                    </span>
                  )}
                  <span className="sr-only">Arkadaşlık İstekleri</span>
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
                      <div key={req.id} className="flex items-center justify-between p-3 hover:bg-secondary/50 dark:hover:bg-secondary/30 border-b last:border-b-0">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={req.userProfile?.photoURL || req.fromAvatarUrl || "https://placehold.co/40x40.png"} data-ai-hint="person avatar request" />
                            <AvatarFallback>{getAvatarFallback(req.userProfile?.displayName || req.fromUsername)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium truncate">{req.userProfile?.displayName || req.fromUsername || "Bilinmeyen Kullanıcı"}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-400/20"
                            onClick={() => handleAcceptRequestPopover(req)}
                            disabled={performingAction[req.id] || !req.userProfile}
                            aria-label="Kabul Et"
                          >
                            {performingAction[req.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-400/20"
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
                <Button variant="ghost" size="icon" className="rounded-full" disabled={!currentUser || isAuthActionLoading}>
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage src={currentUser?.photoURL || userData?.photoURL || "https://placehold.co/100x100.png"} alt="Kullanıcı avatarı" data-ai-hint="user avatar" />
                    <AvatarFallback>{getAvatarFallback(userData?.displayName || currentUser?.displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Kullanıcı menüsünü aç/kapat</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userData?.displayName || currentUser?.displayName || "Hesabım"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <UserCircle className="mr-2 h-4 w-4" /> Profili Görüntüle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({title: "Ayarlar", description:"Bu özellik yakında eklenecektir."})}>
                  <Settings className="mr-2 h-4 w-4" /> Ayarlar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleTogglePushSubscription} disabled={isNotificationProcessing || !('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window)}>
                  {isNotificationProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isPushSubscribed ? <BellOff className="mr-2 h-4 w-4 text-destructive"/> : <BellRing className="mr-2 h-4 w-4 text-primary"/>)}
                  {isPushSubscribed ? "Bildirimleri Kapat" : "Bildirimleri Aç"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logOut} disabled={isAuthActionLoading} className="text-destructive hover:!text-destructive focus:!text-destructive dark:hover:!bg-destructive/80 dark:focus:!bg-destructive/80 dark:hover:!text-destructive-foreground">
                  {isAuthActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4" />}
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
