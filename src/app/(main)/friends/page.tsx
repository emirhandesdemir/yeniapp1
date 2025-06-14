
"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, UserCheck, Search, MessageCircle, Trash2, Loader2, Users, AlertTriangle, Send, BellRing } from "lucide-react";
import { useAuth, type UserData } from "@/contexts/AuthContext";
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
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";


interface Friend extends UserData {
  addedAt?: Timestamp;
}

interface SearchResultUser extends UserData {
  isFriend?: boolean;
  isRequestSent?: boolean; // Mevcut kullanıcıdan bu kullanıcıya giden istek
  isRequestReceived?: boolean; // Bu kullanıcıdan mevcut kullanıcıya gelen istek
  outgoingRequestId?: string | null; // Giden isteğin ID'si (iptal için)
  // incomingRequestId artık popover'da yönetildiği için burada gerekmeyebilir
}

export default function FriendsPage() {
  const { currentUser, userData, isUserLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [myFriends, setMyFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [performingAction, setPerformingAction] = useState<Record<string, boolean>>({}); // Key can be userId or requestId

  useEffect(() => {
    document.title = 'Arkadaşlarım - Sohbet Küresi';
  }, []);

  // Fetch current user's friends
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
        // Arkadaşın tam profilini users koleksiyonundan çek
        const userProfileDoc = await getDoc(doc(db, "users", friendDoc.id));
        if (userProfileDoc.exists()) {
          return { 
            uid: friendDoc.id, // Ensure uid is set from friendDoc.id
            ...userProfileDoc.data(), 
            addedAt: friendData.addedAt 
          } as Friend;
        }
        // Fallback if user profile is somehow missing (should not happen ideally)
        return {
          uid: friendDoc.id,
          displayName: friendData.displayName || "Bilinmeyen Kullanıcı",
          photoURL: friendData.photoURL || null,
          email: null, // Or some other default
          diamonds: 0, // Or some other default
          createdAt: friendData.addedAt || Timestamp.now(), // Use addedAt as fallback
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


  const handleSearchUsers = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim() || !currentUser) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const usersRef = collection(db, "users");
      // displayName için arama (büyük/küçük harf duyarsız değil, ama başlangıç eşleşmesi)
      const nameQuery = query(usersRef, where("displayName", ">=", searchTerm), where("displayName", "<=", searchTerm + '\uf8ff'), limit(10));
      // email için tam eşleşme (genellikle e-postalar benzersizdir)
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
        let processedUser: SearchResultUser = { ...user };
        // Arkadaşlık durumunu kontrol et
        processedUser.isFriend = myFriends.some(f => f.uid === user.uid);

        if (!processedUser.isFriend) {
          // Mevcut kullanıcıdan bu kullanıcıya giden bekleyen istek var mı?
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

          // Bu kullanıcıdan mevcut kullanıcıya gelen bekleyen istek var mı?
          // (Eğer giden bir istek yoksa kontrol et, çakışmayı önlemek için)
          if (!processedUser.isRequestSent) {
            const incomingQuery = query(collection(db, "friendRequests"),
              where("fromUserId", "==", user.uid),
              where("toUserId", "==", currentUser.uid),
              where("status", "==", "pending")
            );
            const incomingSnap = await getDocs(incomingQuery);
            if(!incomingSnap.empty) {
              processedUser.isRequestReceived = true;
              // incomingRequestId'ye burada ihtiyaç yok, bildirimlerde ele alınıyor
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
  };
  
  // Bir eylemin yüklenip yüklenmediğini ayarlamak için yardımcı fonksiyon
  const setActionLoading = (id: string, isLoading: boolean) => {
    setPerformingAction(prev => ({ ...prev, [id]: isLoading }));
  };

  const handleSendFriendRequest = async (targetUser: SearchResultUser) => {
    if (!currentUser || !userData || !targetUser || targetUser.isFriend || targetUser.isRequestSent || targetUser.isRequestReceived) return;
    setActionLoading(targetUser.uid, true);
    try {
      // Yeni bir arkadaşlık isteği dokümanı oluştur
      const newRequestRef = await addDoc(collection(db, "friendRequests"), {
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
      // Arama sonuçlarındaki bu kullanıcı için UI'ı güncelle
      setSearchResults(prev => prev.map(u => 
        u.uid === targetUser.uid ? {...u, isRequestSent: true, outgoingRequestId: newRequestRef.id } : u
      ));
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği gönderilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(targetUser.uid, false);
    }
  };
  
  const handleCancelOutgoingRequest = async (targetUser: SearchResultUser) => {
    if (!targetUser.outgoingRequestId) return;
    setActionLoading(targetUser.outgoingRequestId, true); // İşlem ID'si olarak isteğin ID'sini kullan
    try {
      await deleteDoc(doc(db, "friendRequests", targetUser.outgoingRequestId));
      toast({ title: "Başarılı", description: "Arkadaşlık isteği iptal edildi." });
      // Arama sonuçlarındaki bu kullanıcı için UI'ı güncelle
       setSearchResults(prev => prev.map(u => 
        u.uid === targetUser.uid ? {...u, isRequestSent: false, outgoingRequestId: null} : u
      ));
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      toast({ title: "Hata", description: "Arkadaşlık isteği iptal edilemedi.", variant: "destructive" });
    } finally {
      setActionLoading(targetUser.outgoingRequestId, false);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!currentUser || !confirm(`${friendName} adlı kullanıcıyı arkadaşlıktan çıkarmak istediğinizden emin misiniz?`)) return;
    setActionLoading(friendId, true);
    try {
      const batch = writeBatch(db);
      // Kullanıcının kendi arkadaş listesinden sil
      const myFriendRef = doc(db, `users/${currentUser.uid}/confirmedFriends`, friendId);
      batch.delete(myFriendRef);
      // Diğer kullanıcının arkadaş listesinden sil
      const theirFriendRef = doc(db, `users/${friendId}/confirmedFriends`, currentUser.uid);
      batch.delete(theirFriendRef);
      
      // İlgili (kabul edilmiş) arkadaşlık isteklerini de sil (isteğe bağlı, temizlik için)
      const q = query(collection(db, "friendRequests"), 
        where("fromUserId", "in", [currentUser.uid, friendId]), 
        where("toUserId", "in", [currentUser.uid, friendId]),
        where("status", "==", "accepted") // Sadece kabul edilenleri hedefle
      );
      const oldRequestsSnap = await getDocs(q);
      oldRequestsSnap.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      toast({ title: "Başarılı", description: `${friendName} arkadaşlıktan çıkarıldı.` });
      // myFriends listesi onSnapshot ile otomatik güncellenecektir.
      // Eğer arama sonuçlarında bu kişi varsa, onun da durumunu güncelle
      setSearchResults(prevResults => prevResults.map(sr => 
        sr.uid === friendId ? { ...sr, isFriend: false, isRequestSent: false, isRequestReceived: false, outgoingRequestId: null } : sr
      ));

    } catch (error) {
      console.error("Error removing friend:", error);
      toast({ title: "Hata", description: "Arkadaş çıkarılamadı.", variant: "destructive" });
    } finally {
      setActionLoading(friendId, false);
    }
  };

  // Kullanıcı avatarı için fallback metnini alır
  const getAvatarFallback = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "??";
  };


  if (isAuthLoading && !currentUser) { // Auth yükleniyor ve henüz kullanıcı yoksa
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser) { // Yükleme bitti ama kullanıcı yoksa (örneğin giriş yapılmamış)
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
          <CardTitle className="text-2xl sm:text-3xl font-headline">Arkadaşlar</CardTitle>
          <CardDescription>Arkadaşlarınla bağlantıda kal, yeni bağlantılar kur.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my-friends" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-4 sm:mb-6">
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
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                          <AvatarImage src={friend.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar" />
                          <AvatarFallback>{getAvatarFallback(friend.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{friend.displayName || "İsimsiz"}</p>
                          {/* <p className="text-xs text-muted-foreground">{friend.email || 'E-posta yok'}</p> */}
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" aria-label="Mesaj Gönder" onClick={() => toast({description: "DM Özelliği Yakında!"})}>
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
                        <div className="flex items-center gap-3">
                           <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                             <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png`} data-ai-hint="person avatar search" />
                             <AvatarFallback>{getAvatarFallback(user.displayName)}</AvatarFallback>
                           </Avatar>
                           <p className="font-medium text-sm sm:text-base">{user.displayName || "İsimsiz"}</p>
                        </div>
                        {user.isFriend ? (
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                <UserCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" /> Arkadaş
                            </Button>
                        ) : user.isRequestSent ? (
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 py-1" disabled>
                                    <Send className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> İstek Gönderildi
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="xs" // Button'un xs boyutu eklendi
                                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 px-2 py-1 text-xs"
                                    onClick={() => handleCancelOutgoingRequest(user)}
                                    disabled={performingAction[user.outgoingRequestId!]}
                                >
                                    {performingAction[user.outgoingRequestId!] ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Trash2 className="mr-1 h-3 w-3" />} İptal
                                </Button>
                            </div>
                        ) : user.isRequestReceived ? (
                           <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-primary border-primary hover:bg-primary/10 dark:hover:bg-primary/20 text-xs sm:text-sm px-2 py-1"
                              disabled 
                            >
                              <BellRing className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> İstek Geldi (Bildirimlerde)
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
                ) : !searchTerm && !loadingSearch && ( // Arama yapılmadıysa ve yüklenmiyorsa
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
