import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import FunctionalLayer from "./functional-layer";
import CardDetailLayer from "./card-detail-layer";
import UserCardLayer from "./user-card-layer";
import LiveMarketLayer from "./live-market-layer";
import "./globals.css";
import "./asset-overrides.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CardSignal",
  description: "Know before the card market moves.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <FunctionalLayer />
        <CardDetailLayer />
        <UserCardLayer />
        <LiveMarketLayer />
      </body>
    </html>
  );
}
