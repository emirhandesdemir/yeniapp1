
import './globals.css';

export const metadata = {
  title: 'HiweWalk - Hata Ayıklama',
  description: 'Uygulama başlangıç sorunu gideriliyor.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
