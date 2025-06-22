import type { ReactNode } from "react";
import "./globals.css";

// Teşhis için en temel RootLayout. Provider veya karmaşık bileşenler yok.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}
