
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HiweWalk - Hata Ayıklama',
  description: 'Başlangıç sorunları gideriliyor.',
};

// Bu, 404 hatasının kaynağını bulmak için basitleştirilmiş bir RootLayout'tur.
// Tüm karmaşık sağlayıcılar (Provider) geçici olarak kaldırılmıştır.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
