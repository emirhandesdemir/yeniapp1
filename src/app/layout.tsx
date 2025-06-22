
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HiweWalk - Sunucu Testi",
  description: "Sunucu başlangıç testi yapılıyor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}
