
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, LayoutDashboard, Users, ListChecks, Settings2 as GameSettingsIcon, Bot, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

import AdminDashboardContent from '@/components/admin/sections/AdminDashboardContent';
import AdminUsersContent from '@/components/admin/sections/AdminUsersContent';
import AdminChatRoomsContent from '@/components/admin/sections/AdminChatRoomsContent';
import AdminGameSettingsContent from '@/components/admin/sections/AdminGameSettingsContent';
import AdminProjectAssistantContent from '@/components/admin/sections/AdminProjectAssistantContent';

export default function AdminOverlayPanel() {
  const { isAdminPanelOpen, setIsAdminPanelOpen, userData } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    // Prevent body scroll when overlay is open
    if (isAdminPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAdminPanelOpen]);

  if (!isAdminPanelOpen || userData?.role !== 'admin') {
    return null;
  }

  const adminSections = [
    { value: "dashboard", label: "Panel", icon: LayoutDashboard, component: <AdminDashboardContent /> },
    { value: "users", label: "Kullanıcılar", icon: Users, component: <AdminUsersContent /> },
    { value: "chat-rooms", label: "Odalar", icon: ListChecks, component: <AdminChatRoomsContent /> },
    { value: "game-settings", label: "Oyun", icon: GameSettingsIcon, component: <AdminGameSettingsContent /> },
    { value: "project-assistant", label: "Asistan", icon: Bot, component: <AdminProjectAssistantContent /> },
  ];

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 transition-opacity duration-300",
        isAdminPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      onClick={() => setIsAdminPanelOpen(false)}
    >
      <div 
        className="bg-card text-card-foreground rounded-lg sm:rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] max-h-[900px] flex flex-col overflow-hidden border border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-border/50">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-primary-foreground/90">Yönetim Paneli</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelOpen(false)} className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Admin Panelini Kapat</span>
          </Button>
        </header>

        <div className="flex-1 p-1.5 sm:p-2 md:p-3 overflow-hidden">
          <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col sm:flex-row gap-2 sm:gap-3">
            <TabsList className={cn(
                "flex flex-row sm:flex-col sm:h-full justify-start p-1.5 sm:p-2 bg-muted/50 rounded-md sm:w-48 md:w-56 shrink-0",
                "overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto" // Yatayda scroll mobilde, dikeyde PC'de
            )}>
              {adminSections.map(section => (
                <TabsTrigger 
                    key={section.value} 
                    value={section.value} 
                    className="w-full justify-start text-xs sm:text-sm px-2.5 py-2 sm:px-3 sm:py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/5 data-[state=inactive]:hover:text-primary transition-all whitespace-nowrap"
                >
                  <section.icon className="h-4 w-4 mr-2" />
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <div className="flex-1 overflow-hidden rounded-md">
              {adminSections.map(section => (
                <TabsContent 
                  key={section.value} 
                  value={section.value} 
                  className="flex-1 h-full overflow-auto focus-visible:ring-0 focus-visible:ring-offset-0 bg-background/40 p-2.5 sm:p-4 rounded-md border border-border/30 mt-0" // mt-0 eklendi
                >
                  {activeTab === section.value && section.component}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
