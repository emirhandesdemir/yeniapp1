
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import InAppNotificationBanner from '@/components/notifications/InAppNotificationBanner';

export interface InAppNotificationData {
  id: string;
  title: string;
  message: string;
  type: 'friend_request' | 'new_dm' | 'info' | 'success' | 'error';
  avatarUrl?: string | null;
  senderName?: string | null;
  link?: string; 
  duration?: number; 
}

interface InAppNotificationContextType {
  showNotification: (notificationData: Omit<InAppNotificationData, 'id'>) => string;
  dismissNotification: (id: string) => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined);

export function useInAppNotification() {
  const context = useContext(InAppNotificationContext);
  if (!context) {
    throw new Error('useInAppNotification must be used within an InAppNotificationProvider');
  }
  return context;
}

// Basit bir ID üretici
let notificationIdCounter = 0;
const generateId = () => `inapp-notif-${notificationIdCounter++}`;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<InAppNotificationData[]>([]);

  const showNotification = useCallback((notificationData: Omit<InAppNotificationData, 'id'>) => {
    const id = generateId();
    const newNotification = { ...notificationData, id };
    setNotifications(prev => {
      // Basitlik için sadece bir bildirim gösterelim. Eskisini kaldırıp yenisini ekleyebiliriz.
      // Daha karmaşık bir kuyruk yönetimi de yapılabilir.
      // Ya da aynı anda birden fazla bildirim gösterilmek isteniyorsa, InAppNotificationBanner'ı map ile render edip
      // pozisyonlarını ayarlamak gerekir (örn: y ekseninde stackleyerek).
      // Şimdilik en son geleni en üste alıp, mevcutları temizleyebiliriz veya sadece bir tane gösterebiliriz.
      // Bu örnekte, en fazla 1 bildirim aktif olacak şekilde yapıyoruz, yenisi gelince eskisi (varsa) gider.
      return [newNotification]; 
    });
    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Sadece ilk bildirimi alıp InAppNotificationBanner'a iletiyoruz
  // Eğer birden fazla bildirim aynı anda gösterilmek istenirse burası güncellenmeli
  const currentNotification = notifications.length > 0 ? notifications[0] : null;

  const contextValue = useMemo(() => ({
    showNotification,
    dismissNotification,
  }), [showNotification, dismissNotification]);

  return (
    <InAppNotificationContext.Provider value={contextValue}>
      {children}
      <AnimatePresence>
        {currentNotification && (
          <InAppNotificationBanner
            key={currentNotification.id}
            notification={currentNotification}
            onDismiss={dismissNotification}
          />
        )}
      </AnimatePresence>
    </InAppNotificationContext.Provider>
  );
}
