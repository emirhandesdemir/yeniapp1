
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

let notificationIdCounter = 0;
const generateId = () => `inapp-notif-${notificationIdCounter++}`;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<InAppNotificationData[]>([]);

  const showNotification = useCallback((notificationData: Omit<InAppNotificationData, 'id'>) => {
    const id = generateId();
    const newNotification = { ...notificationData, id };
    setNotifications(prev => {
      // Sadece bir bildirim göster, yenisi gelince eskisi (varsa) gider.
      return [newNotification]; 
    });
    return id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

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
