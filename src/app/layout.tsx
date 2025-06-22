
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { InAppNotificationProvider } from '@/contexts/InAppNotificationContext';
import { MinimizedChatProvider } from '@/contexts/MinimizedChatContext';
import "./globals.css";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'HiweWalk',
    template: '%s - HiweWalk',
  },
  description: 'Canlı topluluklar, dinamik sohbetler ve sonsuz eğlence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
          <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={inter.className}>
        <ThemeProvider storageKey="hiwewalk-theme">
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
