
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Mail, MessageSquare, UserPlus, UserCheck, Trash2, Send, LogIn, ShieldQuestion, ShieldCheck, ShieldAlert, Eye, EyeOff, Clock, Star, Edit3, Settings, Gem, Users, Ban, MoreVertical, Flag, UserX } from "lucide-react";
import { useAuth, type UserData, type FriendRequest, type PrivacySettings, checkUserPremium } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  deleteDoc as deleteFirestoreDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDocs,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import PostCard, { type Post } from "@/components/feed/PostCard";
import { generateDmChatId } from "@/lib/utils";
import { isPast, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { tr } from 'date-fns/locale';
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


interface PublicProfileChatRoom {
  id: string;
  name: string;
  participantCount?: number;
  maxParticipants: number;
  expiresAt: Timestamp;
}

const ACTIVE_THRESHOLD_MINUTES = 5; 

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { currentUser, userData: currentUserData, isUserLoading: isAuthLoading, reportUser, blockUser, unblockUser, checkIfUserBlocked, checkIfCurrentUserIsBlockedBy } = useAuth();
  const { toast } = useToast();

  const [profileUser, setProfileUser] = useState<UserData | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [activeRooms, setActiveRooms] = useState<PublicProfileChatRoom[]>([]);
  
  const [friendshipStatus, setFriendshipStatus] = useState<"friends" | "request_sent" | "request_received" | "none" | "self">("none");
  const [relevantFriendRequest, setRelevantFriendRequest] = useState<FriendRequest | null>(null);
  
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [performingAction, setPerformingAction] = useState(false);
  
  const [isBlockedByCurrentUser, setIsBlockedByCurrentUser] = useState(false); // Mevcut kullanıcı bu profili engelledi mi?
  const [isCurrentUserBlockedByProfileOwner, setIsCurrentUserBlockedByProfileOwner] = useState(false); // Mevcut kullanıcı bu profilin sahibi tarafından engellendi mi?

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");


  const isOwnProfile = currentUser?.uid === userId;

  useEffect(() => {
    if (!userId) return;
    setLoadingProfile(true);
    const userDocRef = doc(db, "users", userId);
    
    const fetchProfileUser = async () => {
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const fetchedUser = { uid: docSnap.id, ...docSnap.data() } as UserData;
                fetchedUser.isPremium = checkUserPremium(fetchedUser);
                setProfileUser(fetchedUser);
                document.title = `${fetchedUser.displayName || 'Kullanıcı'} Profili - HiweWalk`;

                if (currentUser && !isOwnProfile) {
                    const blockedByMe = await checkIfUserBlocked(userId);
                    setIsBlockedByCurrentUser(blockedByMe);
                    const blockedMe = await checkIfCurrentUserIsBlockedBy(userId);
                    setIsCurrentUserBlockedByProfileOwner(blockedMe);
                }

                if (!isOwnProfile && !isCurrentUserBlockedByProfileOwner) { // Sadece engellenmemişse görüntülenme sayısını artır
                    const viewedProfiles = JSON.parse(sessionStorage.getItem('viewedProfiles') || '{}');
                    if (!viewedProfiles[userId]) {
                        await runTransaction(db, async (transaction) => {
                            const userRef = doc(db, "users", userId);
                            const sfDoc = await transaction.get(userRef);
                            if (!sfDoc.exists()) {
                                throw "Kullanıcı bulunamadı!";
                            }
                            const newViewCount = (sfDoc.data().profileViewCount || 0) + 1;
                            transaction.update(userRef, { profileViewCount: newViewCount });
                        });
                        viewedProfiles[userId] = true;
                        sessionStorage.setItem('viewedProfiles', JSON.stringify(viewedProfiles));
                        setProfileUser(prev => prev ? { ...prev, profileViewCount: (prev.profileViewCount || 0) + 1 } : null);
                    }
                }

            } else {
                setProfileUser(null);
                toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" });
                router.push("/"); 
            }
        } catch (error) {
            console.error("Error fetching profile user data with getDoc:", error);
            toast({ title: "Hata", description: "Profil bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
        } finally {
            setLoadingProfile(false);
        }
    };
    fetchProfileUser();
  }, [userId, router, toast, isOwnProfile, currentUser, checkIfUserBlocked, checkIfCurrentUserIsBlockedBy]);

  useEffect(() => {
    if (!currentUser || !profileUser || isOwnProfile || isCurrentUserBlockedByProfileOwner) {
      if(isOwnProfile) setFriendshipStatus("self");
      return;
    }

    const checkStatus = async () => {
      setPerformingAction(true); 
      try {
        const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, profileUser.uid);
        const friendDocSnap = await getDoc(friendDocRef);
        if (friendDocSnap.exists()) {
          setFriendshipStatus("friends");
          setPerformingAction(false);
          return;
        }

        const outgoingReqQuery = query(
          collection(db, "friendRequests"),
          where("fromUserId", "==", currentUser.uid),
          where("toUserId", "==", profileUser.uid),
          where("status", "==", "pending")
        );
        const outgoingSnap = await getDocs(outgoingReqQuery);
        if (!outgoingSnap.empty) {
          setFriendshipStatus("request_sent");
          setRelevantFriendRequest({ id: outgoingSnap.docs[0].id, ...outgoingSnap.docs[0].data() } as FriendRequest);
          setPerformingAction(false);
          return;
        }

        const incomingReqQuery = query(
          collection(db, "friendRequests"),
          where("fromUserId", "==", profileUser.uid),
          where("toUserId", "==", currentUser.uid),
          where("status", "==", "pending")
        );
        const incomingSnap = await getDocs(incomingReqQuery);
        if (!incomingSnap.empty) {
          setFriendshipStatus("request_received");
          setRelevantFriendRequest({ id: incomingSnap.docs[0].id, ...incomingSnap.docs[0].data() } as FriendRequest);
          setPerformingAction(false);
          return;
        }
        setFriendshipStatus("none");
      } catch(e){
        console.error("Error checking friendship status:", e);
        setFriendshipStatus("none");
      } finally {
        setPerformingAction(false);
      }
    };
    checkStatus();
  }, [currentUser, profileUser, isOwnProfile, isCurrentUserBlockedByProfileOwner]);

  const canViewContent = useCallback((contentType: "posts" | "rooms" | "profileViewCount" | "onlineStatus") => {
    if (!profileUser) return false; 
    if (isOwnProfile) return true; 
    if (isCurrentUserBlockedByProfileOwner) return false; // Eğer bu profili görüntüleyen kişi, profil sahibi tarafından engellenmişse hiçbir şey göremez.

    const privacySettings = profileUser.privacySettings;
    let key: keyof PrivacySettings | undefined;

    if (contentType === "posts") key = "postsVisibleToFriendsOnly";
    else if (contentType === "rooms") key = "activeRoomsVisibleToFriendsOnly";
    else if (contentType === "profileViewCount") key = "showProfileViewCount";
    else if (contentType === "onlineStatus") key = "showOnlineStatus";
    
    if (!key || !privacySettings || privacySettings[key] === undefined || privacySettings[key] === false) {
      return true; 
    }
    return friendshipStatus === "friends";
  }, [profileUser, isOwnProfile, friendshipStatus, isCurrentUserBlockedByProfileOwner]);


  useEffect(() => {
    if (!userId || !profileUser || isCurrentUserBlockedByProfileOwner) {
        setProfilePosts([]);
        setLoadingPosts(false);
        return;
    }

    if (!canViewContent("posts")) {
        setProfilePosts([]);
        setLoadingPosts(false);
        return;
    }
    setLoadingPosts(true);
    const postsQuery = query(
      collection(db, "posts"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(20) 
    );
    const fetchPosts = async () => {
        try {
            const snapshot = await getDocs(postsQuery);
            const postsData: Post[] = [];
            snapshot.forEach((doc) => postsData.push({ id: doc.id, ...doc.data() } as Post));
            setProfilePosts(postsData);
        } catch (error) {
            console.error("Error fetching profile posts with getDocs:", error);
        } finally {
            setLoadingPosts(false);
        }
    };
    fetchPosts();
  }, [userId, profileUser, canViewContent, isCurrentUserBlockedByProfileOwner]);

  useEffect(() => {
    if (!userId || !profileUser || isCurrentUserBlockedByProfileOwner) {
        setActiveRooms([]);
        setLoadingRooms(false);
        return;
    }
    
    if (!canViewContent("rooms")) {
        setActiveRooms([]);
        setLoadingRooms(false);
        return;
    }

    setLoadingRooms(true);
    const roomsQuery = query(
      collection(db, "chatRooms"),
      where("creatorId", "==", userId),
      where("expiresAt", ">", Timestamp.now()),
      orderBy("expiresAt", "asc") 
    );
    const fetchActiveRooms = async () => {
        try {
            const snapshot = await getDocs(roomsQuery);
            const roomsData: PublicProfileChatRoom[] = [];
            snapshot.forEach((doc) => roomsData.push({ id: doc.id, ...doc.data() } as PublicProfileChatRoom));
            setActiveRooms(roomsData);
        } catch (error) {
            console.error("Error fetching active rooms with getDocs:", error);
        } finally {
            setLoadingRooms(false);
        }
    };
    fetchActiveRooms();
  }, [userId, profileUser, canViewContent, isCurrentUserBlockedByProfileOwner]);


  const handleSendFriendRequest = async () => {
    if (!currentUser || !currentUserData || !profileUser || friendshipStatus !== "none") return;
    setPerformingAction(true);
    const currentUserIsPremium = checkUserPremium(currentUserData);
    try {
      await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid,
        fromUsername: currentUserData.displayName,
        fromAvatarUrl: currentUserData.photoURL,
        fromUserIsPremium: currentUserIsPremium,
        toUserId: profileUser.uid,
        toUsername: profileUser.displayName,
        toAvatarUrl: profileUser.photoURL,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: `${profileUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` });
      setFriendshipStatus("request_sent"); 
    } catch (error) {
      toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally {
      setPerformingAction(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!currentUser || !currentUserData || !profileUser || !relevantFriendRequest || friendshipStatus !== "request_received") return;
    setPerformingAction(true);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, "friendRequests", relevantFriendRequest.id);
      batch.update(requestRef, { status: "accepted" });

      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, profileUser.uid);
      batch.set(myFriendRef, { displayName: profileUser.displayName, photoURL: profileUser.photoURL, isPremium: profileUser.isPremium, addedAt: serverTimestamp() });
      
      const theirFriendRef = doc(db, `users/${profileUser.uid}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { displayName: currentUserData.displayName, photoURL: currentUserData.photoURL, isPremium: checkUserPremium(currentUserData), addedAt: serverTimestamp() });
      
      await batch.commit();
      toast({ title: "Başarılı", description: `${profileUser.displayName} ile arkadaş oldunuz.` });
      setFriendshipStatus("friends");
      setRelevantFriendRequest(null);
    } catch (error) {
      toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally {
      setPerformingAction(false);
    }
  };
  
  const handleCancelOutgoingRequest = async () => {
    if (!currentUser || !profileUser || !relevantFriendRequest || friendshipStatus !== "request_sent") return;
    setPerformingAction(true);
    try {
      await deleteFirestoreDoc(doc(db, "friendRequests", relevantFriendRequest.id));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği iptal edildi." });
      setFriendshipStatus("none");
      setRelevantFriendRequest(null);
    } catch (error) {
        toast({ title: "Hata", description: "İstek iptal edilemedi.", variant: "destructive"});
    } finally {
        setPerformingAction(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUser || !profileUser || friendshipStatus !== "friends") return;
    if (!confirm(`${profileUser.displayName} adlı kullanıcıyı arkadaşlıktan çıkarmak istediğinizden emin misiniz?`)) return;
    setPerformingAction(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, `users/${currentUser.uid}/confirmedFriends`, profileUser.uid));
      batch.delete(doc(db, `users/${profileUser.uid}/confirmedFriends`, currentUser.uid));
      
      const requestQuery1 = query(collection(db, "friendRequests"), 
        where("status", "==", "accepted"),
        where("fromUserId", "==", currentUser.uid), 
        where("toUserId", "==", profileUser.uid)
      );
      const requestQuery2 = query(collection(db, "friendRequests"), 
        where("status", "==", "accepted"),
        where("fromUserId", "==", profileUser.uid), 
        where("toUserId", "==", currentUser.uid)
      );
      const [snap1, snap2] = await Promise.all([getDocs(requestQuery1), getDocs(requestQuery2)]);
      snap1.forEach(doc => batch.delete(doc.ref));
      snap2.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      toast({ title: "Başarılı", description: `${profileUser.displayName} arkadaşlıktan çıkarıldı.` });
      setFriendshipStatus("none");
    } catch (error) {
      toast({ title: "Hata", description: "Arkadaş çıkarılamadı.", variant: "destructive" });
    } finally {
      setPerformingAction(false);
    }
  };

  const handleDmAction = () => {
    if (!currentUser || !profileUser || isCurrentUserBlockedByProfileOwner || isBlockedByCurrentUser) {
        if(isCurrentUserBlockedByProfileOwner) toast({title:"Engellendiniz", description:"Bu kullanıcı tarafından engellendiğiniz için DM gönderemezsiniz.", variant:"destructive"});
        if(isBlockedByCurrentUser) toast({title:"Engellendi", description:"Bu kullanıcıyı engellediğiniz için DM gönderemezsiniz.", variant:"destructive"});
        return;
    }
    const dmId = generateDmChatId(currentUser.uid, profileUser.uid);
    router.push(`/dm/${dmId}`);
  };

  const handleReportUserAction = async () => {
    if (!currentUser || !profileUser) return;
    setIsReportDialogOpen(false); 
    await reportUser(profileUser.uid, reportReason.trim() || "Belirtilmedi");
    setReportReason(""); 
  };

  const handleBlockOrUnblockUser = async () => {
    if (!currentUser || !profileUser) return;
    setPerformingAction(true);
    if (isBlockedByCurrentUser) {
        await unblockUser(profileUser.uid);
        setIsBlockedByCurrentUser(false);
    } else {
        await blockUser(profileUser.uid, profileUser.displayName, profileUser.photoURL);
        setIsBlockedByCurrentUser(true);
        // Engelledikten sonra arkadaşlık durumu değişebilir (örn: arkadaşlıktan çıkarma)
        if (friendshipStatus === "friends") setFriendshipStatus("none");
        if (friendshipStatus === "request_received" && relevantFriendRequest) {
            await deleteFirestoreDoc(doc(db, "friendRequests", relevantFriendRequest.id));
            setFriendshipStatus("none");
            setRelevantFriendRequest(null);
        }
    }
    setPerformingAction(false);
  };


  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
  };

  const formatLastSeen = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return "Bilinmiyor";
    const lastSeenDate = timestamp.toDate();
    const now = new Date();
    const diffMins = differenceInMinutes(now, lastSeenDate);

    if (diffMins < ACTIVE_THRESHOLD_MINUTES) return "Aktif";
    return formatDistanceToNow(lastSeenDate, { addSuffix: true, locale: tr });
  };

  if (loadingProfile || isAuthLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Profil yükleniyor...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <ShieldQuestion className="h-16 w-16 text-destructive mb-4"/>
        <h2 className="text-2xl font-semibold">Kullanıcı Bulunamadı</h2>
        <p className="text-muted-foreground">Bu profile sahip bir kullanıcı bulunamadı veya profil bilgileri yüklenemedi.</p>
        <Button asChild variant="link" className="mt-4"><Link href="/">Anasayfaya Dön</Link></Button>
      </div>
    );
  }

  if (isCurrentUserBlockedByProfileOwner) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Erişim Engellendi</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          {profileUser.displayName || "Bu kullanıcı"} tarafından engellendiniz ve bu profili görüntüleyemezsiniz.
        </p>
        <Button asChild variant="outline">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Anasayfaya Dön</Link>
        </Button>
      </div>
    );
  }
  
  const renderFriendshipActionButton = () => {
    if (isOwnProfile || !currentUser || !currentUserData) return null;

    if (isBlockedByCurrentUser) {
        return (
            <Button variant="destructive" onClick={handleBlockOrUnblockUser} disabled={performingAction} className="w-full">
                <Ban className="mr-2 h-4 w-4" /> Engeli Kaldır
            </Button>
        );
    }

    switch (friendshipStatus) {
      case "friends":
        return (
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button onClick={handleDmAction} disabled={performingAction} className="bg-green-500 hover:bg-green-600 text-white flex-1">
              <MessageSquare className="mr-2 h-4 w-4" /> DM Gönder
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1" disabled={performingAction}><MoreVertical className="h-4 w-4"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleRemoveFriend} className="text-destructive focus:text-destructive">
                        <UserX className="mr-2 h-4 w-4" /> Arkadaşlıktan Çıkar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}>
                        <Flag className="mr-2 h-4 w-4 text-orange-500" /> Şikayet Et
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBlockOrUnblockUser}>
                        <Ban className="mr-2 h-4 w-4" /> Engelle
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      case "request_sent":
        return (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button variant="outline" onClick={handleCancelOutgoingRequest} disabled={performingAction} className="flex-1">İstek Gönderildi (İptal Et)</Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="px-3" disabled={performingAction}><MoreVertical className="h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}>
                            <Flag className="mr-2 h-4 w-4 text-orange-500" /> Şikayet Et
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBlockOrUnblockUser}>
                            <Ban className="mr-2 h-4 w-4" /> Engelle
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
      case "request_received":
        return (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button onClick={handleAcceptFriendRequest} disabled={performingAction} className="bg-blue-500 hover:bg-blue-600 text-white flex-1">
                    <UserCheck className="mr-2 h-4 w-4" /> İsteği Kabul Et
                </Button>
                 <Button variant="destructive" onClick={async () => { 
                     if(relevantFriendRequest) await deleteFirestoreDoc(doc(db, "friendRequests", relevantFriendRequest.id));
                     setFriendshipStatus("none");
                     setRelevantFriendRequest(null);
                     toast({title:"İstek Reddedildi"})
                  }} disabled={performingAction} className="flex-1">Reddet</Button>
            </div>
        );
      case "none":
        return (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button onClick={handleSendFriendRequest} disabled={performingAction} className="flex-1"><UserPlus className="mr-2 h-4 w-4" /> Arkadaş Ekle</Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="px-3" disabled={performingAction}><MoreVertical className="h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}>
                            <Flag className="mr-2 h-4 w-4 text-orange-500" /> Şikayet Et
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBlockOrUnblockUser}>
                            <Ban className="mr-2 h-4 w-4" /> Engelle
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
      default:
        return null;
    }
  };

  const privacyIcon = (contentType: "posts" | "rooms" | "profileViewCount" | "onlineStatus") => {
    if (isOwnProfile) return <ShieldCheck className="h-4 w-4 text-green-500" title="Bu senin profilin, her şeyi görebilirsin." />;
    if (!profileUser?.privacySettings) return <ShieldCheck className="h-4 w-4 text-green-500" title="Herkese açık" />;
    
    let key: keyof PrivacySettings | undefined;
    if (contentType === "posts") key = "postsVisibleToFriendsOnly";
    else if (contentType === "rooms") key = "activeRoomsVisibleToFriendsOnly";
    else if (contentType === "profileViewCount") key = "showProfileViewCount";
    else if (contentType === "onlineStatus") key = "showOnlineStatus";
    
    if (!key || profileUser.privacySettings[key] === undefined || profileUser.privacySettings[key] === false) {
      return <ShieldCheck className="h-4 w-4 text-green-500" title="Herkese açık" />;
    }
    if (profileUser.privacySettings[key]) {
      return friendshipStatus === "friends" 
        ? <ShieldCheck className="h-4 w-4 text-green-500" title="Arkadaş olduğunuz için görebilirsiniz."/> 
        : <ShieldAlert className="h-4 w-4 text-orange-500" title="Sadece arkadaşları görebilir." />;
    }
    return <ShieldCheck className="h-4 w-4 text-green-500" title="Herkese açık" />;
  };

  const profileUserIsPremium = profileUser.isPremium;

  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <div className="relative">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
                <AvatarImage src={profileUser.photoURL || `https://placehold.co/128x128.png`} alt={profileUser.displayName || "Kullanıcı"} data-ai-hint="user profile portrait" />
                <AvatarFallback>{getAvatarFallbackText(profileUser.displayName)}</AvatarFallback>
            </Avatar>
            {profileUserIsPremium && (
                <Star className="absolute bottom-1 right-1 h-6 w-6 text-yellow-400 fill-yellow-500 bg-card p-1 rounded-full shadow-md" title="Premium Kullanıcı" />
            )}
          </div>
          <CardTitle className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-headline text-foreground">
            {profileUser.displayName || "Kullanıcı Adı Yok"}
             {profileUser.isBanned && <Badge variant="destructive" className="ml-2 align-middle">YASAKLI</Badge>}
          </CardTitle>
          {(isOwnProfile || canViewContent("onlineStatus")) && profileUser.lastSeen && (
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {differenceInMinutes(new Date(), profileUser.lastSeen.toDate()) < ACTIVE_THRESHOLD_MINUTES ? (
                <> <div className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></div> Aktif </>
              ) : (
                <>{formatLastSeen(profileUser.lastSeen)}</>
              )}
            </div>
          )}
          {isOwnProfile && profileUser.email && (
            <CardDescription className="text-foreground/80">{profileUser.email}</CardDescription>
          )}
          <div className="mt-1 flex items-center gap-4 text-foreground/90">
            {isOwnProfile && (
                <div className="flex items-center gap-1">
                    <Gem className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm">{currentUserData?.diamonds ?? 0} Elmas</span>
                </div>
            )}
            {(isOwnProfile || canViewContent("profileViewCount")) && (
                 <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">{profileUser.profileViewCount ?? 0} Görüntülenme</span>
                </div>
            )}
          </div>
          
          {isOwnProfile && (
             <div className="mt-4 flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/profile/edit"><Edit3 className="mr-2 h-4 w-4" />Profili Düzenle</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/profile"><Settings className="mr-2 h-4 w-4" />Ayarlar</Link>
                </Button>
            </div>
          )}
          {!isOwnProfile && currentUser && (
             <div className="mt-4 w-full max-w-xs">
                {performingAction ? <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/> : renderFriendshipActionButton()}
            </div>
          )}

        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 text-center">
           <h3 className="text-lg font-semibold text-foreground/90 mb-1">Hakkında</h3>
           <p className="text-foreground/90 whitespace-pre-wrap text-sm sm:text-base max-w-xl mx-auto">
             {profileUser.bio || "Henüz bir biyografi eklenmemiş."}
           </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <CardTitle>Gönderileri</CardTitle>
            </div>
            {privacyIcon("posts")}
          </div>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !canViewContent("posts") ? (
            <div className="text-center py-6 text-muted-foreground">
              <EyeOff className="h-10 w-10 mx-auto mb-2 text-muted-foreground/70" />
              <p className="font-medium">Bu kullanıcının gönderileri gizli.</p>
              <p className="text-xs">Gönderileri görebilmek için arkadaş olmanız gerekebilir.</p>
            </div>
          ) : profilePosts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Bu kullanıcının henüz hiç gönderisi yok.</p>
          ) : (
            <div className="space-y-4">
              {profilePosts.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <CardTitle>Aktif Sohbet Odaları</CardTitle>
                </div>
                {privacyIcon("rooms")}
            </div>
          <CardDescription>Bu kullanıcının oluşturduğu ve şu anda aktif olan odalar.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !canViewContent("rooms") ? (
             <div className="text-center py-6 text-muted-foreground">
              <EyeOff className="h-10 w-10 mx-auto mb-2 text-muted-foreground/70" />
              <p className="font-medium">Bu kullanıcının aktif odaları gizli.</p>
              <p className="text-xs">Aktif odaları görebilmek için arkadaş olmanız gerekebilir.</p>
            </div>
          ) : activeRooms.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Bu kullanıcının şu anda aktif bir odası yok.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRooms.map(room => (
                <Card key={room.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base truncate" title={room.name}>{room.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground flex-grow">
                    <p className="flex items-center gap-1"><Users className="h-3 w-3"/> {room.participantCount ?? 0}/{room.maxParticipants}</p>
                    <p className="flex items-center gap-1 mt-1"><Clock className="h-3 w-3"/> 
                      Kapanma: {formatDistanceToNow(room.expiresAt.toDate(), { addSuffix: true, locale: tr })}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-3">
                    <Button asChild size="sm" className="w-full" disabled={(room.participantCount != undefined && room.participantCount >= room.maxParticipants) || profileUser.isBanned}>
                      <Link href={`/chat/${room.id}`}>
                        <LogIn className="mr-1.5 h-4 w-4"/> Katıl
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Şikayet Et</AlertDialogTitle>
            <AlertDialogDescription>
                {profileUser?.displayName || "Bu kullanıcıyı"} şikayet etmek için bir neden belirtebilirsiniz (isteğe bağlı). Şikayetiniz incelenecektir.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Şikayet nedeni (isteğe bağlı)..."
                className="w-full p-2 border rounded-md min-h-[80px] text-sm bg-background"
            />
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason("")}>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportUserAction} className="bg-destructive hover:bg-destructive/90">Şikayet Et</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
