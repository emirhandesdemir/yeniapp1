
"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, UserCheck, Search, MessageCircle, Trash2, Loader2, Users, AlertTriangle, Send, BellRing, Phone, Star, MoreVertical, Flag, Ban, UserX } from "lucide-react";
import { useAuth, type UserData, checkUserPremium } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  limit,
  getDocs,
  setDoc,
  updateDoc, // updateDoc eklendi
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { generateDmChatId, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface Friend extends UserData {
  addedAt?: Timestamp;
  isPremium?: boolean; 
  avatarFrameStyle?: string;
}

interface SearchResultUser extends UserData {
  isFriend?: boolean;
  isRequestSent?: boolean;
  isRequestReceived?: boolean;
  outgoingRequestId?: string | null; 
  incomingRequestId?: string | null; 
  isPremium?: boolean; 
  isBlockedByCurrentUser?: boolean;
  avatarFrameStyle?: string;
}

export default function FriendsPage() {
  const { currentUser, userData, isUserLoading: isAuthLoading, isCurrentUserPremium, reportUser, blockUser, unblockUser, checkIfUserBlocked } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [myFriends, setMyFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);

  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [performingAction, setPerformingAction] = useState<Record<string, boolean>>({});
  
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportingUser, setReportingUser] = useState<SearchResultUser | Friend | null>(null);


  useEffect(() => {
    document.title = 'Arkadaşlarım - HiweWalk';
  }, []);

  const fetchFriends = useCallback(async () => {
    if (!currentUser?.uid) {
      setLoadingFriends(false);
      setMyFriends([]);
      return;
    }
    setLoadingFriends(true);
    const friendsRef = collection(db, `users/${currentUser.uid}/confirmedFriends`);
    const q = query(friendsRef, orderBy("addedAt", "desc")); 
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const friendsPromises = snapshot.docs.map(async (friendDoc) => {
        const friendData = friendDoc.data();
        try {
            const userProfileDoc = await getDoc(doc(db, "users", friendDoc.id));
            if (userProfileDoc.exists()) {
            const profile = userProfileDoc.data() as UserData;
            return {
                uid: friendDoc.id,
                ...profile,
                isPremium: checkUserPremium(profile), 
                addedAt: friendData.addedAt
            } as Friend;
            }
        } catch (error) {
            console.error("Error fetching profile for friend:", friendDoc.id, error);
        }
        return {
          uid: friendDoc.id,
          displayName: friendData.displayName || "Bilinmeyen Kullanıcı",
          photoURL: friendData.photoURL || null,
          email: friendData.email || null, 
          diamonds: friendData.diamonds || 0, 
          role: friendData.role || 'user', 
          createdAt: friendData.addedAt || Timestamp.now(), 
          isPremium: friendData.isPremium || false, 
          addedAt: friendData.addedAt
        } as Friend;
      });
      
      try {
        const resolvedFriends = (await Promise.all(friendsPromises)).filter(f => f !== null) as Friend[];
        setMyFriends(resolvedFriends);
      } catch (error) {
         console.error("Error resolving friend profiles:", error);
         toast({ title: "Hata", description: "Arkadaş profilleri yüklenirken bir sorun oluştu.", variant: "destructive" });
      } finally {
        setLoadingFriends(false);
      }
    }, (error) => {
      console.error("Error fetching friends with onSnapshot:", error);
      toast({ title: "Hata", description: "Arkadaşlar yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingFriends(false);
    });
    
    return unsubscribe;
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    const unsubscribe = fetchFriends();
    return () => {
      unsubscribe.then(unsub => {
        if (unsub) unsub();
      }).catch(err => console.error("Error unsubscribing from friends listener:", err));
    };
  }, [fetchFriends]);


  const handleSearchUsers = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim() || !currentUser) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const usersRef = collection(db, "users");
      const nameQuery = query(usersRef, where("displayName", ">=", searchTerm), where("displayName", "<=", searchTerm + '\uf8ff'), limit(10));
      const emailQuery = query(usersRef, where("email", "==", searchTerm.toLowerCase()), limit(10));

      const [nameSnapshot, emailSnapshot] = await Promise.all([
        getDocs(nameQuery),
        getDocs(emailQuery)
      ]);

      const resultsMap = new Map<string, UserData>();
      nameSnapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) resultsMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserData)
      });
      emailSnapshot.forEach(doc => {
         if (doc.id !== currentUser.uid) resultsMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserData)
      });

      const rawResults = Array.from(resultsMap.values());
      const processedResults: SearchResultUser[] = [];

      for (const user of rawResults) {
        let processedUser: SearchResultUser = { ...user, isPremium: checkUserPremium(user), avatarFrameStyle: user.avatarFrameStyle || 'default' }; 
        processedUser.isFriend = myFriends.some(f => f.uid === user.uid);
        processedUser.isBlockedByCurrentUser = await checkIfUserBlocked(user.uid);


        if (!processedUser.isFriend && !processedUser.isBlockedByCurrentUser) {
          const outgoingQuery = query(collection(db, "friendRequests"),
            where("fromUserId", "==", currentUser.uid),
            where("toUserId", "==", user.uid),
            where("status", "==", "pending")
          );
          const outgoingSnap = await getDocs(outgoingQuery);
          if (!outgoingSnap.empty) {
            processedUser.isRequestSent = true;
            processedUser.outgoingRequestId = outgoingSnap.docs[0].id;
          }

          if (!processedUser.isRequestSent) {
            const incomingQuery = query(collection(db, "friendRequests"),
              where("fromUserId", "==", user.uid),
              where("toUserId", "==", currentUser.uid),
              where("status", "==", "pending")
            );
            const incomingSnap = await getDocs(incomingQuery);
            if(!incomingSnap.empty) {
              processedUser.isRequestReceived = true;
              processedUser.incomingRequestId = incomingSnap.docs[0].id; 
            }
          }
        }
        processedResults.push(processedUser);
      }
      setSearchResults(processedResults);

    } catch (error) {
      console.error("Error searching users:", error);
      toast({ title: "Hata", description: "Kullanıcı aranırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setLoadingSearch(false);
    }
  }, [searchTerm, currentUser, myFriends, toast, checkIfUserBlocked]);

  const setActionLoading = useCallback((id: string, isLoading: boolean) => {
    setPerformingAction(prev => ({ ...prev, [id]: isLoading }));
  }, []);

  const handleSendFriendRequest = useCallback(async (targetUser: SearchResultUser) => {
    if (!currentUser || !userData || !targetUser.uid || targetUser.isFriend || targetUser.isRequestSent || targetUser.isRequestReceived || targetUser.isBlockedByCurrentUser) return;
    setActionLoading(targetUser.uid, true);
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();
    try {
      const newRequestRef = await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid,
        fromUsername: userData.displayName,
        fromAvatarUrl: userData.photoURL,
        fromUserIsPremium: currentUserIsCurrentlyPremium, 
        toUserId: targetUser.uid,
        toUsername: targetUser.displayName,
        toAvatarUrl: targetUser.photoURL,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: `${targetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` });
      setSearchResults(prev => prev.map(u =>
        u.uid === targetUser.uid ? {...u, isRequestSent: true, outgoingRequestId: newRequestRef.id } : u
      ));
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(targetUser.uid, false);
    }
  }, [currentUser, userData, toast, setActionLoading, isCurrentUserPremium]);

  const handleCancelOutgoingRequest = useCallback(async (targetUser: SearchResultUser) => {
    if (!currentUser || !targetUser.outgoingRequestId) {
        toast({ title: "Hata", description: "İptal edilecek istek ID'si bulunamadı.", variant: "destructive" });
        return;
    }
    const requestId = targetUser.outgoingRequestId;
    setActionLoading(requestId, true); 
    try {
      await deleteDoc(doc(db, "friendRequests", requestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği iptal edildi." });
       setSearchResults(prev => prev.map(u =>
        u.uid === targetUser.uid ? {...u, isRequestSent: false, outgoingRequestId: null, isRequestReceived: false } : u
      ));
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği iptal edilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(requestId, false);
    }
  }, [currentUser, toast, setActionLoading]);

  const handleAcceptIncomingRequest = useCallback(async (targetUser: SearchResultUser) => {
    if (!currentUser || !userData || !targetUser.incomingRequestId || !targetUser.uid) {
      toast({ title: "Hata", description: "İstek kabul edilemedi.", variant: "destructive" });
      return;
    }
    const requestId = targetUser.incomingRequestId;
    setActionLoading(requestId, true);
    try {
        const batch = writeBatch(db);
        const requestRef = doc(db, "friendRequests", requestId);
        batch.update(requestRef, { status: "accepted" });

        const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, targetUser.uid);
        batch.set(myFriendRef, { 
            displayName: targetUser.displayName, 
            photoURL: targetUser.photoURL,
            isPremium: targetUser.isPremium,
            addedAt: serverTimestamp() 
        });
        
        const theirFriendRef = doc(db, `users/${targetUser.uid}/confirmedFriends`, currentUser.uid);
        batch.set(theirFriendRef, { 
            displayName: userData.displayName, 
            photoURL: userData.photoURL,
            isPremium: isCurrentUserPremium(),
            addedAt: serverTimestamp() 
        });
        await batch.commit();

        const dmChatId = generateDmChatId(currentUser.uid, targetUser.uid);
        const dmChatDocRef = doc(db, "directMessages", dmChatId);
        const dmChatDocSnap = await getDoc(dmChatDocRef);

        if (!dmChatDocSnap.exists()) {
            await setDoc(dmChatDocRef, {
            participantUids: [currentUser.uid, targetUser.uid].sort(),
            participantInfo: {
                [currentUser.uid]: {
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                isPremium: isCurrentUserPremium(),
                },
                [targetUser.uid]: {
                displayName: targetUser.displayName,
                photoURL: targetUser.photoURL,
                isPremium: targetUser.isPremium,
                },
            },
            createdAt: serverTimestamp(),
            lastMessageTimestamp: null,
            });
        } else {
             await updateDoc(dmChatDocRef, {
                [`participantInfo.${currentUser.uid}`]: {
                    displayName: userData.displayName,
                    photoURL: userData.photoURL,
                    isPremium: isCurrentUserPremium(),
                },
                [`participantInfo.${targetUser.uid}`]: {
                    displayName: targetUser.displayName,
                    photoURL: targetUser.photoURL,
                    isPremium: targetUser.isPremium,
                },
                 lastMessageTimestamp: dmChatDocSnap.data()?.lastMessageTimestamp || serverTimestamp() // Mevcutsa koru, yoksa güncelle
            }, { merge: true });
        }

        toast({ title: "Başarılı", description: `${targetUser.displayName} ile arkadaş oldunuz.` });
        setSearchResults(prev => prev.map(u => u.uid === targetUser.uid ? {...u, isFriend: true, isRequestReceived: false, incomingRequestId: null } : u));
        // fetchFriends(); // onSnapshot zaten listeyi güncelleyecektir.
    } catch (error) {
        console.error("Error accepting friend request:", error);
        toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally {
        setActionLoading(requestId, false);
    }
  }, [currentUser, userData, toast, setActionLoading, isCurrentUserPremium]);

  const handleDeclineIncomingRequest = useCallback(async (targetUser: SearchResultUser) => {
    if (!currentUser || !targetUser.incomingRequestId) return;
    const requestId = targetUser.incomingRequestId;
    setActionLoading(requestId, true);
    try {
        await deleteDoc(doc(db, "friendRequests", requestId));
        toast({ title: "Başarılı", description: "Arkadaşlık isteği reddedildi."});
        setSearchResults(prev => prev.map(u => u.uid === targetUser.uid ? {...u, isRequestReceived: false, incomingRequestId: null} : u));
    } catch (error) {
        console.error("Error declining friend request:", error);
        toast({ title: "Hata", description: "Arkadaşlık isteği reddedilemedi.", variant: "destructive" });
    } finally {
        setActionLoading(requestId, false);
    }
  }, [currentUser, toast, setActionLoading]);


  const handleRemoveFriend = useCallback(async (friendId: string, friendName: string) => {
    if (!currentUser || !confirm(`${friendName} adlı kullanıcıyı arkadaşlıktan çıkarmak istediğinizden emin misiniz?`)) return;
    setActionLoading(friendId, true);
    try {
      const batch = writeBatch(db);
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, friendId);
      batch.delete(myFriendRef);
      const theirFriendRef = doc(db, `users/${friendId}/confirmedFriends`, currentUser.uid);
      batch.delete(theirFriendRef);

      const requestQuery1 = query(collection(db, "friendRequests"),
        where("status", "==", "accepted"),
        where("fromUserId", "==", currentUser.uid),
        where("toUserId", "==", friendId)
      );
      const requestQuery2 = query(collection(db, "friendRequests"),
        where("status", "==", "accepted"),
        where("fromUserId", "==", friendId),
        where("toUserId", "==", currentUser.uid)
      );

      const [requestSnap1, requestSnap2] = await Promise.all([
        getDocs(requestQuery1),
        getDocs(requestQuery2)
      ]);

      requestSnap1.forEach(doc => batch.delete(doc.ref));
      requestSnap2.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      toast({ title: "Başarılı", description: `${friendName} arkadaşlıktan çıkarıldı.` });
      // fetchFriends(); // onSnapshot zaten listeyi güncelleyecektir.
      setSearchResults(prevResults => prevResults.map(sr =>
        sr.uid === friendId ? { ...sr, isFriend: false, isRequestSent: false, isRequestReceived: false, outgoingRequestId: null, incomingRequestId: null } : sr
      ));
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({ title: "Hata", description: "Arkadaş çıkarılamadı.", variant: "destructive" });
    } finally {
      setActionLoading(friendId, false);
    }
  }, [currentUser, toast, setActionLoading]);

  const handleInitiateCall = useCallback(async (targetFriend: Friend) => {
    if (!currentUser || !userData || !targetFriend.uid) {
      toast({ title: "Hata", description: "Arama başlatılamadı. Kullanıcı bilgileri eksik.", variant: "destructive" });
      return;
    }
    setActionLoading(`call-${targetFriend.uid}`, true);
    const callId = doc(collection(db, "directCalls")).id;
    const currentUserIsCurrentlyPremium = isCurrentUserPremium();

    try {
      const callDocRef = doc(db, "directCalls", callId);
      await setDoc(callDocRef, {
        callId: callId,
        callerId: currentUser.uid,
        callerName: userData.displayName,
        callerAvatar: userData.photoURL,
        callerIsPremium: currentUserIsCurrentlyPremium, 
        calleeId: targetFriend.uid,
        calleeName: targetFriend.displayName,
        calleeAvatar: targetFriend.photoURL,
        calleeIsPremium: targetFriend.isPremium, 
        status: "initiating",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Arama Başlatılıyor...", description: `${targetFriend.displayName} aranıyor.` });
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error("Error initiating call:", error);
      toast({ title: "Arama Hatası", description: "Arama başlatılırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setActionLoading(`call-${targetFriend.uid}`, false);
    }
  }, [currentUser, userData, router, toast, setActionLoading, isCurrentUserPremium]);

  const handleReportUserAction = async () => {
    if (!reportingUser) return;
    setIsReportDialogOpen(false);
    await reportUser(reportingUser.uid, reportReason.trim() || "Belirtilmedi");
    setReportReason("");
    setReportingUser(null);
  };

  const handleBlockOrUnblockUser = async (targetUser: SearchResultUser | Friend) => {
    if (!currentUser || !targetUser) return;
    setActionLoading(`block-${targetUser.uid}`, true);
    const currentlyBlocked = 'isBlockedByCurrentUser' in targetUser ? targetUser.isBlockedByCurrentUser : await checkIfUserBlocked(targetUser.uid);

    if (currentlyBlocked) {
        await unblockUser(targetUser.uid);
        if ('isBlockedByCurrentUser' in targetUser) {
            setSearchResults(prev => prev.map(u => u.uid === targetUser.uid ? {...u, isBlockedByCurrentUser: false} : u));
        }
    } else {
        await blockUser(targetUser.uid, targetUser.displayName, targetUser.photoURL); // displayName ve photoURL eklendi
         if ('isBlockedByCurrentUser' in targetUser) {
            setSearchResults(prev => prev.map(u => u.uid === targetUser.uid ? {...u, isBlockedByCurrentUser: true, isRequestSent: false, isRequestReceived: false, outgoingRequestId: null, incomingRequestId: null } : u));
        }
    }
    setActionLoading(`block-${targetUser.uid}`, false);
  };

  const getAvatarFallback = useCallback((name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "??";
  }, []);


  if (isAuthLoading && !currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser) {
     return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md text-center p-6">
            <CardHeader>
                <Users className="mx-auto h-12 w-12 text-primary mb-4" />
                <CardTitle>Giriş Gerekli</CardTitle>
                <CardDescription>Arkadaşlarınızı görmek ve yönetmek için lütfen <Link href="/login?redirect=/friends" className="text-primary hover:underline">giriş yapın</Link>.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Arkadaşlar</CardTitle>
          <CardDescription>Arkadaşlarınla bağlantıda kal, yeni bağlantılar kur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my-friends" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
              <TabsTrigger value="my-friends" className="text-xs sm:text-sm">Arkadaşlarım ({myFriends.length})</TabsTrigger>
              <TabsTrigger value="add-friend" className="text-xs sm:text-sm">Arkadaş Ekle</TabsTrigger>
            </TabsList>

            <TabsContent value="my-friends">
              {loadingFriends ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : myFriends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz hiç arkadaşın yok. "Arkadaş Ekle" sekmesinden yeni arkadaşlar bulabilirsin.</p>
              ) : (
                <ul className="space-y-3 sm:space-y-4">
                  {myFriends.map(friend => (
                    <li key={friend.uid} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                      <Link href={`/profile/${friend.uid}`} className="flex items-center gap-3 flex-grow min-w-0">
                        <div className={cn('relative', `avatar-frame-${friend.avatarFrameStyle || 'default'}`)}>
                            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                            <AvatarImage src={friend.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar" />
                            <AvatarFallback>{getAvatarFallback(friend.displayName)}</AvatarFallback>
                            </Avatar>
                            {friend.isPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm sm:text-base hover:underline">{friend.displayName || "İsimsiz"}</p>
                        </div>
                      </Link>
                      <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                            onClick={() => handleInitiateCall(friend)}
                            disabled={performingAction[`call-${friend.uid}`]}
                            aria-label="Sesli Ara"
                        >
                            {performingAction[`call-${friend.uid}`] ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin"/> : <Phone className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-primary hover:text-primary/80">
                          <Link href={`/dm/${generateDmChatId(currentUser.uid, friend.uid)}`} aria-label="Mesaj Gönder">
                             <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setReportingUser(friend); setIsReportDialogOpen(true); }}>
                                    <Flag className="mr-2 h-4 w-4 text-orange-500" /> Şikayet Et
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBlockOrUnblockUser(friend)}>
                                    <Ban className="mr-2 h-4 w-4" /> Engelle
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRemoveFriend(friend.uid, friend.displayName || 'bu arkadaşı')} className="text-destructive focus:text-destructive">
                                    <UserX className="mr-2 h-4 w-4" /> Arkadaşlıktan Çıkar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="add-friend">
              <div className="space-y-4">
                <form onSubmit={handleSearchUsers} className="flex gap-2">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Input
                      placeholder="Kullanıcı adı veya e-posta ile ara..."
                      className="pl-10 h-9 sm:h-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loadingSearch || !searchTerm.trim()} className="h-9 sm:h-10">
                    {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                    <span className="hidden sm:inline ml-2">Ara</span>
                  </Button>
                </form>

                {loadingSearch ? (
                   <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : searchTerm && searchResults.length === 0 && !loadingSearch ? (
                  <p className="text-muted-foreground text-center py-4">"{searchTerm}" ile eşleşen kullanıcı bulunamadı.</p>
                ) : searchResults.length > 0 ? (
                  <ul className="space-y-3 pt-2">
                    {searchResults.map(user => (
                      <li key={user.uid} className="flex items-center justify-between p-3 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border">
                        <Link href={`/profile/${user.uid}`} className="flex items-center gap-3 flex-grow min-w-0">
                           <div className={cn('relative', `avatar-frame-${user.avatarFrameStyle || 'default'}`)}>
                             <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                               <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar search" />
                               <AvatarFallback>{getAvatarFallback(user.displayName)}</AvatarFallback>
                             </Avatar>
                             {user.isPremium && <Star className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-yellow-400 fill-yellow-400 bg-card p-px rounded-full shadow" />}
                           </div>
                           <p className="font-medium text-sm sm:text-base hover:underline">{user.displayName || "İsimsiz"}</p>
                        </Link>
                        <div className="flex-shrink-0">
                            {user.isBlockedByCurrentUser ? (
                                <Button variant="destructive" size="sm" className="text-xs sm:text-sm px-2 py-1" onClick={() => handleBlockOrUnblockUser(user)} disabled={performingAction[`block-${user.uid}`]}>
                                    {performingAction[`block-${user.uid}`] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Ban className="mr-1.5 h-3.5 w-3.5"/>} Engeli Kaldır
                                </Button>
                            ) : user.isFriend ? (
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                    <UserCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" /> Arkadaş
                                </Button>
                            ) : user.isRequestSent ? (
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                        <Send className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> İstek Gönderildi
                                    </Button>
                                    {user.outgoingRequestId &&
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 px-2 py-1 text-xs"
                                        onClick={(e) => { e.stopPropagation(); handleCancelOutgoingRequest(user)}}
                                        disabled={performingAction[user.outgoingRequestId]}
                                    >
                                        {performingAction[user.outgoingRequestId] ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Trash2 className="mr-1 h-3 w-3" />} İptal
                                    </Button>
                                    }
                                </div>
                            ) : user.isRequestReceived ? (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-green-600 border-green-500 hover:bg-green-500/10 dark:hover:bg-green-500/20 text-xs sm:text-sm px-2 py-1"
                                        onClick={() => handleAcceptIncomingRequest(user)}
                                        disabled={performingAction[user.incomingRequestId!] || !user.incomingRequestId}
                                    >
                                        {performingAction[user.incomingRequestId!] ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <UserCheck className="mr-1 h-3 w-3"/>} Kabul Et
                                    </Button>
                                     <Button
                                        variant="ghost"
                                        size="xs"
                                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 px-2 py-1 text-xs"
                                        onClick={() => handleDeclineIncomingRequest(user)}
                                        disabled={performingAction[user.incomingRequestId!] || !user.incomingRequestId}
                                    >
                                         {performingAction[user.incomingRequestId!] ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <UserX className="mr-1 h-3 w-3"/>} Reddet
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-primary border-primary hover:bg-primary/10 dark:hover:bg-primary/20 text-xs sm:text-sm px-2 py-1"
                                    onClick={(e) => { e.stopPropagation(); handleSendFriendRequest(user)}}
                                    disabled={performingAction[user.uid]}
                                >
                                    {performingAction[user.uid] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />} Arkadaş Ekle
                                </Button>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : !searchTerm && !loadingSearch && (
                    <p className="text-muted-foreground text-center py-8">Arkadaş eklemek için kullanıcı adı veya e-posta ile arama yapın.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Şikayet Et</AlertDialogTitle>
            <AlertDialogDescription>
                {reportingUser?.displayName || "Bu kullanıcıyı"} şikayet etmek için bir neden belirtebilirsiniz (isteğe bağlı). Şikayetiniz incelenecektir.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Şikayet nedeni (isteğe bağlı)..."
                className="w-full p-2 border rounded-md min-h-[80px] text-sm bg-background"
            />
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setReportReason(""); setReportingUser(null); }}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportUserAction} className="bg-destructive hover:bg-destructive/90">Şikayet Et</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
