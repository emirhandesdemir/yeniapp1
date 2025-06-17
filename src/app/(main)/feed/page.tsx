
"use client";

import { useEffect } from 'react';
import CreatePostForm from "@/components/feed/CreatePostForm";
import FeedList from "@/components/feed/FeedList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function FeedPage() {
  const { currentUser, isUserLoading, isUserDataLoading } = useAuth();

  useEffect(() => {
    document.title = 'Akış - Sohbet Küresi';
  }, []);

  if (isUserLoading || isUserDataLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Akış yükleniyor...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md text-center p-6">
          <CardHeader>
            <CardTitle>Giriş Gerekli</CardTitle>
            <CardDescription>
              Akışı görmek ve gönderi paylaşmak için lütfen <Link href="/login?redirect=/feed" className="text-primary hover:underline">giriş yapın</Link>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreatePostForm />
      <FeedList />
    </div>
  );
}
