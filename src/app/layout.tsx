import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "農産物販売プランナー",
  description: "複数の商品構成を組み合わせて、農産物の販売計画が目標に届くかを見るプランナー。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "農産物販売プランナー",
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
