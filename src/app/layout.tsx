import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import FunctionalLayer from "./functional-layer";
import CardDetailLayer from "./card-detail-layer";
import UserCardLayer from "./user-card-layer";
import LiveMarketLayer from "./live-market-layer";
import ValuationBridge from "./valuation-bridge";
import ValuationOverride from "./valuation-override";
import DataSourcesLayer from "./data-sources-layer";
import SignalLabLayer from "./signal-lab-layer";
import SignalLabFallbackLayer from "./signal-lab-fallback-layer";
import PhotoCatalogGuardLayer from "./photo-catalog-guard-layer";
import PhotoOcrFallbackLayer from "./photo-ocr-fallback-layer";
import PortfolioPulseLayer from "./portfolio-pulse-v2";
import DashboardLiveLayer from "./dashboard-live-layer";
import ScanHistoryAlertsLayer from "./scan-history-alerts-layer";
import HistoryHomeBridge from "./history-home-bridge";
import SupplyWatchBridgeLayer from "./supply-watch-bridge-layer";
import "./globals.css";
import "./asset-overrides.css";
import "./live-market-click-fix.css";
import "./signal-lab-dropdown-fix.css";

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <FunctionalLayer />
        <CardDetailLayer />
        <UserCardLayer />
        <LiveMarketLayer />
        <ValuationBridge />
        <ValuationOverride />
        <DataSourcesLayer />
        <SignalLabLayer />
        <SignalLabFallbackLayer />
        <PhotoCatalogGuardLayer />
        <PhotoOcrFallbackLayer />
        <PortfolioPulseLayer />
        <DashboardLiveLayer />
        <ScanHistoryAlertsLayer />
        <HistoryHomeBridge />
        <SupplyWatchBridgeLayer />
      </body>
    </html>
  );
}
