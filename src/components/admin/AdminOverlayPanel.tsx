
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, LayoutDashboard, Users, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminOverlayPanel() {
  const { isAdminPanelOpen, setIsAdminPanelOpen, userData } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!isAdminPanelOpen || userData?.role !== 'admin') {
    return null;
  }

  const adminSections = [
    { value: "dashboard", label: "Gösterge Paneli", icon: LayoutDashboard, src: "/admin/dashboard" },
    { value: "users", label: "Kullanıcılar", icon: Users, src: "/admin/users" },
    { value: "chat-rooms", label: "Sohbet Odaları", icon: ListChecks, src: "/admin/chat-rooms" },
  ];

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300",
        isAdminPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      onClick={() => setIsAdminPanelOpen(false)} // Close on backdrop click
    >
      <div 
        className="bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside panel
      >
        <header className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-semibold">Admin Paneli</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
            <span className="sr-only">Admin Panelini Kapat</span>
          </Button>
        </header>

        <div className="flex-1 p-1 sm:p-2 overflow-hidden">
          <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-2">
              {adminSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="text-xs sm:text-sm">
                  <section.icon className="h-4 w-4 mr-1.5 hidden sm:inline-block" />
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {adminSections.map(section => (
              <TabsContent key={section.value} value={section.value} className="flex-1 overflow-auto focus-visible:ring-0 focus-visible:ring-offset-0">
                {activeTab === section.value && (
                  <iframe
                    src={section.src}
                    title={section.label}
                    className="w-full h-full border-0 rounded-md"
                    // sandbox="allow-scripts allow-same-origin allow-forms allow-popups" // Consider security implications
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
