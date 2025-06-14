import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext'; // AuthProvider'ı import et

export const metadata: Metadata = {
  title: 'Sohbet Küresi',
  description: 'Arkadaşlarınızla sohbet edin ve yeni bağlantılar kurun.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <AuthProvider> {/* AuthProvider ile children'ı sarmala */}
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
