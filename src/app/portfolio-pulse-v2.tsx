"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { effectivePulse, type SupplyEvidence } from "./supply-signal";
import { getCardSignalScore } from "./card-signal-score";

type Identity = {
  year?: string;
  setName?: string;
  cardNumber?: string;
  playerName?: string;
  variation?: string;
  cardId?: string;
};
type PulseStatus =
  "BUY MORE" | "HOLD" | "WATCH CLOSELY" | "SELL RISK" | "NOT ENOUGH DATA";
type MarketScan = {
  matchingVersion?: number;
  scannedAt: string;
  acceptedCount: number;
  rejectedCount: number;
  currentMedian: number | null;
  recentMedian: number | null;
  priorMedian: number | null;
  change7d: number | null;
  recentSales: number;
  velocity: number | null;
  pulse: PulseStatus;
  confidence: string;
  elapsedMs: number;
};
type StoredCard = {
  id: number;
  player: string;
  meta?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  gradingCompany?: string;
  grade?: string;
  mode?: "owned" | "watching";
  score?: number;
  move?: string;
  tone?: "buy" | "hold" | "sell";
  marketValue?: number;
  demo?: boolean;
  benchmark?: boolean;
  catalogConfirmed?: boolean;
  catalogSource?: string;
  canonicalIdentity?: Identity;
  liveValuation?: {
    compCount?: number;
    median?: number;
    confidence?: string;
    provider?: string;
    savedAt?: string;
  };
  marketScan?: MarketScan;
  supplySnapshot?: SupplyEvidence;
};
type ScanResponse = {
  ok: boolean;
  error?: string;
  elapsedMs?: number;
  acceptedCount?: number;
  rejectedCount?: number;
  currentMedian?: number | null;
  recentMedian?: number | null;
  priorMedian?: number | null;
  change7d?: number | null;
  recentSales?: number;
  velocity?: number | null;
  pulse?: PulseStatus;
  confidence?: string;
  matchingVersion?: number;
};

const STORAGE_KEY = "cardsignal-added-cards";
const MAX_CARDS = 500;
const CONCURRENCY = 4;

function readCards(): StoredCard[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeCards(cards: StoredCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.slice(0, MAX_CARDS)));
  window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
}
function classify(card: StoredCard) {
  const s = card.marketScan;
  return {
    ...card,
    pulse: effectivePulse(
      s?.pulse,
      s?.change7d,
      card.supplySnapshot,
    ) as PulseStatus,
    change7d: s?.change7d ?? null,
    velocity: s?.velocity ?? null,
    confidence: s?.confidence || "LOW",
    acceptedCount: s?.acceptedCount || 0,
  };
}
function statusClass(s: PulseStatus) {
  return s === "BUY MORE"
    ? "buy"
    : s === "SELL RISK"
      ? "sell"
      : s === "WATCH CLOSELY"
        ? "watch"
        : s === "HOLD"
          ? "hold"
          : "nodata";
}
function scanParams(card: StoredCard) {
  const id = card.canonicalIdentity || {};
  const gradeMatch = String(card.meta || "").match(
    /\b(PSA|BGS|SGC|CGC)\s*([0-9.]+)/i,
  );
  const grader =
    card.gradingCompany ||
    (/\bRaw\b/i.test(card.meta || "") ? "Raw" : gradeMatch?.[1] || "");
  const grade = card.grade || gradeMatch?.[2] || "";
  return new URLSearchParams({
    player: id.playerName || card.player,
    year: id.year || card.year || "",
    set: id.setName || card.setName || "",
    cardNumber: id.cardNumber || card.cardNumber || "",
    variant: id.variation || card.variant || "",
    grader,
    grade,
  });
}

export default function PortfolioPulseV2() {
  const [open, setOpen] = useState(false),
    [cards, setCards] = useState<StoredCard[]>([]),
    [scanning, setScanning] = useState(false),
    [visibleCount, setVisibleCount] = useState(15),
    [progress, setProgress] = useState("");
  const cancelRef = useRef(false);
  const refresh = () => setCards(readCards());
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("cardsignal:user-cards-changed", h);
    return () => window.removeEventListener("cardsignal:user-cards-changed", h);
  }, []);
  useEffect(() => {
    if (open) refresh();
  }, [open]);
  const rows = useMemo(
    () => cards.filter((c) => c.mode !== "watching").map(classify),
    [cards],
  );
  const counts = useMemo(
    () => ({
      buy: rows.filter((r) => r.pulse === "BUY MORE").length,
      sell: rows.filter((r) => r.pulse === "SELL RISK").length,
      watch: rows.filter((r) => r.pulse === "WATCH CLOSELY").length,
      hold: rows.filter((r) => r.pulse === "HOLD").length,
      nodata: rows.filter((r) => r.pulse === "NOT ENOUGH DATA").length,
    }),
    [rows],
  );
  const benchmarkCount = cards.filter((c) => c.benchmark).length;

  const scanOne = async (card: StoredCard) => {
    try {
      const r = await fetch(
        `/api/portfolio-scan?${scanParams(card).toString()}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as ScanResponse;
      if (!r.ok || !j.ok) return null;
      const scan: MarketScan = {
        matchingVersion: Number(j.matchingVersion || 0),
        scannedAt: new Date().toISOString(),
        acceptedCount: Number(j.acceptedCount || 0),
        rejectedCount: Number(j.rejectedCount || 0),
        currentMedian: j.currentMedian ?? null,
        recentMedian: j.recentMedian ?? null,
        priorMedian: j.priorMedian ?? null,
        change7d: j.change7d ?? null,
        recentSales: Number(j.recentSales || 0),
        velocity: j.velocity ?? null,
        pulse: j.pulse || "NOT ENOUGH DATA",
        confidence: j.confidence || "LOW",
        elapsedMs: Number(j.elapsedMs || 0),
      };
      return scan;
    } catch {
      return null;
    }
  };

  const scanPortfolio = async () => {
    if (scanning) return;
    const targets = readCards()
      .filter((c) => c.mode !== "watching" && c.player)
      .slice(0, MAX_CARDS);
    if (!targets.length) {
      setProgress("No owned cards to scan.");
      return;
    }
    setScanning(true);
    cancelRef.current = false;
    let completed = 0,
      withData = 0,
      failed = 0;
    setProgress(`Scanning 0 / ${targets.length} cards…`);
    try {
      for (let start = 0; start < targets.length; start += CONCURRENCY) {
        if (cancelRef.current) break;
        const batch = targets.slice(start, start + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (card) => ({ card, scan: await scanOne(card) })),
        );
        let next = readCards();
        for (const { card, scan } of results) {
          completed++;
          if (!scan) {
            failed++;
            continue;
          }
          if (scan.acceptedCount >= 3) withData++;
          next = next.map((c) => {
            if (c.id !== card.id) return c;
            const updated = {
              ...c,
              marketScan: scan,
              marketValue: c.marketValue || 0,
              valuationStatus:
                scan.currentMedian == null ? "NO_MATCH" : "UNREVIEWED",
            };
            const pulse = effectivePulse(
              scan.pulse,
              scan.change7d,
              c.supplySnapshot,
            );
            return {
              ...updated,
              move:
                scan.change7d == null
                  ? "NEEDS TREND DATA"
                  : `${scan.change7d >= 0 ? "+" : ""}${scan.change7d.toFixed(1)}% 7D`,
              score: getCardSignalScore(updated).score,
              tone:
                pulse === "BUY MORE"
                  ? "buy"
                  : pulse === "SELL RISK"
                    ? "sell"
                    : "hold",
              liveValuation: {
                ...(c.liveValuation || {}),
                provider: "Portfolio Scan",
                compCount: scan.acceptedCount,
                median: scan.currentMedian ?? undefined,
                confidence: scan.confidence,
                savedAt: scan.scannedAt,
              },
            };
          });
        }
        writeCards(next);
        refresh();
        setProgress(
          `Scanning ${completed} / ${targets.length} · ${withData} actionable · ${failed} failed`,
        );
        if (start + CONCURRENCY < targets.length)
          await new Promise((r) => setTimeout(r, 120));
      }
      setProgress(
        cancelRef.current
          ? `Scan stopped after ${completed} cards. Saved progress was kept.`
          : `Scan complete. ${withData} of ${targets.length} cards have 3+ exact comps; ${failed} failed.`,
      );
    } finally {
      setScanning(false);
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const rank: Record<PulseStatus, number> = {
      "SELL RISK": 0,
      "BUY MORE": 1,
      "WATCH CLOSELY": 2,
      HOLD: 3,
      "NOT ENOUGH DATA": 4,
    };
    return rank[a.pulse] - rank[b.pulse];
  });
  return (
    <>
      <button
        className="cs-pulse-launch"
        onClick={() => {
          setVisibleCount(15);
          setOpen(true);
        }}
      >
        ◉ PORTFOLIO PULSE
      </button>
      {open && (
        <div
          className="cs-pulse-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section className="cs-pulse-modal">
            <button className="cs-pulse-close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="cs-pulse-head">
              <span>COLLECTION INTELLIGENCE</span>
              <h2>Portfolio Pulse</h2>
              <p>
                Batch scanning is now safe for benchmark portfolios up to{" "}
                {MAX_CARDS} cards. Each completed batch is saved immediately.
              </p>
            </div>
            <div className="cs-pulse-actions">
              <button
                className="scan"
                onClick={scanPortfolio}
                disabled={scanning}
              >
                {scanning ? "SCANNING PORTFOLIO…" : "◉ SCAN MY PORTFOLIO"}
              </button>
              {scanning && (
                <button
                  className="stop"
                  onClick={() => {
                    cancelRef.current = true;
                    setProgress("Stopping after the current batch…");
                  }}
                >
                  STOP AFTER BATCH
                </button>
              )}
              <span>
                {cards.length} total · {benchmarkCount} benchmark ·{" "}
                {CONCURRENCY} concurrent
              </span>
            </div>
            {progress && <div className="cs-pulse-progress">{progress}</div>}
            <div className="cs-pulse-stats">
              <div className="buy">
                <small>BUY MORE</small>
                <strong>{counts.buy}</strong>
              </div>
              <div className="sell">
                <small>SELL RISK</small>
                <strong>{counts.sell}</strong>
              </div>
              <div className="watch">
                <small>WATCH</small>
                <strong>{counts.watch}</strong>
              </div>
              <div className="hold">
                <small>HOLD</small>
                <strong>{counts.hold}</strong>
              </div>
              <div className="nodata">
                <small>NEEDS DATA</small>
                <strong>{counts.nodata}</strong>
              </div>
            </div>
            <div className="cs-pulse-list">
              {sorted.length === 0 ? (
                <div className="cs-pulse-empty">No owned cards yet.</div>
              ) : (
                sorted.slice(0, visibleCount).map((card) => (
                  <article key={card.id}>
                    <div>
                      <strong>{card.player}</strong>
                      <span>{card.meta || "Card details unavailable"}</span>
                      <small>
                        {card.benchmark ? "BENCHMARK · " : ""}
                        {card.marketScan
                          ? `scanned ${new Date(card.marketScan.scannedAt).toLocaleString()}`
                          : "not scanned"}
                      </small>
                    </div>
                    <div>
                      <small>7D</small>
                      <b>
                        {card.change7d == null
                          ? "—"
                          : `${card.change7d >= 0 ? "+" : ""}${card.change7d.toFixed(1)}%`}
                      </b>
                    </div>
                    <div>
                      <small>COMPS / VELOCITY</small>
                      <b>
                        {card.marketScan
                          ? `${card.acceptedCount} · ${card.velocity ?? "—"}`
                          : "—"}
                      </b>
                    </div>
                    <div
                      className={`cs-pulse-badge ${statusClass(card.pulse)}`}
                    >
                      <b>{card.pulse}</b>
                      <small>{card.confidence}</small>
                    </div>
                  </article>
                ))
              )}
            </div>
            {sorted.length > visibleCount && (
              <button
                className="cs-pulse-more"
                onClick={() =>
                  setVisibleCount((count) =>
                    Math.min(count + 15, sorted.length),
                  )
                }
              >
                SHOW 15 MORE · {sorted.length - visibleCount} REMAINING
              </button>
            )}
            <div className="cs-pulse-note">
              No signal is issued with fewer than three accepted exact comps.
              Cancelling never rolls back completed batches.
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .cs-pulse-launch {
          position: fixed;
          left: 24px;
          bottom: 122px;
          z-index: 890;
          height: 38px;
          padding: 0 14px;
          border: 1px solid rgba(72, 241, 157, 0.33);
          border-radius: 9px;
          background: rgba(7, 38, 34, 0.94);
          color: #99ffc5;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }
        .cs-pulse-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1460;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 7, 12, 0.86);
          backdrop-filter: blur(15px);
        }
        .cs-pulse-modal {
          position: relative;
          width: min(1140px, 97vw);
          max-height: 92vh;
          overflow: auto;
          padding: 28px;
          border: 1px solid rgba(73, 205, 255, 0.22);
          border-radius: 18px;
          background: linear-gradient(155deg, #081d2e, #04111d 62%, #061821);
          color: #effaff;
        }
        .cs-pulse-close {
          position: absolute;
          right: 16px;
          top: 14px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(100, 189, 225, 0.16);
          border-radius: 8px;
          background: #071724;
          color: #8cabbd;
          font-size: 24px;
        }
        .cs-pulse-head > span {
          color: #58dcff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }
        .cs-pulse-head h2 {
          margin: 7px 0 5px;
          font-size: 29px;
        }
        .cs-pulse-head p {
          margin: 0;
          color: #7897a7;
          font-size: 10px;
        }
        .cs-pulse-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          margin: 18px 0;
        }
        .cs-pulse-actions button {
          height: 36px;
          padding: 0 12px;
          border: 1px solid rgba(72, 241, 157, 0.28);
          border-radius: 8px;
          background: rgba(39, 202, 124, 0.08);
          color: #9affc5;
          font-size: 8px;
          font-weight: 900;
        }
        .cs-pulse-actions .stop {
          border-color: rgba(255, 112, 130, 0.25);
          color: #ff9cab;
        }
        .cs-pulse-actions span {
          color: #6d8d9c;
          font-size: 8px;
        }
        .cs-pulse-progress {
          padding: 9px;
          border: 1px solid rgba(83, 210, 255, 0.12);
          border-radius: 8px;
          color: #89c9dd;
          font-size: 8px;
        }
        .cs-pulse-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 7px;
          margin: 12px 0;
        }
        .cs-pulse-stats > div {
          padding: 10px;
          border: 1px solid rgba(80, 190, 225, 0.09);
          border-radius: 8px;
          background: rgba(5, 20, 32, 0.58);
        }
        .cs-pulse-stats small,
        .cs-pulse-stats strong {
          display: block;
        }
        .cs-pulse-stats small {
          color: #688897;
          font-size: 6px;
          font-weight: 900;
        }
        .cs-pulse-stats strong {
          margin-top: 4px;
          font-size: 18px;
        }
        .cs-pulse-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cs-pulse-list article {
          display: grid;
          grid-template-columns: 1fr 90px 130px 150px;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border: 1px solid rgba(80, 190, 225, 0.08);
          border-radius: 8px;
          background: rgba(5, 20, 32, 0.6);
        }
        .cs-pulse-list strong,
        .cs-pulse-list span,
        .cs-pulse-list small {
          display: block;
        }
        .cs-pulse-list span {
          color: #7895a3;
          font-size: 8px;
        }
        .cs-pulse-list small {
          color: #607e8d;
          font-size: 6px;
        }
        .cs-pulse-list b {
          font-size: 9px;
        }
        .cs-pulse-badge {
          padding: 7px;
          border: 1px solid rgba(80, 190, 225, 0.12);
          border-radius: 7px;
        }
        .cs-pulse-badge.buy {
          color: #62efa5;
        }
        .cs-pulse-badge.sell {
          color: #ff8190;
        }
        .cs-pulse-badge.watch {
          color: #efc86e;
        }
        .cs-pulse-badge.hold {
          color: #70dfff;
        }
        .cs-pulse-badge.nodata {
          color: #a89cdf;
        }
        .cs-pulse-note {
          margin-top: 10px;
          color: #5f7d8a;
          font-size: 7px;
        }
        .cs-pulse-more {
          width: 100%;
          margin-top: 9px;
          padding: 11px;
          border: 1px solid rgba(83, 210, 255, 0.14);
          border-radius: 8px;
          background: rgba(8, 27, 40, 0.66);
          color: #89c9dd;
          font-size: 8px;
          font-weight: 900;
        }
        @media (max-width: 760px) {
          .cs-pulse-stats {
            grid-template-columns: 1fr 1fr;
          }
          .cs-pulse-list article {
            grid-template-columns: 1fr 1fr;
          }
          .cs-pulse-actions {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
