import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "手残り販売計画",
  description: "複数の取れた量・売る形・販売計画を合算できる販売計画シミュレーター。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "手残り販売計画",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#286c4a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
