
"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Bot, Send, Sparkles, AlertTriangle } from "lucide-react";
import { projectAssistantFlow, type ProjectAssistantInput, type ProjectAssistantOutput } from "@/ai/flows/project-assistant-flow";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  type: 'user' | 'assistant';
  text: string;
}

export default function AdminProjectAssistantContent() {
  const [question, setQuestion] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();

  const handleAskQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const userMessage: ChatMessage = { type: 'user', text: question.trim() };
    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQuestion("");

    try {
      const input: ProjectAssistantInput = { question: userMessage.text };
      const output: ProjectAssistantOutput = await projectAssistantFlow(input);
      
      const assistantMessage: ChatMessage = { type: 'assistant', text: output.answer };
      setChatHistory(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error("Error calling project assistant flow:", error);
      const errorMessage: ChatMessage = { type: 'assistant', text: "Asistandan cevap alınırken bir hata oluştu: " + (error.message || "Bilinmeyen hata") };
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
    <div className="flex flex-col h-full max-h-[calc(90vh-150px)]">
      <CardHeader className="pb-3 pt-1 px-2">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 text-primary" />
          <CardTitle className="text-2xl font-headline">Proje Asistanı</CardTitle>
        </div>
        <CardDescription>
          Projenin yapısı, dosyaları veya genel işleyişi hakkında sorular sorun. Yapay zeka asistanı size yardımcı olmaya çalışacaktır.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-2">
        <ScrollArea className="flex-1 mb-3 pr-3">
          <div className="space-y-4">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg shadow ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-muted-foreground rounded-bl-none border'
                  }`}
                >
                  {msg.type === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-foreground/80">
                        <Sparkles className="h-3.5 w-3.5 text-accent"/>
                        <span>Proje Asistanı</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap allow-text-selection">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].type === 'user' && (
                 <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg shadow bg-muted text-muted-foreground rounded-bl-none border">
                        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-foreground/80">
                            <Sparkles className="h-3.5 w-3.5 text-accent"/>
                            <span>Proje Asistanı</span>
                        </div>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                 </div>
            )}
          </div>
        </ScrollArea>
        <form onSubmit={handleAskQuestion} className="mt-auto flex gap-2 border-t pt-3">
          <Textarea
            placeholder="Örn: Tema ayarları hangi dosyada bulunur?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading}
            className="flex-1 resize-none text-sm"
            rows={1}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading && question.trim()) {
                    e.preventDefault();
                    handleAskQuestion(e);
                }
            }}
          />
          <Button type="submit" disabled={isLoading || !question.trim()} size="icon" className="h-auto px-3 py-2.5">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Soruyu Gönder</span>
          </Button>
        </form>
      </CardContent>
    </div>
  );
}
