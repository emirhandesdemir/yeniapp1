"use client"; // Required for useState, useEffect, and event handlers

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Paperclip, Smile } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Metadata } from 'next'; // Not usable in client components directly for dynamic titles.

// Dynamic metadata needs to be handled differently for client components or in a parent server component.
// For now, static title.
// export const metadata: Metadata = {
//   title: 'Sohbet Odası - Sohbet Küresi', 
// };

interface Message {
  id: string;
  user: string;
  avatar: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  userAiHint: string;
}

const initialMessages: Message[] = [
  { id: "1", user: "Ayşe", avatar: "https://placehold.co/40x40.png", text: "Herkese merhaba! 👋", timestamp: "10:30", isOwn: false, userAiHint: "woman smiling" },
  { id: "2", user: "Siz", avatar: "https://placehold.co/40x40.png", text: "Selam Ayşe, nasılsın?", timestamp: "10:31", isOwn: true, userAiHint: "user avatar" },
  { id: "3", user: "Mehmet", avatar: "https://placehold.co/40x40.png", text: "Hoş geldiniz! Konumuz neydi bugün?", timestamp: "10:32", isOwn: false, userAiHint: "man thinking" },
  { id: "4", user: "Ayşe", avatar: "https://placehold.co/40x40.png", text: "Bugün serbest takılıyoruz Mehmet 😄", timestamp: "10:33", isOwn: false, userAiHint: "woman smiling" },
  { id: "5", user: "Siz", avatar: "https://placehold.co/40x40.png", text: "Harika fikir!", timestamp: "10:34", isOwn: true, userAiHint: "user avatar" },
];

export default function ChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const roomName = `Oda ${roomId}`; // Placeholder, fetch actual room name
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;
    const newMsg: Message = {
      id: String(Date.now()),
      user: "Siz",
      avatar: "https://placehold.co/40x40.png",
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      userAiHint: "user avatar"
    };
    setMessages([...messages, newMsg]);
    setNewMessage("");
  };
  
  // Set document title (client-side approach for dynamic title)
  useEffect(() => {
    document.title = `${roomName} - Sohbet Odası - Sohbet Küresi`;
  }, [roomName]);


  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.32))] max-h-[calc(100vh-theme(spacing.32))] md:h-[calc(100vh-theme(spacing.36))] md:max-h-[calc(100vh-theme(spacing.36))] bg-card rounded-xl shadow-xl overflow-hidden">
      <header className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="icon" asChild className="md:hidden">
          <Link href="/chat">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Geri</span>
          </Link>
        </Button>
        <Avatar>
          <AvatarImage src={`https://placehold.co/40x40.png?text=${roomName.substring(0,1)}`} data-ai-hint="group chat"/>
          <AvatarFallback>{roomName.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-lg font-semibold text-primary-foreground/90">{roomName}</h2>
          <p className="text-sm text-muted-foreground">3 aktif üye</p> {/* Placeholder */}
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 space-y-4" ref={scrollAreaRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.isOwn ? "justify-end" : ""}`}>
            {!msg.isOwn && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.avatar} data-ai-hint={msg.userAiHint} />
                <AvatarFallback>{msg.user.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <div className={`max-w-[70%] p-3 rounded-xl shadow ${
                msg.isOwn 
                ? "bg-primary text-primary-foreground rounded-br-none" 
                : "bg-secondary text-secondary-foreground rounded-bl-none"
            }`}>
              {!msg.isOwn && <p className="text-xs font-medium mb-1 text-accent">{msg.user}</p>}
              <p className="text-sm">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground/70"} text-right`}>
                {msg.timestamp}
              </p>
            </div>
            {msg.isOwn && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.avatar} data-ai-hint={msg.userAiHint} />
                <AvatarFallback>{msg.user.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-4 border-t bg-background/50 rounded-b-xl">
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button">
            <Smile className="h-5 w-5 text-muted-foreground hover:text-accent" />
            <span className="sr-only">Emoji Ekle</span>
          </Button>
          <Input
            placeholder="Mesajınızı yazın..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 pr-20 rounded-full focus-visible:ring-accent"
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button variant="ghost" size="icon" type="button">
              <Paperclip className="h-5 w-5 text-muted-foreground hover:text-accent" />
              <span className="sr-only">Dosya Ekle</span>
            </Button>
            <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90 rounded-full">
              <Send className="h-5 w-5 text-accent-foreground" />
              <span className="sr-only">Gönder</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
