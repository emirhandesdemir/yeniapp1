
"use client";

import type { ReactNode } from 'react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, // Admin paneli ikonu için
  MessageSquare,
  Users,
  LogOut, // Kaldırıldı ama gerekirse eklenebilir
  Settings, // Kaldırıldı ama gerekirse eklenebilir
  Bell,
  Loader2,
  Sun, // Tema değiştirme için kaldırıldı, ThemeContext kullanılıyor
  Moon, // Tema değiştirme için kaldırıldı, ThemeContext kullanılıyor
  SendHorizontal,
  Home,
  UserRound,
  Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useAuth, type UserData } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext'; // Tema için bu kullanılacak
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
import { UserCheck, UserX } from 'lucide-react';


interface FriendRequestForPopover {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  createdAt: Timestamp;
  userProfile?: UserData;
}

interface BottomNavItemType {
  href: string;
  label: string;
  icon: React.ElementType;
  activeIcon?: React.ElementType; // Aktif durum için farklı ikon (opsiyonel)
}

const bottomNavItems: BottomNavItemType[] = [
  { href: '/', label: 'Anasayfa', icon: Home, activeIcon: Home },
  { href: '/chat', label: 'Sohbet', icon: MessageSquare, activeIcon: MessageSquare },
  { href: '/friends', label: 'Arkadaşlar', icon: Users, activeIcon: Users },
  { href: '/profile', label: 'Profil', icon: UserRound, activeIcon: UserRound },
];

function BottomNavItem({ item, isActive }: { item: BottomNavItemType, isActive: boolean }) {
  const IconComponent = isActive && item.activeIcon ? item.activeIcon : item.icon;
  return (
    <Link href={item.href} className="flex flex-col items-center justify-center gap-1 flex-1 px-2 py-2.5">
      <IconComponent className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-xs", isActive ? "text-primary font-medium" : "text-muted-foreground")}>{item.label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, userData, logOut, isUserLoading: isAuthActionLoading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [incomingRequests, setIncomingRequests] = useState<FriendRequestForPopover[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [performingAction, setPerformingAction] = useState<Record<string, boolean>>({});
  const [incomingInitialized, setIncomingInitialized] = useState(false);

  useEffect(() => {
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
    return () => unsubscribeIncoming();
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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Minimal Top Header */}
      <header className="flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-border bg-card px-4 sm:px-6 sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary dark:text-sidebar-primary">
          <Flame className="h-7 w-7" /> {/* Instagram-like logo example */}
          <span className="text-xl font-headline hidden sm:inline">Sohbet Küresi</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {userData?.role === 'admin' && (
            <Link href="/admin/dashboard" passHref>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-primary w-9 h-9 sm:w-10 sm:h-10" aria-label="Admin Paneli">
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <Link href="/direct-messages" passHref>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground w-9 h-9 sm:w-10 sm:h-10" aria-label="Direkt Mesajlar">
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </Link>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative text-muted-foreground hover:text-foreground w-9 h-9 sm:w-10 sm:h-10" aria-label="Arkadaşlık İstekleri">
                <Bell className="h-5 w-5" />
                {incomingRequests.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                  </span>
                )}
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-background pt-4 pb-[calc(theme(spacing.16)+theme(spacing.4))] sm:pb-[calc(theme(spacing.16)+theme(spacing.6))]">
        {/* Content padding is applied here so that fixed bottom nav doesn't overlap.
            pb-16 for bottom nav height + p-4/p-6 for main content's own padding */}
        <div className="px-4 md:px-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-stretch justify-around shadow-top z-30">
        {bottomNavItems.map((item) => (
          <BottomNavItem key={item.href} item={item} isActive={pathname === item.href || (item.href === "/" && pathname === "/")} />
        ))}
      </nav>
    </div>
  );
}
