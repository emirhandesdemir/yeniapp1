
"use client";

import React, { useState, FormEvent, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bot, Send, Sparkles, AlertTriangle, CornerDownLeft } from "lucide-react";
import { projectAssistantFlow, type ProjectAssistantInput, type ProjectAssistantOutput } from "@/ai/flows/project-assistant-flow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatMessage {
  type: 'user' | 'assistant' | 'error';
  text: string;
}

export default function AdminProjectAssistantContent() {
  const [question, setQuestion] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => viewport.scrollTop = viewport.scrollHeight, 0);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleAskQuestion = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessageText = question.trim();
    const userMessage: ChatMessage = { type: 'user', text: userMessageText };
    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQuestion("");
    textareaRef.current?.focus();

    try {
      const input: ProjectAssistantInput = { question: userMessageText };
      const output: ProjectAssistantOutput = await projectAssistantFlow(input);
      
      const assistantMessage: ChatMessage = { type: 'assistant', text: output.answer };
      setChatHistory(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error("Error calling project assistant flow:", error);
      const errorMessageText = "Asistandan cevap alınırken bir hata oluştu: " + (error.message || "Bilinmeyen hata");
      const errorMessage: ChatMessage = { type: 'error', text: errorMessageText };
      setChatHistory(prev => [...prev, errorMessage]);
      toast({
        title: "Asistan Hatası",
        description: "Yapay zeka asistanıyla iletişim kurulamadı.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (adminUserData?.role !== 'admin') {
    return (
     <div className="flex flex-1 items-center justify-center p-8">
       <Card className="w-full max-w-md text-center p-6 shadow-lg">
           <CardHeader>
               <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
               <CardTitle>Erişim Reddedildi</CardTitle>
               <CardDescription>Bu bölümü görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
           </CardHeader>
       </Card>
     </div>
   );
 }


  return (
    <div className="flex flex-col h-full">
      <CardHeader className="pb-3 pt-1 px-0 sm:px-1">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 text-primary" />
          <CardTitle className="text-2xl font-headline">Proje Asistanı</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Projenin yapısı, dosyaları veya genel işleyişi hakkında sorular sorun. AI asistanı size yardımcı olacaktır.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-0 sm:p-1">
        <ScrollArea className="flex-1 mb-2 pr-2" ref={scrollAreaRef}>
          <div className="space-y-4 p-1">
            {chatHistory.length === 0 && !isLoading && (
                <div className="text-center text-muted-foreground py-10 px-4">
                    <Sparkles className="mx-auto h-12 w-12 text-primary/70 mb-3" />
                    <p className="text-md font-medium">Merhaba! Size nasıl yardımcı olabilirim?</p>
                    <p className="text-xs">Proje hakkında bir soru sorun.</p>
                </div>
            )}
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={cn(
                    "flex w-full",
                    msg.type === 'user' ? 'justify-end pl-6 sm:pl-10' : 'justify-start pr-6 sm:pr-10'
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] p-2.5 sm:p-3 rounded-lg shadow-sm",
                    msg.type === 'user' && 'bg-primary text-primary-foreground rounded-br-none',
                    msg.type === 'assistant' && 'bg-muted text-muted-foreground rounded-bl-none border',
                    msg.type === 'error' && 'bg-destructive/10 text-destructive rounded-bl-none border border-destructive/30'
                  )}
                >
                  {msg.type !== 'user' && (
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-foreground/80 font-medium">
                        {msg.type === 'assistant' && <Sparkles className="h-3.5 w-3.5 text-accent"/>}
                        {msg.type === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-destructive"/>}
                        <span>{msg.type === 'assistant' ? 'Proje Asistanı' : 'Hata'}</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap allow-text-selection">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].type === 'user' && (
                 <div className="flex justify-start pr-10">
                    <div className="max-w-[85%] p-3 rounded-lg shadow-sm bg-muted text-muted-foreground rounded-bl-none border">
                        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-foreground/80 font-medium">
                            <Sparkles className="h-3.5 w-3.5 text-accent"/>
                            <span>Proje Asistanı</span>
                        </div>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                 </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={handleAskQuestion} className="flex gap-2 border-t pt-3 border-border/50">
          <Textarea
            ref={textareaRef}
            placeholder="Örn: Tema ayarları hangi dosyada bulunur?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading}
            className="flex-1 resize-none text-sm h-10 min-h-[40px] max-h-28 py-2"
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading && question.trim()) {
                    e.preventDefault();
                    handleAskQuestion();
                }
            }}
          />
          <Button type="submit" disabled={isLoading || !question.trim()} size="icon" className="h-10 w-10 shrink-0">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CornerDownLeft className="h-5 w-5" />}
            <span className="sr-only">Soruyu Gönder</span>
          </Button>
        </form>
      </CardContent>
    </div>
  );
}
