
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import CreatePostForm from '@/components/feed/CreatePostForm';
import PostCard, { type Post } from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function HomePage() {
  const { currentUser, userData } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Ana Akış - HiweWalk';
  }, []);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = fetchPosts();
    return () => unsubscribe();
  }, [fetchPosts]);

  const handlePostCreated = () => {
    // The onSnapshot listener will automatically update the feed.
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        {currentUser && (
          <motion.div variants={itemVariants}>
            <Card className="shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Yeni Gönderi</CardTitle>
                <CardDescription>Düşüncelerini toplulukla paylaş.</CardDescription>
              </CardHeader>
              <CardContent>
                <CreatePostForm onPostCreated={handlePostCreated} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {loading ? (
            <div className="space-y-5">
              <Skeleton className="h-[250px] w-full rounded-xl" />
              <Skeleton className="h-[220px] w-full rounded-xl" />
            </div>
        ) : (
          <AnimatePresence>
            <motion.div
              layout
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-5"
            >
              {posts.length === 0 ? (
                <motion.div variants={itemVariants} className="text-center text-muted-foreground py-16">
                  <Globe className="mx-auto h-16 w-16 mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold">Akışta henüz bir şey yok.</h3>
                  <p className="text-sm mt-2">İlk gönderiyi sen paylaşarak sohbeti başlat!</p>
                </motion.div>
              ) : (
                posts.map(post => (
                  <motion.div layout key={post.id} variants={itemVariants}>
                    <PostCard post={post} />
                  </motion.div>
                ))
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
}
