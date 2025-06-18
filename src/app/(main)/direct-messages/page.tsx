
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Users, AlertTriangle, SendHorizontal, Search } from "lucide-react";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, Timestamp, doc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { generateDmChatId } from "@/lib/utils";

interface DirectMessageConversation {
  id: string; // dmChatId
  participantUids: string[];
  participantInfo: {
    [key: string]: {
      displayName: string | null;
      photoURL: string | null;
    }
  };
  lastMessageTimestamp: Timestamp | null;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  otherParticipant?: UserData; 
  unreadCount?: number; 
}

export default function DirectMessagesPage() {
  const { currentUser, userData, isUserLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<DirectMessageConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = 'Direkt Mesajlar - HiweWalk';
  }, []);

  useEffect(() => {
    if (!currentUser?.uid || isAuthLoading) {
      if (!isAuthLoading) setLoadingConversations(false);
      return;
    }

    setLoadingConversations(true);
    const dmQuery = query(
      collection(db, "directMessages"),
      where("participantUids", "array-contains", currentUser.uid),
      orderBy("lastMessageTimestamp", "desc")
    );

    const unsubscribe = onSnapshot(dmQuery, async (snapshot) => {
      if (snapshot.empty) {
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      const convPromises = snapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data() as DirectMessageConversation;
        data.id = docSnapshot.id; 
        
        const otherUid = data.participantUids.find(uid => uid !== currentUser.uid);
        let otherParticipantData: UserData | undefined;

        if (otherUid && data.participantInfo && data.participantInfo[otherUid]) {
            otherParticipantData = {
                uid: otherUid,
                displayName: data.participantInfo[otherUid].displayName,
                photoURL: data.participantInfo[otherUid].photoURL,
                email: null, 
                diamonds: 0, 
                createdAt: Timestamp.now(), 
            };
        } else if (otherUid) {
            try {
                const userDocRef = doc(db, "users", otherUid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    otherParticipantData = { uid: userSnap.id, ...userSnap.data() } as UserData;
                }
            } catch (error) {
                console.error("Error fetching other participant details:", error);
            }
        }
        
        return { ...data, otherParticipant: otherParticipantData };
      });

      try {
        const resolvedConversations = (await Promise.all(convPromises))
            .filter(conv => conv.otherParticipant !== undefined) as DirectMessageConversation[];
        setConversations(resolvedConversations);
      } catch (error) {
          console.error("Error processing DM conversations:", error);
          toast({ title: "Hata", description: "Mesajlar yüklenirken bir sorun oluştu.", variant: "destructive"});
      } finally {
        setLoadingConversations(false);
      }
    }, (error) => {
      console.error("Error fetching direct messages:", error);
      toast({ title: "Hata", description: "Direkt mesajlar yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingConversations(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, isAuthLoading, toast]);
  
  const getAvatarFallback = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "PN";
  };

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) {
      return conversations;
    }
    return conversations.filter(conv => 
      conv.otherParticipant?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [conversations, searchTerm]);

  if (isAuthLoading && !currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser && !isAuthLoading) {
     return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md text-center p-6 shadow-lg">
            <CardHeader>
                <Users className="mx-auto h-12 w-12 text-primary mb-4" />
                <CardTitle>Giriş Gerekli</CardTitle>
                <CardDescription>Mesajlarınızı görmek için lütfen <Link href="/login?redirect=/direct-messages" className="text-primary hover:underline">giriş yapın</Link>.</CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <SendHorizontal className="h-7 w-7 text-primary" />
                <CardTitle className="text-2xl sm:text-3xl font-headline">Direkt Mesajlar</CardTitle>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Sohbet ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
          <CardDescription className="pt-2">Arkadaşlarınızla özel olarak yaptığınız sohbetler.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConversations ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Mesajlar yükleniyor...</p>
            </div>
          ) : conversations.length === 0 ? ( // Ana liste boşsa her zaman bu mesajı göster
            <div className="text-center py-10">
              <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Henüz direkt mesajınız yok.</p>
              <p className="text-sm text-muted-foreground">
                <Link href="/friends" className="text-primary hover:underline">Arkadaşlar</Link> sayfasından bir arkadaşınıza mesaj göndererek sohbet başlatın.
              </p>
            </div>
          ) : searchTerm && filteredConversations.length === 0 ? ( // Arama var ama sonuç yoksa bu mesajı göster
            <div className="text-center py-10">
              <Search className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Arama sonucu bulunamadı.</p>
              <p className="text-sm text-muted-foreground">
                Farklı bir anahtar kelimeyle tekrar deneyin.
              </p>
            </div>
          ) : ( // Filtrelenmiş veya tüm sohbetleri listele
            <ul className="space-y-3">
              {filteredConversations.map(conv => {
                const otherParticipant = conv.otherParticipant;
                if (!otherParticipant) return null; 

                const lastMessagePrefix = conv.lastMessageSenderId === currentUser?.uid ? "Siz: " : "";

                return (
                  <li key={conv.id}>
                    <Link href={`/dm/${conv.id}`} className="block hover:bg-secondary/50 dark:hover:bg-secondary/20 p-3 sm:p-4 rounded-lg shadow-sm border transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                            <AvatarImage src={otherParticipant.photoURL || `https://placehold.co/48x48.png`} data-ai-hint="person avatar dm list"/>
                            <AvatarFallback>{getAvatarFallback(otherParticipant.displayName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base truncate text-foreground">
                              {otherParticipant.displayName || "Bilinmeyen Kullanıcı"}
                            </p>
                            {conv.lastMessageText && (
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                    {lastMessagePrefix}{conv.lastMessageText}
                                </p>
                            )}
                          </div>
                        </div>
                        {conv.lastMessageTimestamp && (
                           <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-2">
                            {formatDistanceToNow(conv.lastMessageTimestamp.toDate(), { addSuffix: true, locale: tr })}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
