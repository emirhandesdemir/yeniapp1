
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import { InAppNotificationProvider } from "@/contexts/InAppNotificationContext";
import { MinimizedChatProvider } from "@/contexts/MinimizedChatContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HiweWalk",
  description: "Yeni nesil sosyal etkileşim platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="hiwewalk-theme"
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
