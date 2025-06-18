
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, MessageSquare, UserPlus, UserCheck, Trash2, Send, LogIn, ShieldQuestion, ShieldCheck, ShieldAlert, EyeOff, Clock } from "lucide-react";
import { useAuth, type UserData, type FriendRequest, type PrivacySettings } from "@/contexts/AuthContext";
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
} from "firebase/firestore";
import PostCard, { type Post } from "@/components/feed/PostCard";
import { generateDmChatId } from "@/lib/utils";
import { isPast, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface PublicProfileChatRoom {
  id: string;
  name: string;
  participantCount?: number;
  maxParticipants: number;
  expiresAt: Timestamp;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { currentUser, userData: currentUserData, isUserLoading: isAuthLoading } = useAuth();
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

  const isOwnProfile = currentUser?.uid === userId;

  useEffect(() => {
    if (!userId) return;
    setLoadingProfile(true);
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfileUser({ uid: docSnap.id, ...docSnap.data() } as UserData);
        document.title = `${docSnap.data().displayName || 'Kullanıcı'} Profili - HiweWalk`;
      } else {
        setProfileUser(null);
        toast({ title: "Hata", description: "Kullanıcı bulunamadı.", variant: "destructive" });
        router.push("/"); 
      }
      setLoadingProfile(false);
    }, (error) => {
      console.error("Error fetching profile user data:", error);
      toast({ title: "Hata", description: "Profil bilgileri yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingProfile(false);
    });
    return () => unsubscribe();
  }, [userId, router, toast]);

  useEffect(() => {
    if (!currentUser || !profileUser || isOwnProfile) {
      if(isOwnProfile) setFriendshipStatus("self");
      return;
    }

    const checkStatus = async () => {
      const friendDocRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, profileUser.uid);
      const friendDocSnap = await getDoc(friendDocRef);
      if (friendDocSnap.exists()) {
        setFriendshipStatus("friends");
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
        return;
      }
      setFriendshipStatus("none");
    };
    checkStatus();
  }, [currentUser, profileUser, isOwnProfile]);

  const canViewContent = useCallback((contentType: "posts" | "rooms") => {
    if (!profileUser) return false; 
    if (isOwnProfile) return true; 

    const privacySettings = profileUser.privacySettings;
    const key = contentType === "posts" ? "postsVisibleToFriendsOnly" : "activeRoomsVisibleToFriendsOnly";
    
    if (!privacySettings || privacySettings[key] === undefined || privacySettings[key] === false) {
      return true; 
    }
    return friendshipStatus === "friends";
  }, [profileUser, isOwnProfile, friendshipStatus]);


  useEffect(() => {
    if (!userId || !profileUser) return;

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
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData: Post[] = [];
      snapshot.forEach((doc) => postsData.push({ id: doc.id, ...doc.data() } as Post));
      setProfilePosts(postsData);
      setLoadingPosts(false);
    }, (error) => {
      console.error("Error fetching profile posts:", error);
      setLoadingPosts(false);
    });
    return () => unsubscribe();
  }, [userId, profileUser, canViewContent]);

  useEffect(() => {
    if (!userId || !profileUser) return;
    
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
    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      const roomsData: PublicProfileChatRoom[] = [];
      snapshot.forEach((doc) => roomsData.push({ id: doc.id, ...doc.data() } as PublicProfileChatRoom));
      setActiveRooms(roomsData);
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching active rooms:", error);
      setLoadingRooms(false);
    });
    return () => unsubscribe();
  }, [userId, profileUser, canViewContent]);


  const handleSendFriendRequest = async () => {
    if (!currentUser || !currentUserData || !profileUser || friendshipStatus !== "none") return;
    setPerformingAction(true);
    try {
      await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid,
        fromUsername: currentUserData.displayName,
        fromAvatarUrl: currentUserData.photoURL,
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
      batch.set(myFriendRef, { displayName: profileUser.displayName, photoURL: profileUser.photoURL, addedAt: serverTimestamp() });
      
      const theirFriendRef = doc(db, `users/${profileUser.uid}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { displayName: currentUserData.displayName, photoURL: currentUserData.photoURL, addedAt: serverTimestamp() });
      
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
    if (!currentUser || !profileUser) return;
    const dmId = generateDmChatId(currentUser.uid, profileUser.uid);
    router.push(`/dm/${dmId}`);
  };

  const getAvatarFallbackText = (name?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    return "PN";
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
  
  const renderActionButton = () => {
    if (isOwnProfile) return null;
    if (!currentUser || !currentUserData) return <Button disabled>Giriş Yapın</Button>;

    switch (friendshipStatus) {
      case "friends":
        return (
          <div className="flex gap-2">
            <Button onClick={handleDmAction} disabled={performingAction} className="bg-green-500 hover:bg-green-600 text-white">
              <MessageSquare className="mr-2 h-4 w-4" /> DM Gönder
            </Button>
            <Button variant="outline" onClick={handleRemoveFriend} disabled={performingAction} className="text-destructive border-destructive hover:bg-destructive/10">
              <Trash2 className="mr-2 h-4 w-4" /> Arkadaşlıktan Çıkar
            </Button>
          </div>
        );
      case "request_sent":
        return <Button variant="outline" onClick={handleCancelOutgoingRequest} disabled={performingAction}>İstek Gönderildi (İptal Et)</Button>;
      case "request_received":
        return (
            <div className="flex gap-2">
                <Button onClick={handleAcceptFriendRequest} disabled={performingAction} className="bg-blue-500 hover:bg-blue-600 text-white">
                    <UserCheck className="mr-2 h-4 w-4" /> İsteği Kabul Et
                </Button>
                 <Button variant="ghost" onClick={() => { toast({title:"Yakında", description:"Reddetme özelliği eklenecek."})}} disabled={performingAction}>Reddet</Button>
            </div>
        );
      case "none":
        return <Button onClick={handleSendFriendRequest} disabled={performingAction}><UserPlus className="mr-2 h-4 w-4" /> Arkadaş Ekle</Button>;
      default:
        return null;
    }
  };

  const privacyIcon = (contentType: "posts" | "rooms") => {
    if (isOwnProfile) return <ShieldCheck className="h-4 w-4 text-green-500" title="Bu senin profilin, her şeyi görebilirsin." />;
    if (!profileUser?.privacySettings) return <ShieldCheck className="h-4 w-4 text-green-500" title="Herkese açık" />;
    
    const key = contentType === "posts" ? "postsVisibleToFriendsOnly" : "activeRoomsVisibleToFriendsOnly";
    if (profileUser.privacySettings[key]) {
      return friendshipStatus === "friends" 
        ? <ShieldCheck className="h-4 w-4 text-green-500" title="Arkadaş olduğunuz için görebilirsiniz."/> 
        : <ShieldAlert className="h-4 w-4 text-orange-500" title="Sadece arkadaşları görebilir." />;
    }
    return <ShieldCheck className="h-4 w-4 text-green-500" title="Herkese açık" />;
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-xl overflow-hidden bg-gradient-to-br from-primary/5 via-card to-accent/5 dark:from-primary/10 dark:via-card dark:to-accent/10">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="flex flex-col items-center text-center -mt-12 sm:-mt-16">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-card shadow-lg">
            <AvatarImage src={profileUser.photoURL || `https://placehold.co/128x128.png`} alt={profileUser.displayName || "Kullanıcı"} data-ai-hint="user profile portrait" />
            <AvatarFallback>{getAvatarFallbackText(profileUser.displayName)}</AvatarFallback>
          </Avatar>
          <CardTitle className="mt-3 sm:mt-4 text-2xl sm:text-3xl font-headline text-foreground">
            {profileUser.displayName || "Kullanıcı Adı Yok"}
          </CardTitle>
          <CardDescription className="text-foreground/80">{profileUser.email}</CardDescription>
          {!isOwnProfile && currentUser && (
             <div className="mt-4">
                {performingAction ? <Loader2 className="h-6 w-6 animate-spin text-primary"/> : renderActionButton()}
            </div>
          )}
           {isOwnProfile && (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/profile">Profilini Düzenle</Link>
            </Button>
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
                    <Button asChild size="sm" className="w-full" disabled={room.participantCount != undefined && room.participantCount >= room.maxParticipants}>
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
    </div>
  );
}

