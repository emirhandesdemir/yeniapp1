
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import PostCard, { type Post } from "./PostCard";
import { Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Card importları eklendi

export default function FeedList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: Post[] = [];
      snapshot.forEach((doc) => {
        fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(fetchedPosts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts: ", error);
      setLoading(false);
      // Burada kullanıcıya bir hata mesajı gösterilebilir.
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Gönderiler yükleniyor...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="text-center py-10 sm:py-12 bg-card border border-border/20 rounded-xl shadow-md">
        <CardHeader className="pb-2">
            <MessageSquare className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-primary/70 mb-3" />
            <CardTitle className="text-xl sm:text-2xl font-semibold text-primary-foreground/90">Henüz Hiç Gönderi Yok!</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto">
            Akışta gösterilecek bir şey bulunamadı. İlk gönderiyi sen paylaşarak sohbeti başlat!
            </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
