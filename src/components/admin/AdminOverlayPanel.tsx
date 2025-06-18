
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, LayoutDashboard, Users, ListChecks, Settings2 as GameSettingsIcon, Bot } from 'lucide-react'; // Bot ikonu eklendi
import { cn } from '@/lib/utils';

// Dinamik olarak yüklenecek admin bölüm içerikleri
import AdminDashboardContent from '@/components/admin/sections/AdminDashboardContent';
import AdminUsersContent from '@/components/admin/sections/AdminUsersContent';
import AdminChatRoomsContent from '@/components/admin/sections/AdminChatRoomsContent';
import AdminGameSettingsContent from '@/components/admin/sections/AdminGameSettingsContent';
import AdminProjectAssistantContent from '@/components/admin/sections/AdminProjectAssistantContent'; // Yeni import

export default function AdminOverlayPanel() {
  const { isAdminPanelOpen, setIsAdminPanelOpen, userData } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!isAdminPanelOpen || userData?.role !== 'admin') {
    return null;
  }

  const adminSections = [
    { value: "dashboard", label: "Gösterge Paneli", icon: LayoutDashboard, component: <AdminDashboardContent /> },
    { value: "users", label: "Kullanıcılar", icon: Users, component: <AdminUsersContent /> },
    { value: "chat-rooms", label: "Sohbet Odaları", icon: ListChecks, component: <AdminChatRoomsContent /> },
    { value: "game-settings", label: "Oyun Ayarları", icon: GameSettingsIcon, component: <AdminGameSettingsContent /> },
    { value: "project-assistant", label: "Proje Asistanı", icon: Bot, component: <AdminProjectAssistantContent /> }, // Yeni sekme
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
        className="bg-card text-card-foreground rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] max-h-[850px] flex flex-col overflow-hidden border border-border"
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
            <TabsList className={cn("grid w-full mb-2", adminSections.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
              {adminSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="text-xs sm:text-sm px-1 sm:px-2">
                  <section.icon className="h-4 w-4 mr-1 sm:mr-1.5 hidden sm:inline-block" />
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {adminSections.map(section => (
              <TabsContent 
                key={section.value} 
                value={section.value} 
                className="flex-1 overflow-auto focus-visible:ring-0 focus-visible:ring-offset-0 p-2 sm:p-4 rounded-md bg-background/30"
              >
                {activeTab === section.value && section.component}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
