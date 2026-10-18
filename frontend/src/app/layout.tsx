import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketMind AI | Market Intelligence",
  description: "AI-ready stock market analytics for India and global markets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
