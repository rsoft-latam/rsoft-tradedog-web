import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeDog — the guardian of trading agents",
  description: "Datadog watches your servers. TradeDog watches your trading agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
