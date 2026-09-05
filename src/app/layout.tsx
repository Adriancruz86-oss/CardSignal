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
import ActionCenterLayer from "./action-center-layer";
import TopToolsNavLayer from "./top-tools-nav-layer";
import StatCardNavigationLayer from "./stat-card-navigation-layer";
import CardSignalScoreLayer from "./card-signal-score-layer";
import PortfolioWorkbenchLayer from "./portfolio-workbench-layer";
import CatalystCenterLayer from "./catalyst-center-layer";
import CatalystIntegrationLayer from "./catalyst-integration-layer";
import CatalystHistoryLayer from "./catalyst-history-layer";
import CatalystOutcomeLayer from "./catalyst-outcome-layer";
import OpportunityFeedLayer from "./opportunity-feed-layer";
import OpportunityActionsLayer from "./opportunity-actions-layer";
import DecisionJournalLayer from "./decision-journal-layer";
import DiscoveryRadarLayer from "./discovery-radar-layer";
import MarketScoutLayer from "./market-scout-layer";
import MarketContextLayer from "./market-context-layer";
import GradingPopulationLayer from "./grading-population-layer";
import GradingPopulationAlertsLayer from "./grading-population-alerts-layer";
import SegmentExplorerLayer from "./segment-explorer-layer";
import PlayerPerformanceLayer from "./player-performance-layer";
import PerformanceWatchLayer from "./performance-watch-layer";
import PortfolioLeagueFilterLayer from "./portfolio-league-filter-layer";
import CardLeagueEditorLayer from "./card-league-editor-layer";
import BenchmarkPortfolioLayer from "./benchmark-portfolio-layer";
import BenchmarkHealthLayer from "./benchmark-health-layer";
import BenchmarkScanReadinessLayer from "./benchmark-scan-readiness-layer";
import ValidationCohortLayer from "./validation-cohort-layer";
import PokemonPortfolioLayer from "./pokemon-portfolio-layer";
import EdgeStackLayer from "./edge-stack-layer";
import HistoricalAnalogsLayer from "./historical-analogs-layer";
import CloudAuthLayer from "./cloud-auth-layer";
import CloudSyncLayer from "./cloud-sync-layer";
import "./globals.css";
import "./asset-overrides.css";
import "./live-market-click-fix.css";
import "./signal-lab-dropdown-fix.css";
import "./ui-polish-pass.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "CardSignal", description: "Know before the card market moves." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <FunctionalLayer />
        <CardDetailLayer />
        <UserCardLayer />
        <PortfolioLeagueFilterLayer />
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
        <ActionCenterLayer />
        <TopToolsNavLayer />
        <StatCardNavigationLayer />
        <CardSignalScoreLayer />
        <PortfolioWorkbenchLayer />
        <CatalystCenterLayer />
        <CatalystIntegrationLayer />
        <CatalystHistoryLayer />
        <CatalystOutcomeLayer />
        <OpportunityFeedLayer />
        <OpportunityActionsLayer />
        <DecisionJournalLayer />
        <DiscoveryRadarLayer />
        <MarketScoutLayer />
        <MarketContextLayer />
        <CardLeagueEditorLayer />
        <PlayerPerformanceLayer />
        <PerformanceWatchLayer />
        <GradingPopulationLayer />
        <GradingPopulationAlertsLayer />
        <SegmentExplorerLayer />
        <BenchmarkPortfolioLayer />
        <BenchmarkHealthLayer />
        <BenchmarkScanReadinessLayer />
        <ValidationCohortLayer />
        <PokemonPortfolioLayer />
        <EdgeStackLayer />
        <HistoricalAnalogsLayer />
        <CloudSyncLayer />
        <CloudAuthLayer />
      </body>
    </html>
  );
}
