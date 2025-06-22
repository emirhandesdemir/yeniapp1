
"use client";

import type { ReactNode } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Loader2,
  Globe,
  UserRound,
  Phone,
  PhoneOff as PhoneOffIcon,
  UserPlus,
  Settings,
  MessageCircle,
  Compass,
  Users, 
  Shuffle,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useAuth, type UserData, checkUserPremium } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db, messaging as firebaseMessaging } from '@/lib/firebase';
import { onMessage } from 'firebase/messaging';
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
  orderBy,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { UserCheck, UserX, Star } from 'lucide-react';
import WelcomeOnboarding from '@/components/onboarding/WelcomeOnboarding';
import { InAppNotificationData, useInAppNotification } from '@/contexts/InAppNotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { requestNotificationPermission, subscribeUserToPush } from '@/lib/notificationUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { generateDmChatId } from '@/lib/utils';
import MinimizedChatWidget from '@/components/chat/MinimizedChatWidget';

interface FriendRequestForPopover {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  fromUserIsPremium?: boolean;
  createdAt: Timestamp;
  userProfile?: UserData;
}

interface BottomNavItemType {
  href: (uid?: string) => string;
  label: string;
  icon: React.ElementType;
  activeIcon?: React.ElementType;
}

interface IncomingCallInfo {
  callId: string;
  callerId: string;
  callerName: string | null;
  callerAvatar: string | null;
}

const bottomNavItems: BottomNavItemType[] = [
  { href: () => '/', label: 'Akış', icon: Globe, activeIcon: Globe }, // Corrected href to '/'
  { href: () => '/chat', label: 'Odalar', icon: Compass, activeIcon: Compass },
  { href: () => '/direct-messages', label: 'DM', icon: MessageCircle, activeIcon: MessageCircle },
  { href: () => '/match', label: 'Eşleş', icon: Shuffle, activeIcon: Shuffle },
  { href: () => '/friends', label: 'Arkadaşlar', icon: Users, activeIcon: UserPlus },
  { href: (uid) => uid ? `/profile/${uid}` : '/profile', label: 'Profil', icon: UserRound, activeIcon: UserRound },
];

function BottomNavItem({ item, isActive, currentUserUid }: { item: BottomNavItemType, isActive: boolean, currentUserUid?: string }) {
  const IconComponent = isActive && item.activeIcon ? item.activeIcon : item.icon;
  const finalHref = item.href(currentUserUid);
  return (
    <Link href={finalHref} className="flex flex-col items-center justify-center gap-0.5 flex-1 px-1 py-1.5 hover:bg-primary/5 transition-colors rounded-md group">
      <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/80")} />
      <span className={cn("text-[10px] sm:text-xs", isActive ? "text-primary font-semibold" : "text-muted-foreground group-hover:text-primary/80")}>{item.label}</span>
    </Link>
  );
}

const ONBOARDING_STORAGE_KEY = 'onboardingCompleted_v1_hiwewalk';
const LAST_SHOWN_DM_TIMESTAMPS_STORAGE_KEY = 'lastShownDmTimestamps_v1_hiwewalk';
const NOTIFIED_REQUEST_IDS_STORAGE_KEY = 'notifiedFriendRequestIds_v1_hiwewalk';

const pageVariants = {
  initial: { opacity: 0, y: 5 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -5 },
};

const pageTransition = { type: "tween", ease: "anticipate", duration: 0.3 };


export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, userData, isUserLoading: isAuthActionLoading, isUserDataLoading } = useAuth();
  const { toast } = useToast();
  const { showNotification: showInAppNotification } = useInAppNotification();

  const [incomingRequests, setIncomingRequests] = useState<FriendRequestForPopover[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [performingAction, setPerformingAction] = useState<Record<string, boolean>>({});
  const [incomingInitialized, setIncomingInitialized] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const notifiedRequestIdsRef = useRef(new Set<string>());
  const lastShownDmTimestampsRef = useRef<{[key: string]: number}>({});

  const [activeIncomingCall, setActiveIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      try {
        const storedNotifiedIds = localStorage.getItem(NOTIFIED_REQUEST_IDS_STORAGE_KEY);
        if (storedNotifiedIds) {
          notifiedRequestIdsRef.current = new Set<string>(JSON.parse(storedNotifiedIds));
        }
        const storedDmTimestamps = localStorage.getItem(LAST_SHOWN_DM_TIMESTAMPS_STORAGE_KEY);
        if (storedDmTimestamps) {
            lastShownDmTimestampsRef.current = JSON.parse(storedDmTimestamps);
        }
      } catch (e) { console.warn("Error reading from localStorage", e); }
    }
  }, []);

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try { localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true'); } catch (e) { console.warn("Failed to set onboarding flag in localStorage:", e); }
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const onboardingCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (currentUser && userData && !isUserDataLoading && !onboardingCompleted) {
          setShowOnboarding(true);
        }
      } catch (e) { console.warn("Error accessing localStorage for onboarding:", e); }
    }
  }, [isClient, currentUser, userData, isUserDataLoading]);

  useEffect(() => {
    if (!currentUser?.uid || !isClient) {
      setIncomingRequests([]);
      if (!incomingInitialized) { setLoadingRequests(false); setIncomingInitialized(true); }
      return;
    }
    if (!incomingInitialized) setLoadingRequests(true);

    const incomingQuery = query(collection(db, "friendRequests"), where("toUserId", "==", currentUser.uid), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const unsubscribeIncoming = onSnapshot(incomingQuery, async (snapshot) => {
      let newRequestsMadeThisSession = false;
      const reqPromises = snapshot.docs.map(async (reqDoc) => {
        const data = reqDoc.data();
        const requestId = reqDoc.id;
        let userProfileData: UserData | undefined = undefined;
        try {
          const senderProfileDoc = await getDoc(doc(db, "users", data.fromUserId));
          if (senderProfileDoc.exists()) userProfileData = { uid: senderProfileDoc.id, ...senderProfileDoc.data() } as UserData;
        } catch (e) { console.error(`Error fetching profile for sender ${data.fromUserId}:`, e); }

        if (data.status === "pending" && userProfileData && !notifiedRequestIdsRef.current.has(requestId)) {
          showInAppNotification({
            title: "Yeni Arkadaşlık İsteği",
            message: `${userProfileData.displayName || 'Bir kullanıcı'} sana arkadaşlık isteği gönderdi.`,
            type: 'friend_request',
            avatarUrl: userProfileData.photoURL,
            senderName: userProfileData.displayName,
            link: '/friends',
          });
          notifiedRequestIdsRef.current.add(requestId);
          newRequestsMadeThisSession = true;
        }
        return { id: requestId, fromUserId: data.fromUserId, fromUsername: userProfileData?.displayName || data.fromUsername, fromAvatarUrl: userProfileData?.photoURL || data.fromAvatarUrl, fromUserIsPremium: userProfileData ? checkUserPremium(userProfileData) : data.fromUserIsPremium || false, createdAt: data.createdAt as Timestamp, userProfile: userProfileData } as FriendRequestForPopover;
      });
      try {
        const resolvedRequests = (await Promise.all(reqPromises)).filter(req => req !== null) as FriendRequestForPopover[];
        setIncomingRequests(resolvedRequests);
        if (newRequestsMadeThisSession) {
          try { localStorage.setItem(NOTIFIED_REQUEST_IDS_STORAGE_KEY, JSON.stringify(Array.from(notifiedRequestIdsRef.current))); } catch(e) { console.warn("Error saving notified request IDs to localStorage", e); }
        }
      } catch (e) { console.error("Error resolving request promises for notifications:", e); }
      finally { setLoadingRequests(false); if (!incomingInitialized) setIncomingInitialized(true); }
    }, (e) => { console.error("Error fetching incoming requests:", e); setLoadingRequests(false); if (!incomingInitialized) setIncomingInitialized(true); });
    return () => unsubscribeIncoming();
  }, [currentUser?.uid, incomingInitialized, showInAppNotification, isClient]);

  useEffect(() => {
    if (!currentUser?.uid || !isClient) return;
    const dmsQuery = query(collection(db, "directMessages"), where("participantUids", "array-contains", currentUser.uid));
    const unsubscribeDms = onSnapshot(dmsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "modified" || change.type === "added") {
          const dmData = change.doc.data();
          const dmId = change.doc.id;
          if (dmData.lastMessageSenderId && dmData.lastMessageSenderId !== currentUser.uid && dmData.lastMessageTimestamp) {
            const lastMessageTimeMillis = (dmData.lastMessageTimestamp as Timestamp).toMillis();
            const lastShownTimeMillis = lastShownDmTimestampsRef.current[dmId];
            if ((!lastShownTimeMillis || lastMessageTimeMillis > lastShownTimeMillis) && pathname !== `/dm/${dmId}`) {
              const senderUid = dmData.lastMessageSenderId;
              let senderName = "Bir kullanıcı"; let senderAvatar: string | null = null;
              if (dmData.participantInfo && dmData.participantInfo[senderUid]) {
                senderName = dmData.participantInfo[senderUid].displayName || senderName;
                senderAvatar = dmData.participantInfo[senderUid].photoURL;
              } else {
                try {
                  const userSnap = await getDoc(doc(db, "users", senderUid));
                  if (userSnap.exists()) { const d = userSnap.data() as UserData; senderName = d.displayName || senderName; senderAvatar = d.photoURL; }
                } catch (e) { console.error("DM bildirim için gönderen bilgisi çekilemedi:", e); }
              }
              showInAppNotification({ title: `Yeni Mesaj: ${senderName}`, message: dmData.lastMessageText ? (dmData.lastMessageText.length > 50 ? dmData.lastMessageText.substring(0, 47) + "..." : dmData.lastMessageText) : "Bir mesaj gönderdi.", type: 'new_dm', avatarUrl: senderAvatar, senderName: senderName, link: `/dm/${dmId}` });
              const newTimestamps = { ...lastShownDmTimestampsRef.current, [dmId]: lastMessageTimeMillis };
              lastShownDmTimestampsRef.current = newTimestamps;
              try { localStorage.setItem(LAST_SHOWN_DM_TIMESTAMPS_STORAGE_KEY, JSON.stringify(newTimestamps)); } catch (e) { console.warn("Error writing DM timestamps to localStorage:", e); }
            }
          }
        }
      });
    }, (e) => { console.error("Error fetching DMs for notifications:", e); });
    return () => unsubscribeDms();
  }, [currentUser?.uid, pathname, isClient, showInAppNotification]);


  useEffect(() => {
    if (typeof window !== 'undefined' && firebaseMessaging && isClient) {
      const unsubscribeForeground = onMessage(firebaseMessaging, (payload) => {
        console.log('[AppLayout] FCM Foreground Message Received:', payload);
        showInAppNotification({
          title: payload.notification?.title || "Yeni Bildirim",
          message: payload.notification?.body || "",
          type: (payload.data?.type as InAppNotificationData['type']) || 'info',
          avatarUrl: payload.notification?.icon || payload.data?.avatarUrl,
          senderName: payload.data?.senderName,
          link: payload.data?.link || payload.fcmOptions?.link,
        });
      });
      return () => unsubscribeForeground();
    }
  }, [isClient, showInAppNotification]);


  useEffect(() => {
    if (isClient && currentUser && userData) {
      const checkPermissionAndSubscribe = async () => {
        if (typeof Notification === 'undefined') {
          console.warn("Notification API is not available in this environment. Skipping push subscription.");
          return;
        }
        const currentPermission = Notification.permission;
        if (currentPermission === 'default') {
          const newPermission = await requestNotificationPermission();
          if (newPermission === 'granted') {
            await subscribeUserToPush();
          }
        } else if (currentPermission === 'granted') {

           await subscribeUserToPush();
        }
      };

      const timer = setTimeout(checkPermissionAndSubscribe, 3000);
      return () => clearTimeout(timer);
    }
  }, [isClient, currentUser, userData]);


  const handleAcceptCall = useCallback(async () => {
    if (!activeIncomingCall) return;
    try {
      await updateDoc(doc(db, "directCalls", activeIncomingCall.callId), {
        status: 'active',
        updatedAt: serverTimestamp()
      });
      setIsCallModalOpen(false);
      router.push(`/call/${activeIncomingCall.callId}`);
    } catch (error) {
      console.error("Error accepting call:", error);
      toast({ title: "Çağrı Hatası", description: "Çağrı kabul edilirken bir sorun oluştu.", variant: "destructive" });
    }
  }, [activeIncomingCall, router, toast]);

  const handleRejectCall = useCallback(async () => {
    if (!activeIncomingCall) return;
    try {
      await updateDoc(doc(db, "directCalls", activeIncomingCall.callId), {
        status: 'rejected',
        endedReason: 'callee_rejected',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Çağrı Reddedildi", description: `${activeIncomingCall.callerName || 'Arayan'} çağrısı reddedildi.` });
    } catch (error) {
      console.error("Error rejecting call:", error);
      toast({ title: "Çağrı Hatası", description: "Çağrı reddedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsCallModalOpen(false);
      setActiveIncomingCall(null);
    }
  }, [activeIncomingCall, toast]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const callsQuery = query(collection(db, "directCalls"), where("calleeId", "==", currentUser.uid), where("status", "in", ["initiating", "ringing"]), orderBy("createdAt", "desc"));
    const unsubscribeCalls = onSnapshot(callsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0]; const callData = callDoc.data();
        if (activeIncomingCall?.callId === callDoc.id && isCallModalOpen) return;
        if (pathname.startsWith(`/call/${callDoc.id}`)) return;
        if (callData.status === "initiating") {
          updateDoc(doc(db, "directCalls", callDoc.id), { status: "ringing", updatedAt: serverTimestamp() })
            .then(() => {
              setActiveIncomingCall({ callId: callDoc.id, callerId: callData.callerId, callerName: callData.callerName, callerAvatar: callData.callerAvatar });
              setIsCallModalOpen(true);
            }).catch(err => console.error("Error updating call status to ringing:", err));
        } else if (callData.status === "ringing") {
          setActiveIncomingCall({ callId: callDoc.id, callerId: callData.callerId, callerName: callData.callerName, callerAvatar: callData.callerAvatar });
          setIsCallModalOpen(true);
        }
      } else { if (isCallModalOpen) { setIsCallModalOpen(false); setActiveIncomingCall(null); } }
    }, (e) => { console.error("Error listening for incoming calls:", e); toast({ title: "Çağrı Hatası", description: "Gelen çağrılar dinlenirken bir sorun oluştu.", variant: "destructive" }); });
    return () => unsubscribeCalls();
  }, [currentUser?.uid, toast, activeIncomingCall, isCallModalOpen, pathname]);

  const setActionLoading = useCallback((id: string, isLoading: boolean) => { setPerformingAction(prev => ({ ...prev, [id]: isLoading })); }, []);

  const handleAcceptRequestPopover = useCallback(async (request: FriendRequestForPopover) => {
    if (!currentUser || !userData || !request.userProfile) { toast({ title: "Hata", description: "İstek kabul edilemedi, gönderen bilgileri eksik.", variant: "destructive" }); return; }
    setActionLoading(request.id, true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "friendRequests", request.id), { status: "accepted" });
      batch.set(doc(db, `users/${currentUser.uid}/confirmedFriends`, request.fromUserId), { displayName: request.userProfile.displayName, photoURL: request.userProfile.photoURL, isPremium: request.userProfile.isPremium || false, addedAt: serverTimestamp() });
      batch.set(doc(db, `users/${request.fromUserId}/confirmedFriends`, currentUser.uid), { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: checkUserPremium(userData), addedAt: serverTimestamp() });
      await batch.commit();
      const dmChatId = generateDmChatId(currentUser.uid, request.fromUserId);
      const dmChatDocRef = doc(db, "directMessages", dmChatId);
      const dmChatDocSnap = await getDoc(dmChatDocRef);
      const participantInfoUpdate = {
        [currentUser.uid]: { displayName: userData.displayName, photoURL: userData.photoURL, isPremium: checkUserPremium(userData) },
        [request.fromUserId]: { displayName: request.userProfile.displayName, photoURL: request.userProfile.photoURL, isPremium: request.userProfile.isPremium || false },
      };
      if (!dmChatDocSnap.exists()) {
        await setDoc(dmChatDocRef, { participantUids: [currentUser.uid, request.fromUserId].sort(), participantInfo: participantInfoUpdate, createdAt: serverTimestamp(), lastMessageTimestamp: null });
      } else { await updateDoc(dmChatDocRef, { participantInfo: participantInfoUpdate }); }
      toast({ title: "Başarılı", description: `${request.userProfile.displayName} ile arkadaş oldunuz.` });
    } catch (e) { console.error("Error accepting friend request:", e); toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" }); }
    finally { setActionLoading(request.id, false); }
  }, [currentUser, userData, toast, setActionLoading]);

  const handleDeclineRequestPopover = useCallback(async (requestId: string) => {
    setActionLoading(requestId, true);
    try { await deleteDoc(doc(db, "friendRequests", requestId)); toast({ title: "Başarılı", description: "Arkadaşlık isteği reddedildi." }); }
    catch (e) { console.error("Error declining friend request:", e); toast({ title: "Hata", description: "Arkadaşlık isteği reddedilemedi.", variant: "destructive" }); }
    finally { setActionLoading(requestId, false); }
  }, [toast, setActionLoading]);

  const getAvatarFallback = useCallback((name?: string | null) => (name ? name.substring(0, 2).toUpperCase() : currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : "HW"), [currentUser?.email]);

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isSpecialPage = isAuthPage || pathname.startsWith('/admin') || pathname.startsWith('/call');

  const mainContentClasses = cn("flex-1 overflow-auto bg-background", isSpecialPage ? "p-0" : "px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-[calc(theme(spacing.16)+theme(spacing.3))] sm:pb-[calc(theme(spacing.16)+theme(spacing.4))]");
  
  if (isAuthPage || isAuthActionLoading) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {!isSpecialPage && (
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-3 sm:px-4 sticky top-0 z-30 shadow-sm">
          <Link href="/" aria-label="Anasayfa" className="text-xl font-bold text-primary font-headline">HiweWalk</Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
             <Button asChild variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground w-8 h-8 sm:w-9 sm:h-9" aria-label="Ayarlar">
                <Link href="/settings"><Settings className="h-4 w-4 sm:h-5 sm:w-5" /></Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <div role="button" tabIndex={0} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full relative text-muted-foreground hover:text-foreground w-8 h-8 sm:w-9 sm:h-9 cursor-pointer flex items-center justify-center")} aria-label="Arkadaşlık İstekleri">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {incomingRequests.length > 0 && (<span className="absolute top-1 right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span></span>)}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 rounded-lg shadow-xl border-border/50" align="end">
                <div className="p-3 border-b border-border/30"><h3 className="text-sm font-medium text-foreground">Arkadaşlık İstekleri</h3></div>
                {loadingRequests ? (<div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>) : incomingRequests.length === 0 ? (<p className="p-4 text-sm text-muted-foreground text-center">Yeni arkadaşlık isteği yok.</p>) : (
                  <div className="max-h-80 overflow-y-auto">
                    {incomingRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 hover:bg-secondary/50 dark:hover:bg-secondary/20 border-b border-border/20 last:border-b-0 transition-colors">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-8 w-8"><AvatarImage src={req.userProfile?.photoURL || req.fromAvatarUrl || "https://placehold.co/40x40.png"} data-ai-hint="person avatar request" /><AvatarFallback>{getAvatarFallback(req.userProfile?.displayName || req.fromUsername)}</AvatarFallback></Avatar>
                            {req.fromUserIsPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
                          </div>
                          <span className="text-xs font-medium truncate flex-1">{req.userProfile?.displayName || req.fromUsername || "Bilinmeyen Kullanıcı"}</span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-400/20 rounded-full" onClick={() => handleAcceptRequestPopover(req)} disabled={performingAction[req.id] || !req.userProfile} aria-label="Kabul Et">{performingAction[req.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="h-4 w-4" />}</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-400/20 rounded-full" onClick={() => handleDeclineRequestPopover(req.id)} disabled={performingAction[req.id]} aria-label="Reddet">{performingAction[req.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4" />}</Button>
                        </div>
                      </div>))}
                  </div>)}
                  {incomingRequests.length > 0 && (
                    <div className="p-2 border-t border-border/30">
                        <Button asChild variant="link" size="sm" className="w-full text-xs text-primary hover:text-primary/80">
                            <Link href="/friends">Tüm İstekleri Gör</Link>
                        </Button>
                    </div>
                  )}
              </PopoverContent>
            </Popover>
          </div>
        </header>
      )}
      {isClient ? (<AnimatePresence mode="wait"><motion.main key={pathname} className={cn(mainContentClasses, "flex flex-col")} variants={pageVariants} initial="initial" animate="in" exit="out" transition={pageTransition}>{children}</motion.main></AnimatePresence>) : (<main className={cn(mainContentClasses, "flex flex-col")}>{children}</main>)}
      {isClient && showOnboarding && <WelcomeOnboarding isOpen={showOnboarding} onClose={handleCloseOnboarding} />}
      {isClient && <MinimizedChatWidget />}
      {isClient && activeIncomingCall && (
        <Dialog open={isCallModalOpen} onOpenChange={(isOpen) => { if (!isOpen && activeIncomingCall) handleRejectCall(); setIsCallModalOpen(isOpen); if (!isOpen) setActiveIncomingCall(null); }}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden shadow-2xl border-primary rounded-xl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader className="bg-gradient-to-br from-primary to-accent text-primary-foreground p-6 text-center items-center">
              <Avatar className="h-20 w-20 mb-3 border-2 border-primary-foreground/50 rounded-full"><AvatarImage src={activeIncomingCall.callerAvatar || "https://placehold.co/80x80.png"} data-ai-hint="caller avatar modal"/><AvatarFallback className="text-3xl bg-primary-foreground/20 text-primary-foreground rounded-full">{getAvatarFallback(activeIncomingCall.callerName)}</AvatarFallback></Avatar>
              <DialogTitle className="text-2xl font-bold">{activeIncomingCall.callerName || "Bilinmeyen Kullanıcı"}</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 text-base">sizi arıyor...</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-3 p-6 bg-card">
              <Button onClick={handleRejectCall} variant="destructive" className="flex-1 h-12 text-base rounded-lg"><PhoneOffIcon className="mr-2 h-5 w-5"/> Reddet</Button>
              <Button onClick={handleAcceptCall} className="flex-1 h-12 text-base bg-green-500 hover:bg-green-600 text-white rounded-lg"><Phone className="mr-2 h-5 w-5"/> Kabul Et</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {!isSpecialPage && isClient && currentUser && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-stretch justify-around shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.07)] z-30">
          {bottomNavItems.map((item) => (<BottomNavItem key={item.label} item={item} isActive={item.label === 'Profil' ? pathname.startsWith('/profile') || pathname.startsWith('/settings') : pathname === item.href(currentUser?.uid) || (item.label === 'Akış' && pathname === '/')} currentUserUid={currentUser?.uid}/>))}
        </nav>
      )}
    </div>
  );
}
