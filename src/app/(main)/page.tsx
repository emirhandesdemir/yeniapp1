
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import CreatePostForm from '@/components/feed/CreatePostForm';
import PostCard, { type Post } from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PostSkeleton = () => (
  <div className="bg-card rounded-lg p-4 space-y-3">
    <div className="flex items-center space-x-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <div className="flex justify-between pt-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-16" />
    </div>
  </div>
);


export default function FeedPage() {
    const { currentUser, userData, isUserDataLoading } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('for-you');

    useEffect(() => {
        if (currentUser && !isUserDataLoading) {
            const friendsQuery = query(collection(db, `users/${currentUser.uid}/confirmedFriends`));
            const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
                const friendIds = snapshot.docs.map(doc => doc.id);
                setFriends(friendIds);
            });
            return () => unsubscribe();
        }
    }, [currentUser, isUserDataLoading]);

    const createFeedQuery = useCallback(() => {
        const postsRef = collection(db, 'posts');
        if (activeTab === 'following' && currentUser) {
            if (friends.length === 0) {
                return null; // Return null if no friends to query
            }
            // Firestore 'in' query can take an array of up to 30 elements.
            // For more friends, you would need to fetch multiple times or denormalize.
            return query(postsRef, where('userId', 'in', [currentUser.uid, ...friends]), orderBy('createdAt', 'desc'), limit(50));
        }
        // "For You" tab shows everyone's posts
        return query(postsRef, orderBy('createdAt', 'desc'), limit(50));
    }, [activeTab, currentUser, friends]);


    useEffect(() => {
        setLoading(true);
        const q = createFeedQuery();

        if (!q) {
            setPosts([]);
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts: Post[] = [];
            snapshot.forEach(doc => {
                fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
            });
            setPosts(fetchedPosts);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching posts:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [createFeedQuery]);

    const filteredPosts = useMemo(() => {
        if (!currentUserData?.privacySettings?.feedShowsEveryone && activeTab === 'for-you') {
             return posts.filter(post => friends.includes(post.userId) || post.userId === currentUser?.uid);
        }
        return posts;
    }, [posts, friends, currentUser?.uid, currentUserData?.privacySettings, activeTab]);

    const handlePostCreated = () => {
        // This could potentially trigger a re-fetch, but onSnapshot handles it.
        // A small delay and scroll to top might be a good UX.
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };


  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <CreatePostForm onPostCreated={handlePostCreated} />

       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="for-you" className="gap-1.5"><Globe className="h-4 w-4"/>Sana Özel</TabsTrigger>
          <TabsTrigger value="following" className="gap-1.5"><Users className="h-4 w-4"/>Takip Edilen</TabsTrigger>
        </TabsList>
        <TabsContent value="for-you">
             {loading ? (
                Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
              ) : filteredPosts.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <p>Sana Özel akışında gösterilecek gönderi yok.</p>
                  <p className="text-sm">Yeni insanları takip etmeye başlayın!</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {filteredPosts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              )}
        </TabsContent>
         <TabsContent value="following">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
              ) : friends.length === 0 && !posts.some(p => p.userId === currentUser?.uid) ? (
                 <div className="text-center text-muted-foreground py-10">
                  <p>Henüz kimseyi takip etmiyorsunuz.</p>
                  <p className="text-sm">Akışınızı görmek için arkadaş ekleyin.</p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <p>Takip ettiğiniz kişilerin henüz hiç gönderisi yok.</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {filteredPosts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
              )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
