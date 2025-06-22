
"use client";

import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { InAppNotificationProvider } from "@/contexts/InAppNotificationContext";
import { MinimizedChatProvider } from "@/contexts/MinimizedChatContext";


export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {

  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
            <AuthProvider>
                <InAppNotificationProvider>
                    <MinimizedChatProvider>
                        {children}
                        <Toaster />
                    </MinimizedChatProvider>
                </InAppNotificationProvider>
            </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
