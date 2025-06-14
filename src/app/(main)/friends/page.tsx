
"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, UserCheck, UserX, Search, MessageCircle, Trash2 } from "lucide-react";

interface Friend {
  id: string;
  username: string;
  avatarUrl: string;
  status: "online" | "offline" | "away";
  avatarAiHint: string;
}

interface FriendRequest {
  id: string;
  username: string;
  avatarUrl: string;
  type: "incoming" | "outgoing";
  avatarAiHint: string;
}

const mockFriends: Friend[] = [
  { id: "1", username: "Ahmet Yılmaz", avatarUrl: "https://placehold.co/40x40.png", status: "online", avatarAiHint: "man smiling" },
  { id: "2", username: "Zeynep Kaya", avatarUrl: "https://placehold.co/40x40.png", status: "offline", avatarAiHint: "woman glasses" },
  { id: "3", username: "Can Demir", avatarUrl: "https://placehold.co/40x40.png", status: "away", avatarAiHint: "person nature" },
];

const mockRequests: FriendRequest[] = [
  { id: "4", username: "Elif Naz", avatarUrl: "https://placehold.co/40x40.png", type: "incoming", avatarAiHint: "girl cute" },
  { id: "5", username: "Burak Taş", avatarUrl: "https://placehold.co/40x40.png", type: "outgoing", avatarAiHint: "boy cool" },
];

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [requests, setRequests] = useState<FriendRequest[]>(mockRequests);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = 'Arkadaşlarım - Sohbet Küresi';
  }, []);

  const searchResults = searchTerm ? [
    { id: "101", username: "Merve Can", avatarUrl: "https://placehold.co/40x40.png", avatarAiHint: "student happy" },
    { id: "102", username: "Ali Veli", avatarUrl: "https://placehold.co/40x40.png", avatarAiHint: "artist creative" },
  ].filter(user => user.username.toLowerCase().includes(searchTerm.toLowerCase())) : [];


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
              <TabsTrigger value="my-friends" className="text-xs sm:text-sm">Arkadaşlarım</TabsTrigger>
              <TabsTrigger value="requests" className="text-xs sm:text-sm">Arkadaşlık İstekleri</TabsTrigger>
              <TabsTrigger value="add-friend" className="text-xs sm:text-sm">Arkadaş Ekle</TabsTrigger>
            </TabsList>

            <TabsContent value="my-friends">
              {friends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz hiç arkadaşın yok.</p>
              ) : (
                <ul className="space-y-3 sm:space-y-4">
                  {friends.map(friend => (
                    <li key={friend.id} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                          <AvatarImage src={friend.avatarUrl} data-ai-hint={friend.avatarAiHint} />
                          <AvatarFallback>{friend.username.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{friend.username}</p>
                          <p className={`text-xs ${friend.status === 'online' ? 'text-green-500 dark:text-green-400' : 'text-muted-foreground'}`}>
                            {friend.status === 'online' ? 'Çevrimiçi' : friend.status === 'offline' ? 'Çevrimdışı' : 'Uzakta'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 sm:gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" aria-label="Mesaj Gönder">
                          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary hover:text-primary/80" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 hover:text-destructive" aria-label="Arkadaşlıktan Çıkar">
                          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="requests">
              {requests.length === 0 ? (
                 <p className="text-muted-foreground text-center py-8">Bekleyen arkadaşlık isteği yok.</p>
              ) : (
                <ul className="space-y-3 sm:space-y-4">
                  {requests.map(req => (
                    <li key={req.id} className="flex items-center justify-between p-3 sm:p-4 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                           <AvatarImage src={req.avatarUrl} data-ai-hint={req.avatarAiHint} />
                           <AvatarFallback>{req.username.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{req.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.type === 'incoming' ? 'Gelen İstek' : 'Giden İstek'}
                          </p>
                        </div>
                      </div>
                      {req.type === 'incoming' && (
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                          <Button variant="ghost" size="xs" className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-800/50 dark:text-green-400 px-2 py-1 text-xs sm:text-sm">
                            <UserCheck className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Kabul Et
                          </Button>
                          <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-800/50 dark:text-red-400 px-2 py-1 text-xs sm:text-sm">
                            <UserX className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Reddet
                          </Button>
                        </div>
                      )}
                      {req.type === 'outgoing' && (
                        <Button variant="outline" size="xs" className="px-2 py-1 text-xs sm:text-sm" disabled>İstek Gönderildi</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="add-friend">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Kullanıcı adı veya e-posta ile ara..." 
                    className="pl-10 h-9 sm:h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchTerm && searchResults.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">"{searchTerm}" ile eşleşen kullanıcı bulunamadı.</p>
                )}
                {searchResults.length > 0 && (
                  <ul className="space-y-3 pt-2">
                    {searchResults.map(user => (
                      <li key={user.id} className="flex items-center justify-between p-3 bg-card hover:bg-secondary/50 dark:hover:bg-secondary/20 rounded-lg shadow-sm border">
                        <div className="flex items-center gap-3">
                           <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                             <AvatarImage src={user.avatarUrl} data-ai-hint={user.avatarAiHint} />
                             <AvatarFallback>{user.username.substring(0,1)}</AvatarFallback>
                           </Avatar>
                           <p className="font-medium text-sm sm:text-base">{user.username}</p>
                        </div>
                        <Button variant="outline" size="sm" className="text-primary border-primary hover:bg-primary/10 dark:hover:bg-primary/20 text-xs sm:text-sm px-2 py-1">
                          <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Arkadaş Ekle
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                 {!searchTerm && (
                    <p className="text-muted-foreground text-center py-8">Arkadaş eklemek için arama yapın.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
