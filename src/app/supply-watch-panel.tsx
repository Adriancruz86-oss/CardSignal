"use client";
import { useMemo, useState } from "react";
import { deriveSupplyState, type SupplyEvidence } from "./supply-signal";

type Listing = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  url: string;
  condition: string;
  buyingOptions: string[];
};
type Snapshot = {
  cardId: number;
  scannedAt: string;
  provider: string;
  query: string;
  rawTotal: number;
  fetchedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  lowestAsk: number | null;
  medianAsk: number | null;
  highestAsk: number | null;
  identityConfidence?: "HIGH" | "MEDIUM" | "LOW";
  matchingVersion?: number;
  listings: Listing[];
};
type ApiResponse = Partial<Snapshot> & { ok: boolean; error?: string };
type Props = {
  cardId: number;
  player: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  soldMedian?: number | null;
  identityConfirmed?: boolean;
};
const HISTORY_KEY = "cardsignal-supply-history",
  CARD_KEY = "cardsignal-added-cards",
  MATCHING_VERSION = 2;
function readHistory(): Snapshot[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function money(v: number | null | undefined) {
  return v == null
    ? "—"
    : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function delta(now: number | null, prior: number | null) {
  return now != null && prior != null && prior !== 0
    ? ((now - prior) / prior) * 100
    : null;
}
function pct(v: number | null) {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function SupplyWatchPanel({
  cardId,
  player,
  year,
  setName,
  cardNumber,
  variant,
  soldMedian,
  identityConfirmed,
}: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const history = useMemo(
    () =>
      readHistory()
        .filter((x) => x.cardId === cardId)
        .sort((a, b) => Date.parse(b.scannedAt) - Date.parse(a.scannedAt)),
    [cardId, version],
  );
  const current = history[0] || null,
    previous =
      history.find(
        (row, index) =>
          index > 0 &&
          row.matchingVersion === MATCHING_VERSION &&
          row.identityConfidence === current?.identityConfidence,
      ) || null;
  const inventoryDelta =
      current && previous
        ? delta(current.acceptedCount, previous.acceptedCount)
        : null,
    askDelta =
      current && previous ? delta(current.medianAsk, previous.medianAsk) : null;
  const askVsSold =
    current?.medianAsk != null && soldMedian != null && soldMedian > 0
      ? ((current.medianAsk - soldMedian) / soldMedian) * 100
      : null;
  const identityConfidence: "HIGH" | "MEDIUM" | "LOW" =
    identityConfirmed && !!setName && !!cardNumber
      ? "HIGH"
      : !!setName && !!cardNumber
        ? "MEDIUM"
        : "LOW";
  const evidence: SupplyEvidence = current
    ? {
        scannedAt: current.scannedAt,
        activeAccepted: current.acceptedCount,
        rawTotal: current.rawTotal,
        lowestAsk: current.lowestAsk,
        medianAsk: current.medianAsk,
        highestAsk: current.highestAsk,
        inventoryDeltaPct: inventoryDelta,
        medianAskDeltaPct: askDelta,
        historyCount: history.length,
        identityConfidence: current.identityConfidence || identityConfidence,
      }
    : {};
  const state = deriveSupplyState(evidence);
  const scan = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const p = new URLSearchParams({
      player,
      year: year || "",
      set: setName || "",
      cardNumber: cardNumber || "",
      variant: variant || "",
    });
    try {
      const r = await fetch(`/api/supply-watch?${p}`, { cache: "no-store" }),
        j = (await r.json()) as ApiResponse;
      if (!r.ok || !j.ok) throw new Error(j.error || "Supply scan failed");
      const snap: Snapshot = {
        cardId,
        scannedAt: String(j.scannedAt || new Date().toISOString()),
        provider: String(j.provider || "eBay Browse API"),
        query: String(j.query || ""),
        rawTotal: Number(j.rawTotal || 0),
        fetchedCount: Number(j.fetchedCount || 0),
        acceptedCount: Number(j.acceptedCount || 0),
        rejectedCount: Number(j.rejectedCount || 0),
        lowestAsk: j.lowestAsk ?? null,
        medianAsk: j.medianAsk ?? null,
        highestAsk: j.highestAsk ?? null,
        identityConfidence,
        matchingVersion: MATCHING_VERSION,
        listings: Array.isArray(j.listings) ? j.listings : [],
      };
      const old =
        readHistory()
          .filter((x) => x.cardId === cardId)
          .filter(
            (x) =>
              x.matchingVersion === MATCHING_VERSION &&
              x.identityConfidence === identityConfidence,
          )
          .sort(
            (a, b) => Date.parse(b.scannedAt) - Date.parse(a.scannedAt),
          )[0] || null;
      const inv = old ? delta(snap.acceptedCount, old.acceptedCount) : null,
        ask = old ? delta(snap.medianAsk, old.medianAsk) : null;
      const all = readHistory();
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify([snap, ...all].slice(0, 1500)),
      );
      const saved = JSON.parse(localStorage.getItem(CARD_KEY) || "[]");
      if (Array.isArray(saved)) {
        const supplySnapshot: SupplyEvidence & { provider: string } = {
          scannedAt: snap.scannedAt,
          provider: snap.provider,
          activeAccepted: snap.acceptedCount,
          rawTotal: snap.rawTotal,
          lowestAsk: snap.lowestAsk,
          medianAsk: snap.medianAsk,
          highestAsk: snap.highestAsk,
          inventoryDeltaPct: inv,
          medianAskDeltaPct: ask,
          historyCount: old ? 2 : 1,
          identityConfidence,
        };
        supplySnapshot.state = deriveSupplyState(supplySnapshot);
        localStorage.setItem(
          CARD_KEY,
          JSON.stringify(
            saved.map((c: { id?: number }) =>
              c.id === cardId ? { ...c, supplySnapshot } : c,
            ),
          ),
        );
        window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
      }
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supply scan failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="cs-sw-panel">
      <div className="cs-sw-head">
        <div>
          <span>SUPPLY WATCH</span>
          <b>Active eBay asking market</b>
        </div>
        <div
          className={`cs-sw-status ${state.toLowerCase().replaceAll(" ", "-")}`}
        >
          {state}
        </div>
      </div>
      {!current ? (
        <div className="cs-sw-empty">
          <b>No active-supply snapshot yet</b>
          <span>
            Scan once to establish a baseline. Direction requires a later
            comparable scan.
          </span>
          <button onClick={scan} disabled={busy}>
            {busy ? "SCANNING…" : "SCAN ACTIVE SUPPLY"}
          </button>
        </div>
      ) : (
        <>
          <div className="cs-sw-grid">
            <div>
              <small>
                {state === "IDENTITY AMBIGUOUS"
                  ? "REFERENCE LISTINGS"
                  : "ACTIVE LISTINGS"}
              </small>
              <strong>{current.acceptedCount}</strong>
              <span>
                {current.fetchedCount} fetched · {current.rawTotal} raw
              </span>
            </div>
            <div>
              <small>LOWEST ASK</small>
              <strong>{money(current.lowestAsk)}</strong>
              <span>
                {askVsSold == null
                  ? "sold median unavailable"
                  : `${pct(askVsSold)} vs sold median`}
              </span>
            </div>
            <div>
              <small>MEDIAN ASK</small>
              <strong>{money(current.medianAsk)}</strong>
              <span>
                {previous
                  ? `${pct(askDelta)} vs prior scan`
                  : "baseline established"}
              </span>
            </div>
            <div>
              <small>HIGHEST ASK</small>
              <strong>{money(current.highestAsk)}</strong>
              <span>accepted matches only</span>
            </div>
            <div>
              <small>INVENTORY CHANGE</small>
              <strong
                className={
                  inventoryDelta != null && inventoryDelta < 0
                    ? "positive"
                    : inventoryDelta != null && inventoryDelta > 0
                      ? "negative"
                      : ""
                }
              >
                {previous ? pct(inventoryDelta) : "—"}
              </strong>
              <span>
                {previous
                  ? `${previous.acceptedCount} → ${current.acceptedCount}`
                  : "needs another scan"}
              </span>
            </div>
          </div>
          <div className="cs-sw-actions">
            <button onClick={scan} disabled={busy}>
              {busy ? "SCANNING…" : "REFRESH SUPPLY"}
            </button>
            <span>
              Last eBay scan {new Date(current.scannedAt).toLocaleString()}
            </span>
          </div>
          {identityConfidence === "LOW" && (
            <div className="cs-sw-warning">
              Identity is too broad for a directional supply signal. Confirm set
              and card number; these listings remain reference data only.
            </div>
          )}
          {current.listings.length > 0 && (
            <div className="cs-sw-list">
              <div className="cs-sw-list-title">
                {state === "IDENTITY AMBIGUOUS"
                  ? "LOWEST REFERENCE LISTINGS"
                  : "LOWEST ACCEPTED ACTIVE LISTINGS"}
              </div>
              {[...current.listings]
                .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
                .slice(0, 5)
                .map((l, i) => (
                  <div key={`${l.id}-${i}`}>
                    <div>
                      <strong>{l.title}</strong>
                      <span>
                        {l.condition || "Condition not supplied"} ·{" "}
                        {l.buyingOptions.join(" / ") || "Active listing"}
                      </span>
                    </div>
                    <b>{money(l.price)}</b>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {error && <div className="cs-sw-error">{error}</div>}
      <div className="cs-sw-note">
        Supply state is observational, not a price prediction. It uses
        identity-filtered active listings; direction requires two scans, and
        ambiguous identities do not affect the score.
      </div>
      <style jsx global>{`
        .cs-sw-panel {
          margin-top: 10px;
          padding: 15px;
          border: 1px solid rgba(77, 188, 228, 0.12);
          border-radius: 11px;
          background: rgba(5, 20, 32, 0.62);
        }
        .cs-sw-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 11px;
        }
        .cs-sw-head span {
          display: block;
          color: #55dfff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }
        .cs-sw-head b {
          display: block;
          margin-top: 3px;
          color: #8ca8b7;
          font-size: 8px;
        }
        .cs-sw-status {
          padding: 6px 9px;
          border: 1px solid rgba(85, 215, 242, 0.2);
          border-radius: 7px;
          color: #7fdcf4;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-sw-status.supply-tightening {
          color: #64efaa;
          border-color: rgba(73, 238, 157, 0.3);
        }
        .cs-sw-status.supply-rising {
          color: #ff8494;
          border-color: rgba(255, 105, 125, 0.3);
        }
        .cs-sw-status.identity-ambiguous {
          color: #efc86e;
        }
        .cs-sw-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }
        .cs-sw-grid > div {
          padding: 11px;
          border: 1px solid rgba(77, 188, 228, 0.1);
          border-radius: 9px;
          background: rgba(7, 25, 39, 0.7);
        }
        .cs-sw-grid small {
          display: block;
          color: #668899;
          font-size: 6px;
          font-weight: 900;
        }
        .cs-sw-grid strong {
          display: block;
          margin: 5px 0 3px;
          font-size: 18px;
        }
        .cs-sw-grid span,
        .cs-sw-actions span {
          color: #688797;
          font-size: 7px;
        }
        .cs-sw-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
        }
        .cs-sw-actions button,
        .cs-sw-empty button {
          height: 35px;
          padding: 0 13px;
          border: 1px solid rgba(66, 239, 154, 0.38);
          border-radius: 8px;
          background: rgba(43, 194, 122, 0.1);
          color: #9affc5;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
        }
        .cs-sw-empty {
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 18px;
          border: 1px dashed rgba(77, 188, 228, 0.13);
          border-radius: 9px;
        }
        .cs-sw-empty span {
          max-width: 520px;
          margin: 5px 0 11px;
          color: #688797;
          font-size: 8px;
        }
        .cs-sw-list {
          margin-top: 11px;
          border-top: 1px solid rgba(78, 183, 224, 0.08);
          padding-top: 8px;
        }
        .cs-sw-list-title {
          color: #66899a;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-sw-list > div:not(.cs-sw-list-title) {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 7px 2px;
          border-top: 1px solid rgba(78, 183, 224, 0.06);
        }
        .cs-sw-list strong,
        .cs-sw-list span {
          display: block;
        }
        .cs-sw-list strong {
          font-size: 8px;
        }
        .cs-sw-list span {
          color: #668797;
          font-size: 6px;
        }
        .cs-sw-warning,
        .cs-sw-error {
          margin-top: 10px;
          padding: 9px;
          border: 1px solid rgba(239, 200, 110, 0.25);
          border-radius: 8px;
          color: #efc86e;
          font-size: 8px;
        }
        .cs-sw-error {
          border-color: rgba(255, 100, 120, 0.25);
          color: #ff9cab;
        }
        .cs-sw-note {
          margin-top: 10px;
          color: #5f7d8e;
          font-size: 7px;
        }
        .positive {
          color: #5eeaa0 !important;
        }
        .negative {
          color: #ff7b8b !important;
        }
        @media (max-width: 900px) {
          .cs-sw-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </article>
  );
}
