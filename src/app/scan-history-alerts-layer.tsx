"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
type Card = {
  id: number;
  player: string;
  meta?: string;
  mode?: "owned" | "watching";
  marketValue?: number;
  demo?: boolean;
  marketScan?: MarketScan;
};
type ScanSnapshot = {
  matchingVersion?: number;
  id: string;
  cardId: number;
  player: string;
  meta: string;
  scannedAt: string;
  acceptedCount: number;
  currentMedian: number | null;
  change7d: number | null;
  velocity: number | null;
  pulse: PulseStatus;
  confidence: string;
};
type PortfolioSnapshot = {
  scannedAt: string;
  portfolioValue: number;
  ownedCount: number;
  pricedCount: number;
  evidenceCount: number;
  buy: number;
  sell: number;
  watch: number;
  hold: number;
  needsData: number;
};
type AlertKind = "buy" | "sell" | "watch" | "info" | "resolved";
type Alert = {
  matchingVersion?: number;
  id: string;
  cardId: number;
  player: string;
  meta: string;
  createdAt: string;
  kind: AlertKind;
  title: string;
  detail: string;
  from?: PulseStatus;
  to?: PulseStatus;
  read?: boolean;
};

const CARD_KEY = "cardsignal-added-cards";
const HISTORY_KEY = "cardsignal-scan-history";
const PORTFOLIO_HISTORY_KEY = "cardsignal-portfolio-history";
const ALERTS_KEY = "cardsignal-alerts";

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "");
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}
function readCards(): Card[] {
  const v = readJson<Card[]>(CARD_KEY, []);
  return Array.isArray(v) ? v : [];
}
function money(v: number | null | undefined) {
  return v == null
    ? "—"
    : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function alertKind(pulse: PulseStatus): AlertKind {
  return pulse === "BUY MORE"
    ? "buy"
    : pulse === "SELL RISK"
      ? "sell"
      : pulse === "WATCH CLOSELY"
        ? "watch"
        : "info";
}
function sameScan(a?: MarketScan, b?: MarketScan) {
  return !!a && !!b && a.scannedAt === b.scannedAt;
}
function snapshot(card: Card): ScanSnapshot | null {
  const s = card.marketScan;
  if (!s) return null;
  return {
    matchingVersion: s.matchingVersion,
    id: `${card.id}-${s.scannedAt}`,
    cardId: card.id,
    player: card.player,
    meta: card.meta || "",
    scannedAt: s.scannedAt,
    acceptedCount: s.acceptedCount,
    currentMedian: s.currentMedian,
    change7d: s.change7d,
    velocity: s.velocity,
    pulse: s.pulse,
    confidence: s.confidence,
  };
}
function portfolioSnapshot(cards: Card[]): PortfolioSnapshot {
  const owned = cards.filter((c) => c.mode !== "watching");
  const scans = owned
    .map((c) => c.marketScan)
    .filter((s): s is MarketScan => !!s && s.matchingVersion === 3);
  return {
    scannedAt: new Date().toISOString(),
    portfolioValue: owned.reduce(
      (sum, c) => sum + (Number(c.marketValue) || 0),
      0,
    ),
    ownedCount: owned.length,
    pricedCount: owned.filter((c) => (Number(c.marketValue) || 0) > 0).length,
    evidenceCount: scans.filter((s) => s.acceptedCount >= 3).length,
    buy: scans.filter((s) => s.acceptedCount >= 3 && s.pulse === "BUY MORE")
      .length,
    sell: scans.filter((s) => s.acceptedCount >= 3 && s.pulse === "SELL RISK")
      .length,
    watch: scans.filter(
      (s) => s.acceptedCount >= 3 && s.pulse === "WATCH CLOSELY",
    ).length,
    hold: scans.filter((s) => s.acceptedCount >= 3 && s.pulse === "HOLD")
      .length,
    needsData: owned.filter(
      (c) => !c.marketScan || c.marketScan.acceptedCount < 3,
    ).length,
  };
}
function buildAlerts(before: Card | undefined, after: Card): Alert[] {
  const old = before?.marketScan,
    newScan = after.marketScan;
  if (!newScan || sameScan(old, newScan)) return [];
  const now = newScan.scannedAt || new Date().toISOString();
  const base = {
    matchingVersion: newScan.matchingVersion,
    cardId: after.id,
    player: after.player,
    meta: after.meta || "",
    createdAt: now,
    read: false,
  };
  const out: Alert[] = [];
  if (!old) {
    if (newScan.acceptedCount >= 3)
      out.push({
        ...base,
        id: `${after.id}-${now}-evidence`,
        kind: "info",
        title: "Market evidence established",
        detail: `${newScan.acceptedCount} accepted market matches now support a ${newScan.pulse} reading.`,
      });
    return out;
  }
  if (old.pulse !== newScan.pulse) {
    const resolved =
      (old.pulse === "BUY MORE" || old.pulse === "SELL RISK") &&
      (newScan.pulse === "HOLD" ||
        newScan.pulse === "WATCH CLOSELY" ||
        newScan.pulse === "NOT ENOUGH DATA");
    out.push({
      ...base,
      id: `${after.id}-${now}-pulse`,
      kind: resolved ? "resolved" : alertKind(newScan.pulse),
      title: resolved
        ? `${old.pulse} cleared`
        : `Signal changed: ${old.pulse} → ${newScan.pulse}`,
      detail: `${after.player} changed from ${old.pulse} to ${newScan.pulse}.`,
      from: old.pulse,
      to: newScan.pulse,
    });
  }
  if (old.currentMedian && newScan.currentMedian && old.currentMedian > 0) {
    const d =
      ((newScan.currentMedian - old.currentMedian) / old.currentMedian) * 100;
    if (Math.abs(d) >= 8)
      out.push({
        ...base,
        id: `${after.id}-${now}-median`,
        kind: d > 0 ? "buy" : "sell",
        title: `Median ${d > 0 ? "jumped" : "fell"} ${Math.abs(d).toFixed(1)}%`,
        detail: `Accepted-market median moved from ${money(old.currentMedian)} to ${money(newScan.currentMedian)}.`,
      });
  }
  if (old.acceptedCount < 3 && newScan.acceptedCount >= 3)
    out.push({
      ...base,
      id: `${after.id}-${now}-threshold`,
      kind: "info",
      title: "Card became actionable",
      detail: `Evidence improved from ${old.acceptedCount} to ${newScan.acceptedCount} accepted market matches.`,
    });
  if (old.acceptedCount >= 3 && newScan.acceptedCount < 3)
    out.push({
      ...base,
      id: `${after.id}-${now}-lost-evidence`,
      kind: "watch",
      title: "Evidence weakened",
      detail: `Accepted market matches fell below the 3-comp signal threshold.`,
    });
  const compDelta = newScan.acceptedCount - old.acceptedCount;
  if (
    Math.abs(compDelta) >= 10 &&
    old.acceptedCount >= 3 &&
    newScan.acceptedCount >= 3
  )
    out.push({
      ...base,
      id: `${after.id}-${now}-activity`,
      kind: "info",
      title: `Market-match count ${compDelta > 0 ? "increased" : "decreased"}`,
      detail: `Accepted matches changed from ${old.acceptedCount} to ${newScan.acceptedCount}.`,
    });
  return out;
}

export default function ScanHistoryAlertsLayer() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<ScanSnapshot[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioSnapshot[]>(
    [],
  );
  const previous = useRef<Map<number, Card>>(new Map());
  const reload = () => {
    setAlerts(readJson<Alert[]>(ALERTS_KEY, []));
    setHistory(readJson<ScanSnapshot[]>(HISTORY_KEY, []));
    setPortfolioHistory(
      readJson<PortfolioSnapshot[]>(PORTFOLIO_HISTORY_KEY, []),
    );
  };
  useEffect(() => {
    const initial = readCards();
    previous.current = new Map(initial.map((c) => [c.id, c]));
    reload();
    const capture = () => {
      const cards = readCards();
      const oldMap = previous.current;
      let hist = readJson<ScanSnapshot[]>(HISTORY_KEY, []);
      let storedAlerts = readJson<Alert[]>(ALERTS_KEY, []);
      let changed = false;
      for (const card of cards) {
        const old = oldMap.get(card.id);
        if (card.marketScan && !sameScan(old?.marketScan, card.marketScan)) {
          const snap = snapshot(card);
          if (snap && !hist.some((h) => h.id === snap.id)) {
            hist.unshift(snap);
            changed = true;
          }
          const fresh = buildAlerts(old, card);
          if (fresh.length) {
            storedAlerts = [
              ...fresh,
              ...storedAlerts.filter((a) => !fresh.some((f) => f.id === a.id)),
            ];
            changed = true;
          }
        }
      }
      if (changed) {
        hist = hist.slice(0, 1200);
        storedAlerts = storedAlerts.slice(0, 500);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
        localStorage.setItem(ALERTS_KEY, JSON.stringify(storedAlerts));
        const p = portfolioSnapshot(cards);
        let ph = readJson<PortfolioSnapshot[]>(PORTFOLIO_HISTORY_KEY, []);
        const last = ph[0];
        if (
          last &&
          Math.abs(
            new Date(p.scannedAt).getTime() -
              new Date(last.scannedAt).getTime(),
          ) < 90000
        )
          ph = [p, ...ph.slice(1)];
        else ph = [p, ...ph];
        ph = ph.slice(0, 180);
        localStorage.setItem(PORTFOLIO_HISTORY_KEY, JSON.stringify(ph));
        window.dispatchEvent(new Event("cardsignal:history-changed"));
      }
      previous.current = new Map(cards.map((c) => [c.id, c]));
      reload();
    };
    window.addEventListener("cardsignal:user-cards-changed", capture);
    const click = (e: MouseEvent) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (button?.textContent?.trim() === "Alerts") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("cardsignal:user-cards-changed", capture);
      document.removeEventListener("click", click, true);
    };
  }, []);
  const unread = alerts.filter((a) => !a.read).length;
  const visible = useMemo(() => alerts.slice(0, 80), [alerts]);
  const markAllRead = () => {
    const next = alerts.map((a) => ({ ...a, read: true }));
    localStorage.setItem(ALERTS_KEY, JSON.stringify(next));
    setAlerts(next);
    window.dispatchEvent(new Event("cardsignal:history-changed"));
  };
  const clearAlerts = () => {
    if (
      !window.confirm(
        "Clear CardSignal alert history? Scan history will be kept.",
      )
    )
      return;
    localStorage.setItem(ALERTS_KEY, "[]");
    setAlerts([]);
    window.dispatchEvent(new Event("cardsignal:history-changed"));
  };
  return (
    <>
      {open && (
        <div
          className="cs-alert-history-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section className="cs-alert-history-modal">
            <button className="cs-ah-close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="cs-ah-head">
              <span>CHANGE TRACKING</span>
              <h2>Alerts & Scan History</h2>
              <p>
                CardSignal only creates an alert when a repeated scan produces a
                meaningful change.
              </p>
            </div>
            <div className="cs-ah-stats">
              <div>
                <small>ALERTS</small>
                <strong>{alerts.length}</strong>
                <span>{unread} unread</span>
              </div>
              <div>
                <small>CARD SNAPSHOTS</small>
                <strong>{history.length}</strong>
                <span>saved scan observations</span>
              </div>
              <div>
                <small>PORTFOLIO SNAPSHOTS</small>
                <strong>{portfolioHistory.length}</strong>
                <span>building trend history</span>
              </div>
              <div>
                <small>HISTORY STATUS</small>
                <strong>
                  {portfolioHistory.length >= 2 ? "ACTIVE" : "STARTING"}
                </strong>
                <span>
                  {portfolioHistory.length >= 2
                    ? "trend comparison available"
                    : "run another scan later"}
                </span>
              </div>
            </div>
            <div className="cs-ah-actions">
              <button onClick={markAllRead}>MARK ALL READ</button>
              <button className="secondary" onClick={clearAlerts}>
                CLEAR ALERTS
              </button>
            </div>
            <div className="cs-ah-list">
              {visible.length === 0 ? (
                <div className="cs-ah-empty">
                  <b>No change alerts yet.</b>
                  <span>
                    Your current scan is the baseline. Run Portfolio Pulse again
                    later; CardSignal will compare the new scan with this one.
                  </span>
                </div>
              ) : (
                visible.map((a) => (
                  <article
                    key={a.id}
                    className={`cs-ah-alert ${a.kind} ${a.read ? "read" : "unread"}`}
                  >
                    <div className="cs-ah-icon">
                      {a.kind === "buy"
                        ? "▲"
                        : a.kind === "sell"
                          ? "▼"
                          : a.kind === "resolved"
                            ? "✓"
                            : a.kind === "watch"
                              ? "!"
                              : "◎"}
                    </div>
                    <div>
                      <small>
                        {a.kind.toUpperCase()} ·{" "}
                        {new Date(a.createdAt).toLocaleString()}
                      </small>
                      <strong>{a.title}</strong>
                      <p>
                        {a.player}
                        {a.meta ? ` · ${a.meta}` : ""}
                      </p>
                      <span>{a.detail}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="cs-ah-note">
              The first observed scan for a card establishes a baseline. Later
              scans can trigger alerts for signal changes, median moves of 8% or
              more, evidence crossing the 3-match threshold, or large changes in
              accepted market-match count.
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .cs-alert-history-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1490;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 7, 12, 0.88);
          backdrop-filter: blur(15px);
        }
        .cs-alert-history-modal {
          position: relative;
          width: min(1000px, 96vw);
          max-height: 92vh;
          overflow: auto;
          padding: 30px;
          border: 1px solid rgba(78, 201, 244, 0.22);
          border-radius: 20px;
          background: linear-gradient(155deg, #081d2e, #04111d 62%, #061821);
          box-shadow: 0 44px 130px rgba(0, 0, 0, 0.78);
          color: #effaff;
        }
        .cs-ah-close {
          position: absolute;
          right: 18px;
          top: 16px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(102, 189, 224, 0.16);
          border-radius: 9px;
          background: #071724;
          color: #8cabbd;
          font-size: 24px;
          cursor: pointer;
        }
        .cs-ah-head > span {
          color: #57ddff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.17em;
        }
        .cs-ah-head h2 {
          margin: 7px 0 5px;
          font-size: 31px;
        }
        .cs-ah-head p {
          margin: 0;
          color: #7896a8;
          font-size: 11px;
        }
        .cs-ah-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 9px;
          margin: 20px 0 12px;
        }
        .cs-ah-stats > div {
          padding: 13px;
          border: 1px solid rgba(76, 188, 229, 0.12);
          border-radius: 10px;
          background: rgba(7, 25, 39, 0.72);
        }
        .cs-ah-stats small {
          display: block;
          color: #66899a;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }
        .cs-ah-stats strong {
          display: block;
          margin: 7px 0 3px;
          font-size: 20px;
        }
        .cs-ah-stats span {
          color: #648698;
          font-size: 8px;
        }
        .cs-ah-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .cs-ah-actions button {
          height: 36px;
          padding: 0 13px;
          border: 1px solid rgba(72, 241, 157, 0.3);
          border-radius: 8px;
          background: rgba(39, 202, 124, 0.08);
          color: #9affc5;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          cursor: pointer;
        }
        .cs-ah-actions .secondary {
          border-color: rgba(85, 190, 230, 0.18);
          background: #071724;
          color: #82b7cb;
        }
        .cs-ah-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .cs-ah-alert {
          display: grid;
          grid-template-columns: 38px 1fr;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(80, 188, 225, 0.1);
          border-radius: 10px;
          background: rgba(5, 20, 32, 0.72);
        }
        .cs-ah-alert.unread {
          border-left-width: 3px;
        }
        .cs-ah-alert.buy {
          border-left-color: #50e99a;
        }
        .cs-ah-alert.sell {
          border-left-color: #ff6f82;
        }
        .cs-ah-alert.watch {
          border-left-color: #e8bd63;
        }
        .cs-ah-alert.resolved {
          border-left-color: #74d8f4;
        }
        .cs-ah-alert.read {
          opacity: 0.72;
        }
        .cs-ah-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(91, 193, 229, 0.15);
          border-radius: 50%;
          color: #7bdfff;
        }
        .cs-ah-alert.buy .cs-ah-icon {
          color: #61efaa;
        }
        .cs-ah-alert.sell .cs-ah-icon {
          color: #ff8190;
        }
        .cs-ah-alert > div:last-child small,
        .cs-ah-alert > div:last-child strong,
        .cs-ah-alert > div:last-child p,
        .cs-ah-alert > div:last-child span {
          display: block;
        }
        .cs-ah-alert small {
          color: #66899a;
          font-size: 7px;
          letter-spacing: 0.07em;
        }
        .cs-ah-alert strong {
          margin-top: 4px;
          font-size: 11px;
        }
        .cs-ah-alert p {
          margin: 4px 0 0;
          color: #a7c0cc;
          font-size: 9px;
        }
        .cs-ah-alert span {
          margin-top: 4px;
          color: #7291a2;
          font-size: 9px;
        }
        .cs-ah-empty {
          padding: 34px;
          border: 1px dashed rgba(80, 188, 225, 0.15);
          border-radius: 10px;
          text-align: center;
        }
        .cs-ah-empty b,
        .cs-ah-empty span {
          display: block;
        }
        .cs-ah-empty b {
          font-size: 13px;
        }
        .cs-ah-empty span {
          max-width: 580px;
          margin: 7px auto 0;
          color: #708e9f;
          font-size: 9px;
          line-height: 1.5;
        }
        .cs-ah-note {
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid rgba(78, 183, 224, 0.1);
          color: #607f90;
          font-size: 8px;
          line-height: 1.5;
        }
        @media (max-width: 700px) {
          .cs-ah-stats {
            grid-template-columns: 1fr 1fr;
          }
          .cs-alert-history-modal {
            padding: 22px 14px;
          }
        }
      `}</style>
    </>
  );
}
