
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import PostCard, { type Post } from '@/components/feed/PostCard';
import CreatePostForm from '@/components/feed/CreatePostForm';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, isUserDataLoading } = useAuth();

  const fetchPosts = useCallback(() => {
    setLoading(true);
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
        const postsData: Post[] = [];
        snapshot.forEach((doc) => {
            postsData.push({ id: doc.id, ...doc.data() } as Post);
        });
        setPosts(postsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching posts:", error);
        setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    document.title = 'Akış - HiweWalk';
    const unsubscribe = fetchPosts();
    return () => unsubscribe();
  }, [fetchPosts]);

  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      {currentUser && !isUserDataLoading && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <CreatePostForm onPostCreated={fetchPosts} />
        </motion.div>
      )}
      
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Akışta henüz gönderi yok.</h3>
          <p className="mt-1 text-sm text-muted-foreground">İlk gönderiyi sen paylaş!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
             <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <PostCard post={post} />
             </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
