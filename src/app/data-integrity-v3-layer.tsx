"use client";

import { useEffect } from "react";

const CARD_KEY = "cardsignal-added-cards";
const MIGRATION_KEY = "cardsignal-integrity-v3";
const DERIVED_KEYS = [
  "cardsignal-alerts",
  "cardsignal-portfolio-history",
  "cardsignal-longitudinal-scan-history",
];

type StoredCard = {
  marketScan?: { matchingVersion?: number };
  supplySnapshot?: { matchingVersion?: number };
  marketValue?: number;
  score?: number;
  move?: string;
  tone?: string;
  valuationStatus?: string;
  liveValuation?: { provider?: string };
  [key: string]: unknown;
};

function migrate() {
  let changed = false;
  let legacyFound = false;
  try {
    const parsed = JSON.parse(localStorage.getItem(CARD_KEY) || "[]");
    if (Array.isArray(parsed)) {
      const cards = (parsed as StoredCard[]).map((card) => {
        const legacyMarket =
          card.marketScan && Number(card.marketScan.matchingVersion || 0) < 3;
        const legacySupply =
          card.supplySnapshot &&
          Number(card.supplySnapshot.matchingVersion || 0) < 3;
        const portfolioDerived =
          String(card.liveValuation?.provider || "") === "Portfolio Scan";
        if (!legacyMarket && !legacySupply) return card;
        legacyFound = true;
        changed = true;
        const next = { ...card };
        if (legacyMarket) {
          delete next.marketScan;
          delete next.liveValuation;
          next.score = 0;
          next.move = "NEEDS FRESH EXACT SCAN";
          next.tone = "hold";
          next.valuationStatus = "NO_MATCH";
          if (portfolioDerived || !card.valuationStatus) next.marketValue = 0;
        }
        if (legacySupply) delete next.supplySnapshot;
        return next;
      });
      if (changed) localStorage.setItem(CARD_KEY, JSON.stringify(cards));
    }
    for (const key of [
      "cardsignal-supply-history",
      "cardsignal-scan-history",
    ]) {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(value)) continue;
      const current = value.filter(
        (row: { matchingVersion?: number }) =>
          Number(row?.matchingVersion || 0) >= 3,
      );
      if (current.length !== value.length) {
        legacyFound = true;
        changed = true;
        localStorage.setItem(key, JSON.stringify(current));
      }
    }
    if (legacyFound) {
      for (const key of DERIVED_KEYS) {
        if (localStorage.getItem(key) && localStorage.getItem(key) !== "[]") {
          localStorage.setItem(key, "[]");
          changed = true;
        }
      }
    }
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    if (changed) {
      window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
      window.dispatchEvent(new Event("cardsignal:history-changed"));
    }
  } catch {
    // Malformed legacy state must never block the app.
  }
}

export default function DataIntegrityV3Layer() {
  useEffect(() => {
    if (!localStorage.getItem(MIGRATION_KEY)) migrate();
    const restored = () => migrate();
    window.addEventListener("cardsignal:cloud-restored", restored);
    return () =>
      window.removeEventListener("cardsignal:cloud-restored", restored);
  }, []);
  return null;
}
