"use client";

import { useEffect } from "react";
import {
  cloudConfigured,
  readLatestPortfolioIntelligence,
  refreshSession,
} from "./cloud-client";

const CARD_KEY = "cardsignal-added-cards";

type Json = Record<string, unknown>;
type SavedCard = Json & {
  id?: number;
  marketScan?: Json;
  supplySnapshot?: Json;
};

function newestByCard(rows: Json[]) {
  const newest = new Map<number, Json>();
  const counts = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.client_card_id || 0);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
    if (!newest.has(id)) newest.set(id, row);
  }
  return { newest, counts };
}

function readCards(): SavedCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CARD_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ScheduledIntelligenceBridge() {
  useEffect(() => {
    if (!cloudConfigured()) return;
    let cancelled = false;
    let timer: number | undefined;

    const hydrate = async () => {
      try {
        const session = await refreshSession();
        if (!session || cancelled) return;
        const intelligence = await readLatestPortfolioIntelligence(
          session.access_token,
        );
        if (cancelled) return;
        const cards = readCards();
        if (!cards.length) return;
        const market = newestByCard(intelligence.snapshots as Json[]);
        const supply = newestByCard(intelligence.supply as Json[]);
        let changed = false;
        const next = cards.map((card) => {
          const id = Number(card.id || 0);
          const marketRow = market.newest.get(id);
          const supplyRow = supply.newest.get(id);
          let updated = card;
          if (
            marketRow &&
            Date.parse(String(marketRow.scanned_at || "")) >
              Date.parse(String(card.marketScan?.scannedAt || "1970-01-01"))
          ) {
            const currentMedian =
              marketRow.current_median == null
                ? null
                : Number(marketRow.current_median);
            updated = {
              ...updated,
              marketValue: currentMedian ?? updated.marketValue,
              marketScan: {
                ...(updated.marketScan || {}),
                scannedAt: String(marketRow.scanned_at),
                acceptedCount: Number(marketRow.accepted_count || 0),
                rejectedCount: Number(marketRow.rejected_count || 0),
                currentMedian,
                recentMedian:
                  marketRow.recent_median == null
                    ? null
                    : Number(marketRow.recent_median),
                priorMedian:
                  marketRow.prior_median == null
                    ? null
                    : Number(marketRow.prior_median),
                change7d:
                  marketRow.change_7d == null
                    ? null
                    : Number(marketRow.change_7d),
                recentSales: Number(marketRow.recent_sales || 0),
                velocity:
                  marketRow.velocity == null
                    ? null
                    : Number(marketRow.velocity),
                pulse: String(marketRow.pulse || "NOT ENOUGH DATA"),
                confidence: String(marketRow.confidence || "LOW"),
                source: "Scheduled cloud scan",
              },
              liveValuation: {
                ...((updated.liveValuation as Json) || {}),
                provider: "Scheduled cloud scan",
                compCount: Number(marketRow.accepted_count || 0),
                median: currentMedian,
                confidence: String(marketRow.confidence || "LOW"),
                savedAt: String(marketRow.scanned_at),
              },
            };
            changed = true;
          }
          if (
            supplyRow &&
            Date.parse(String(supplyRow.scanned_at || "")) >
              Date.parse(String(card.supplySnapshot?.scannedAt || "1970-01-01"))
          ) {
            updated = {
              ...updated,
              supplySnapshot: {
                scannedAt: String(supplyRow.scanned_at),
                provider: String(supplyRow.provider || "eBay Browse API"),
                activeAccepted: Number(supplyRow.accepted_count || 0),
                rawTotal: Number(supplyRow.raw_total || 0),
                lowestAsk:
                  supplyRow.lowest_ask == null
                    ? null
                    : Number(supplyRow.lowest_ask),
                medianAsk:
                  supplyRow.median_ask == null
                    ? null
                    : Number(supplyRow.median_ask),
                highestAsk:
                  supplyRow.highest_ask == null
                    ? null
                    : Number(supplyRow.highest_ask),
                inventoryDeltaPct:
                  supplyRow.inventory_delta_pct == null
                    ? null
                    : Number(supplyRow.inventory_delta_pct),
                medianAskDeltaPct:
                  supplyRow.median_ask_delta_pct == null
                    ? null
                    : Number(supplyRow.median_ask_delta_pct),
                historyCount: supply.counts.get(id) || 1,
                identityConfidence: String(
                  supplyRow.identity_confidence || "LOW",
                ),
                state: String(supplyRow.supply_state || "BASELINE"),
                source: "Scheduled cloud scan",
              },
            };
            changed = true;
          }
          return updated;
        });
        if (changed) {
          localStorage.setItem(CARD_KEY, JSON.stringify(next));
          window.dispatchEvent(
            new CustomEvent("cardsignal:scheduled-intelligence-loaded", {
              detail: {
                marketCards: market.newest.size,
                supplyCards: supply.newest.size,
              },
            }),
          );
          window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
        }
      } catch {
        // The rest of CardSignal remains usable if cloud intelligence is unavailable.
      }
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(hydrate, 900);
    };
    schedule();
    window.addEventListener("cardsignal:cloud-restored", schedule);
    window.addEventListener("cardsignal:cloud-auth-changed", schedule);
    const interval = window.setInterval(hydrate, 5 * 60_000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("cardsignal:cloud-restored", schedule);
      window.removeEventListener("cardsignal:cloud-auth-changed", schedule);
    };
  }, []);
  return null;
}
