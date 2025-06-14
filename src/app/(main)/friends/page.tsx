
"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, UserCheck, UserX, Search, MessageCircle, Trash2, Loader2, Users, AlertTriangle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { UserData } from "@/contexts/AuthContext";

interface Friend extends UserData {
  addedAt?: Timestamp;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  toUsername: string;
  toAvatarUrl: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
  processedType?: "incoming" | "outgoing";
  userProfile?: UserData;
}


export default function FriendsPage() {
  const { currentUser, userData, isUserLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [myFriends, setMyFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [performingAction, setPerformingAction] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = 'Arkadaşlarım - Sohbet Küresi';
  }, []);

  useEffect(() => {
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
        // Ensure user profile is fetched, even if minimal data exists in confirmedFriends
        const userProfileDoc = await getDoc(doc(db, "users", friendDoc.id));
        if (userProfileDoc.exists()) {
          return { 
            uid: friendDoc.id, // Make sure uid is set from friendDoc.id
            ...userProfileDoc.data(), 
            addedAt: friendData.addedAt 
          } as Friend;
        }
        // Fallback if user profile doesn't exist (should be rare if data is consistent)
        return {
          uid: friendDoc.id,
          displayName: friendData.displayName || "Bilinmeyen Kullanıcı",
          photoURL: friendData.photoURL || null,
          email: null, // Or fetch if available/needed
          diamonds: 0, // Or a default
          createdAt: friendData.addedAt || Timestamp.now(),
          addedAt: friendData.addedAt
        } as Friend;
      });
      const resolvedFriends = (await Promise.all(friendsPromises)).filter(f => f !== null) as Friend[];
      setMyFriends(resolvedFriends);
      setLoadingFriends(false);
    }, (error) => {
      console.error("Error fetching friends:", error);
      toast({ title: "Hata", description: "Arkadaşlar yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingFriends(false);
    });
    return () => unsubscribe();
  }, [currentUser?.uid, toast]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadingRequests(false);
      return;
    }

    setLoadingRequests(true);
    let incomingInitialized = false;
    let outgoingInitialized = false;

    const checkBothInitialized = () => {
      if (incomingInitialized && outgoingInitialized) {
        setLoadingRequests(false);
      }
    };

    const incomingQuery = query(
      collection(db, "friendRequests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const unsubIncoming = onSnapshot(incomingQuery, async (snapshot) => {
      const reqPromises = snapshot.docs.map(async (reqDoc) => {
        const data = reqDoc.data() as Omit<FriendRequest, 'id' | 'userProfile' | 'processedType'>;
        const senderProfileDoc = await getDoc(doc(db, "users", data.fromUserId));
        return {
          id: reqDoc.id,
          ...data,
          processedType: "incoming",
          userProfile: senderProfileDoc.exists() ? { uid: senderProfileDoc.id, ...senderProfileDoc.data() } as UserData : undefined,
        } as FriendRequest;
      });
      setIncomingRequests(await Promise.all(reqPromises));
      if (!incomingInitialized) {
        incomingInitialized = true;
        checkBothInitialized();
      }
    }, (error) => {
      console.error("Error fetching incoming requests:", error);
      toast({ title: "Hata", description: "Gelen arkadaşlık istekleri yüklenirken bir sorun oluştu.", variant: "destructive" });
      if (!incomingInitialized) {
        incomingInitialized = true;
        checkBothInitialized();
      }
    });

    const outgoingQuery = query(
      collection(db, "friendRequests"),
      where("fromUserId", "==", currentUser.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
    const unsubOutgoing = onSnapshot(outgoingQuery, async (snapshot) => {
      const reqPromises = snapshot.docs.map(async (reqDoc) => {
        const data = reqDoc.data() as Omit<FriendRequest, 'id' | 'userProfile' | 'processedType'>;
        const receiverProfileDoc = await getDoc(doc(db, "users", data.toUserId));
        return {
          id: reqDoc.id,
          ...data,
          processedType: "outgoing",
          userProfile: receiverProfileDoc.exists() ? { uid: receiverProfileDoc.id, ...receiverProfileDoc.data() } as UserData : undefined,
        } as FriendRequest;
      });
      setOutgoingRequests(await Promise.all(reqPromises));
      if (!outgoingInitialized) {
        outgoingInitialized = true;
        checkBothInitialized();
      }
    }, (error) => {
      console.error("Error fetching outgoing requests:", error);
      toast({ title: "Hata", description: "Giden arkadaşlık istekleri yüklenirken bir sorun oluştu.", variant: "destructive" });
      if (!outgoingInitialized) {
        outgoingInitialized = true;
        checkBothInitialized();
      }
    });
    
    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [currentUser?.uid, toast]);


  const handleSearchUsers = async () => {
    if (!searchTerm.trim() || !currentUser) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const usersRef = collection(db, "users");
      // Firestore does not support case-insensitive search or 'starts with' for multiple fields easily.
      // For a production app, a dedicated search solution (e.g., Algolia, Elasticsearch) is better.
      // Simple exact match for email, and prefix match for displayName for this prototype.
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
      
      setSearchResults(Array.from(resultsMap.values()));

    } catch (error) {
      console.error("Error searching users:", error);
      toast({ title: "Hata", description: "Kullanıcı aranırken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setLoadingSearch(false);
    }
  };
  
  const setActionLoading = (id: string, isLoading: boolean) => {
    setPerformingAction(prev => ({ ...prev, [id]: isLoading }));
  };

  const handleSendFriendRequest = async (targetUser: UserData) => {
    if (!currentUser || !userData || !targetUser) return;
    setActionLoading(targetUser.uid, true);
    try {
      // Check if a request already exists (either way) or if they are already friends
      const q1 = query(collection(db, "friendRequests"), where("fromUserId", "==", currentUser.uid), where("toUserId", "==", targetUser.uid));
      const q2 = query(collection(db, "friendRequests"), where("fromUserId", "==", targetUser.uid), where("toUserId", "==", currentUser.uid));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      if (!snap1.empty || !snap2.empty) {
          const existingRequest = !snap1.empty ? snap1.docs[0].data() : snap2.docs[0].data();
          if (existingRequest.status === "pending") {
            toast({ description: "Bu kullanıcıyla zaten beklemede olan bir arkadaşlık isteğiniz var.", variant: "default" });
            setActionLoading(targetUser.uid, false);
            return;
          } else if (existingRequest.status === "accepted") {
             toast({ description: "Bu kullanıcı zaten arkadaşınız.", variant: "default" });
             setActionLoading(targetUser.uid, false);
             return;
          }
      }
      
      const isAlreadyFriend = myFriends.some(friend => friend.uid === targetUser.uid);
      if(isAlreadyFriend) {
        toast({ description: "Bu kullanıcı zaten arkadaşınız.", variant: "default" });
        setActionLoading(targetUser.uid, false);
        return;
      }

      await addDoc(collection(db, "friendRequests"), {
        fromUserId: currentUser.uid,
        fromUsername: userData.displayName,
        fromAvatarUrl: userData.photoURL,
        toUserId: targetUser.uid,
        toUsername: targetUser.displayName,
        toAvatarUrl: targetUser.photoURL,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: `${targetUser.displayName} adlı kullanıcıya arkadaşlık isteği gönderildi.` });
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(targetUser.uid, false);
    }
  };

  const handleAcceptFriendRequest = async (request: FriendRequest) => {
    if (!currentUser || !userData) return;
    setActionLoading(request.id, true);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, "friendRequests", request.id);
      batch.update(requestRef, { status: "accepted" });

      // Add to current user's friends
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, request.fromUserId);
      batch.set(myFriendRef, { 
        displayName: request.userProfile?.displayName || request.fromUsername, 
        photoURL: request.userProfile?.photoURL || request.fromAvatarUrl,
        addedAt: serverTimestamp() 
      });

      // Add to the other user's friends
      const theirFriendRef = doc(db, `users/${request.fromUserId}/confirmedFriends`, currentUser.uid);
      batch.set(theirFriendRef, { 
        displayName: userData.displayName, 
        photoURL: userData.photoURL,
        addedAt: serverTimestamp() 
      });
      
      await batch.commit();
      toast({ title: "Başarılı", description: `${request.fromUsername} ile arkadaş oldunuz.` });
    } catch (error) {
      console.error("Error accepting friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği kabul edilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(request.id, false);
    }
  };
  
  const handleDeclineFriendRequest = async (requestId: string) => {
    setActionLoading(requestId, true);
    try {
      // Instead of just updating, we can delete declined requests to keep the collection clean
      // await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
      await deleteDoc(doc(db, "friendRequests", requestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği reddedildi." });
    } catch (error) {
      console.error("Error declining friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği reddedilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(requestId, false);
    }
  };

  const handleCancelOutgoingRequest = async (requestId: string) => {
    setActionLoading(requestId, true);
    try {
      await deleteDoc(doc(db, "friendRequests", requestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği iptal edildi." });
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği iptal edilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(requestId, false);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!currentUser || !confirm(`${friendName} adlı kullanıcıyı arkadaşlıktan çıkarmak istediğinizden emin misiniz?`)) return;
    setActionLoading(friendId, true);
    try {
      const batch = writeBatch(db);
      // Remove from current user's confirmedFriends
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, friendId);
      batch.delete(myFriendRef);
      // Remove current user from the other user's confirmedFriends
      const theirFriendRef = doc(db, `users/${friendId}/confirmedFriends`, currentUser.uid);
      batch.delete(theirFriendRef);
      
      // Optional: Delete any related friendRequest documents (accepted status)
      const q = query(collection(db, "friendRequests"), 
        where("fromUserId", "in", [currentUser.uid, friendId]), 
        where("toUserId", "in", [currentUser.uid, friendId]),
        where("status", "==", "accepted")
      );
      const oldRequestsSnap = await getDocs(q);
      oldRequestsSnap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      toast({ title: "Başarılı", description: `${friendName} arkadaşlıktan çıkarıldı.` });
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({ title: "Hata", description: "Arkadaş çıkarılamadı.", variant: "destructive" });
    } finally {
      setActionLoading(friendId, false);
    }
  };

  const getAvatarFallback = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "??";
  };

  const isRequestAlreadySent = (targetUserId: string) => {
    return outgoingRequests.some(req => req.toUserId === targetUserId && req.status === 'pending');
  };

  const isAlreadyFriend = (targetUserId: string) => {
    return myFriends.some(friend => friend.uid === targetUserId);
  };
  
  const hasIncomingRequestFrom = (targetUserId: string) => {
    return incomingRequests.some(req => req.fromUserId === targetUserId && req.status === 'pending');
  };

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
                <CardDescription>Arkadaşlarınızı görmek ve yönetmek için lütfen giriş yapın.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl font-headline">Arkadaşlar</CardTitle>
          <CardDescription>Arkadaşlarınla bağlantıda kal, yeni bağlantılar kur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my-friends" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-4 sm:mb-6">
              <TabsTrigger value="my-friends" className="text-xs sm:text-sm">Arkadaşlarım ({myFriends.length})</TabsTrigger>
              <TabsTrigger value="requests" className="text-xs sm:text-sm">İstekler ({incomingRequests.length + outgoingRequests.length})</TabsTrigger>
              <TabsTrigger value="add-friend" className="text-xs sm:text-sm">Arkadaş Ekle</TabsTrigger>
            </TabsList>

            <TabsContent value="my-friends">
              {loadingFriends ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : myFriends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz hiç arkadaşın yok.</p>
              ) : (
                <ul className="space-y-3 sm:space-y-4">
                  {myFriends.map(friend => (
                    <li key={friend.uid} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                          <AvatarImage src={friend.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar" />
                          <AvatarFallback>{getAvatarFallback(friend.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{friend.displayName || "İsimsiz"}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" aria-label="Mesaj Gönder" onClick={() => toast({description: "Mesajlaşma özelliği yakında!"})}>
                          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary hover:text-primary/80" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 sm:h-9 sm:w-9 hover:text-destructive" 
                          aria-label="Arkadaşlıktan Çıkar"
                          onClick={() => handleRemoveFriend(friend.uid, friend.displayName || 'bu arkadaşı')}
                          disabled={performingAction[friend.uid]}
                        >
                          {performingAction[friend.uid] ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-destructive" />}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="requests">
              {loadingRequests ? (
                 <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (incomingRequests.length === 0 && outgoingRequests.length === 0) ? (
                 <p className="text-muted-foreground text-center py-8">Bekleyen arkadaşlık isteği yok.</p>
              ) : (
                <div className="space-y-6">
                  {incomingRequests.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-primary-foreground/80">Gelen İstekler ({incomingRequests.length})</h3>
                      <ul className="space-y-3 sm:space-y-4">
                        {incomingRequests.map(req => (
                          <li key={req.id} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                                 <AvatarImage src={req.userProfile?.photoURL || req.fromAvatarUrl || `https://placehold.co/40x40.png`} data-ai-hint="person avatar request" />
                                 <AvatarFallback>{getAvatarFallback(req.userProfile?.displayName || req.fromUsername)}</AvatarFallback>
                              </Avatar>
                              <p className="font-medium text-sm sm:text-base">{req.userProfile?.displayName || req.fromUsername || "İsimsiz"}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                              <Button 
                                variant="ghost" 
                                size="xs" 
                                className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-800/50 dark:text-green-400 px-2 py-1 text-xs sm:text-sm"
                                onClick={() => handleAcceptFriendRequest(req)}
                                disabled={performingAction[req.id]}
                              >
                                {performingAction[req.id] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/> : <UserCheck className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />} Kabul Et
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="xs" 
                                className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-800/50 dark:text-red-400 px-2 py-1 text-xs sm:text-sm"
                                onClick={() => handleDeclineFriendRequest(req.id)}
                                disabled={performingAction[req.id]}
                              >
                                {performingAction[req.id] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/> : <UserX className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />} Reddet
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {outgoingRequests.length > 0 && (
                     <div>
                      <h3 className="text-lg font-semibold mb-2 text-primary-foreground/80">Giden İstekler ({outgoingRequests.length})</h3>
                       <ul className="space-y-3 sm:space-y-4">
                        {outgoingRequests.map(req => (
                          <li key={req.id} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                                 <AvatarImage src={req.userProfile?.photoURL || req.toAvatarUrl || `https://placehold.co/40x40.png`} data-ai-hint="person avatar request" />
                                 <AvatarFallback>{getAvatarFallback(req.userProfile?.displayName || req.toUsername)}</AvatarFallback>
                              </Avatar>
                              <p className="font-medium text-sm sm:text-base">{req.userProfile?.displayName || req.toUsername || "İsimsiz"}</p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="xs" 
                              className="px-2 py-1 text-xs sm:text-sm" 
                              onClick={() => handleCancelOutgoingRequest(req.id)}
                              disabled={performingAction[req.id]}
                            >
                              {performingAction[req.id] ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin"/> : <Send className="mr-1 h-3.5 w-3.5 transform rotate-180" />} İsteği İptal Et
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="add-friend">
              <div className="space-y-4">
                <form onSubmit={(e) => { e.preventDefault(); handleSearchUsers(); }} className="flex gap-2">
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
                        <div className="flex items-center gap-3">
                           <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                             <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar search" />
                             <AvatarFallback>{getAvatarFallback(user.displayName)}</AvatarFallback>
                           </Avatar>
                           <p className="font-medium text-sm sm:text-base">{user.displayName || "İsimsiz"}</p>
                        </div>
                        {isAlreadyFriend(user.uid) ? (
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                <UserCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" /> Arkadaş
                            </Button>
                        ) : isRequestAlreadySent(user.uid) ? (
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                <Send className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> İstek Gönderildi
                            </Button>
                        ) : hasIncomingRequestFrom(user.uid) ? (
                           <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-primary border-primary hover:bg-primary/10 dark:hover:bg-primary/20 text-xs sm:text-sm px-2 py-1"
                              onClick={() => {
                                const request = incomingRequests.find(req => req.fromUserId === user.uid);
                                if (request) handleAcceptFriendRequest(request);
                              }}
                              disabled={performingAction[incomingRequests.find(req => req.fromUserId === user.uid)?.id || user.uid]}
                            >
                              {performingAction[incomingRequests.find(req => req.fromUserId === user.uid)?.id || user.uid] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />} İsteği Kabul Et
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-primary border-primary hover:bg-primary/10 dark:hover:bg-primary/20 text-xs sm:text-sm px-2 py-1"
                                onClick={() => handleSendFriendRequest(user)}
                                disabled={performingAction[user.uid]}
                            >
                                {performingAction[user.uid] ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />} Arkadaş Ekle
                            </Button>
                        )}
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
    </div>
  );
}
