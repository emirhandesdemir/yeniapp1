
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { InAppNotificationProvider } from '@/contexts/InAppNotificationContext';

export const metadata: Metadata = {
  title: 'Sohbet Küresi',
  description: 'Arkadaşlarınızla sohbet edin ve yeni bağlantılar kurun.',
  manifest: '/manifest.json', // PWA için manifest dosyası eklendi
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        
        {/* PWA Meta Etiketleri */}
        <meta name="application-name" content="Sohbet Küresi" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sohbet Küresi" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#6A47D1" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#FFFFFF" /> {/* Light theme-color */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" /> {/* iOS için daha büyük ikon */}
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167x167.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#6A47D1" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* iOS için başlangıç ekranları (isteğe bağlı, daha iyi deneyim için) */}
        {/* Farklı ekran boyutları için bunları ekleyebilirsiniz */}
        {/* <link rel="apple-touch-startup-image" href="/images/apple_splash_2048.png" sizes="2048x2732" /> */}
        {/* <link rel="apple-touch-startup-image" href="/images/apple_splash_1668.png" sizes="1668x2224" /> */}
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <ThemeProvider
          defaultTheme="dark"
          storageKey="sohbet-kuresi-theme"
        >
          <AuthProvider>
            <InAppNotificationProvider>
              {children}
              <Toaster />
            </InAppNotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
