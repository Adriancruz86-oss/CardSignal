"use client";

import { useEffect, useMemo, useState } from "react";
import SupplyWatchPanel from "./supply-watch-panel";
import { effectivePulse, type SupplyEvidence } from "./supply-signal";
import { getCardSignalScore } from "./card-signal-score";

type Pulse =
  "BUY MORE" | "HOLD" | "WATCH CLOSELY" | "SELL RISK" | "NOT ENOUGH DATA";
type Sale = {
  source: string;
  id: string;
  title: string;
  price: number | null;
  date: string;
  marketplace: string;
};
type Scan = {
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
  pulse: Pulse;
  confidence: string;
  elapsedMs: number;
  acceptedSales?: Sale[];
};
type Identity = {
  playerName?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variation?: string;
  cardId?: string;
};
type Card = {
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
  marketValue?: number;
  purchasePrice?: number;
  image?: string;
  catalogConfirmed?: boolean;
  canonicalIdentity?: Identity;
  marketScan?: Scan;
  supplySnapshot?: SupplyEvidence;
  valuationStatus?: "NO_MATCH" | "UNREVIEWED" | "APPROVED";
};
type Snapshot = {
  id: string;
  cardId: number;
  player: string;
  meta: string;
  scannedAt: string;
  acceptedCount: number;
  currentMedian: number | null;
  change7d: number | null;
  velocity: number | null;
  pulse: Pulse;
  confidence: string;
};
type Alert = {
  id: string;
  cardId: number;
  createdAt: string;
  kind: string;
  title: string;
  detail: string;
};
type DetailTab = "overview" | "market" | "history" | "research";
type IdentityDraft = {
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  variant: string;
  grader: string;
  grade: string;
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
  pulse?: Pulse;
  confidence?: string;
  acceptedSales?: Sale[];
  matchingVersion?: number;
};

const CARD_KEY = "cardsignal-added-cards",
  HISTORY_KEY = "cardsignal-scan-history",
  ALERTS_KEY = "cardsignal-alerts";
function read<T>(k: string, f: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "");
    return (v ?? f) as T;
  } catch {
    return f;
  }
}
function cards() {
  const v = read<Card[]>(CARD_KEY, []);
  return Array.isArray(v) ? v : [];
}
function money(v: number | null | undefined) {
  return v == null
    ? "—"
    : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function initials(v: string) {
  return v
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function norm(v?: string) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function resolvedIdentity(card: Card) {
  const canonical = card.canonicalIdentity || {};
  const parts = String(card.meta || "")
    .split("·")
    .map((part) => part.trim());
  const metaYear = parts.find((part) =>
    /^(?:19|20)\d{2}(?:-\d{2})?$/.test(part),
  );
  const metaNumber = parts.find((part) => /^#[a-z0-9-]+$/i.test(part));
  const metaSet = parts.find(
    (part) =>
      part !== metaYear &&
      part !== metaNumber &&
      !/^(raw|psa|bgs|sgc|cgc)\b/i.test(part),
  );
  const metaGrade = String(card.meta || "").match(
    /\b(PSA|BGS|SGC|CGC)\s*([0-9.]+)/i,
  );
  const isRaw = parts.some((part) => /^raw$/i.test(part));
  return {
    playerName: canonical.playerName || card.player,
    year: canonical.year || card.year || metaYear || "",
    setName: canonical.setName || card.setName || metaSet || "",
    cardNumber:
      canonical.cardNumber || card.cardNumber || metaNumber?.slice(1) || "",
    variation: canonical.variation || card.variant || "",
    grader: card.gradingCompany || (isRaw ? "Raw" : metaGrade?.[1] || ""),
    grade: card.grade || metaGrade?.[2] || "",
  };
}
function tone(p?: Pulse) {
  return p === "BUY MORE"
    ? "buy"
    : p === "SELL RISK"
      ? "sell"
      : p === "WATCH CLOSELY"
        ? "watch"
        : "hold";
}
function findCard(row: HTMLElement) {
  const all = cards(),
    id = Number(
      row.dataset.userCardId ||
        row.closest<HTMLElement>("[data-user-card-id]")?.dataset.userCardId ||
        0,
    );
  if (id) {
    const c = all.find((x) => x.id === id);
    if (c) return c;
  }
  const player =
      row
        .querySelector<HTMLElement>(".signal-copy strong")
        ?.textContent?.trim() ||
      row.querySelector<HTMLElement>("strong")?.textContent?.trim() ||
      "",
    meta =
      row
        .querySelector<HTMLElement>(".signal-copy span")
        ?.textContent?.trim() || "";
  if (!player) return null;
  const exact = all.filter(
    (c) =>
      norm(c.player) === norm(player) && (!meta || norm(c.meta) === norm(meta)),
  );
  if (exact.length === 1) return exact[0];
  const same = all.filter((c) => norm(c.player) === norm(player));
  return same.length === 1 ? same[0] : null;
}

function HistoryChart({ points }: { points: Snapshot[] }) {
  const p = points
    .filter((x) => x.currentMedian != null)
    .sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));
  if (p.length < 2)
    return (
      <div className="cs-md-empty">
        <b>History is just starting</b>
        <span>
          Repeated exact-card scans will build the price line. No synthetic
          points are drawn.
        </span>
      </div>
    );
  const vals = p.map((x) => x.currentMedian as number),
    min = Math.min(...vals),
    max = Math.max(...vals),
    range = Math.max(1, max - min),
    poly = p
      .map(
        (x, i) =>
          `${18 + (i / (p.length - 1)) * 560},${145 - ((x.currentMedian! - min) / range) * 108}`,
      )
      .join(" ");
  return (
    <div className="cs-md-chart">
      <span>{money(max)}</span>
      <svg viewBox="0 0 600 165" preserveAspectRatio="none">
        <polyline
          points={poly}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div>
        <small>{new Date(p[0].scannedAt).toLocaleDateString()}</small>
        <small>{p.length} saved scans</small>
        <small>{new Date(p.at(-1)!.scannedAt).toLocaleDateString()}</small>
      </div>
    </div>
  );
}

export default function CardDetailLayer() {
  const [card, setCard] = useState<Card | null>(null),
    [scanning, setScanning] = useState(false),
    [tab, setTab] = useState<DetailTab>("overview"),
    [identityDraft, setIdentityDraft] = useState<IdentityDraft | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".cs-detail-modal,.cs-modal,.cs-pulse-modal")) return;
      const row = target.closest<HTMLElement>(".signal-row,.cs-pulse-row");
      if (!row) return;
      const c = findCard(row);
      if (c) {
        setCard(c);
        setTab("overview");
        setIdentityDraft(null);
        setError("");
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const id = Number(
          (event as CustomEvent<{ cardId?: number }>).detail?.cardId || 0,
        ),
        c = cards().find((x) => x.id === id);
      if (c) {
        setCard(c);
        setTab("overview");
        setIdentityDraft(null);
        setError("");
      }
    };
    window.addEventListener("cardsignal:open-card-detail", open);
    return () =>
      window.removeEventListener("cardsignal:open-card-detail", open);
  }, []);
  useEffect(() => {
    if (!card) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setCard(null),
      refresh = () => {
        const next = cards().find((c) => c.id === card.id);
        if (next) setCard(next);
      };
    window.addEventListener("keydown", key);
    window.addEventListener("cardsignal:user-cards-changed", refresh);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("cardsignal:user-cards-changed", refresh);
    };
  }, [card?.id]);
  useEffect(() => {
    document.body.classList.toggle(
      "cs-detail-advanced",
      Boolean(card && tab === "research"),
    );
    return () => document.body.classList.remove("cs-detail-advanced");
  }, [card, tab]);
  const history = useMemo(
    () =>
      card
        ? read<Snapshot[]>(HISTORY_KEY, []).filter((x) => x.cardId === card.id)
        : [],
    [card],
  );
  const alerts = useMemo(
    () =>
      card
        ? read<Alert[]>(ALERTS_KEY, [])
            .filter((x) => x.cardId === card.id)
            .slice(0, 8)
        : [],
    [card],
  );
  const previous = useMemo(
    () =>
      card?.marketScan
        ? history
            .filter((x) => x.scannedAt !== card.marketScan?.scannedAt)
            .sort(
              (a, b) => Date.parse(b.scannedAt) - Date.parse(a.scannedAt),
            )[0] || null
        : null,
    [card, history],
  );
  const rescan = async () => {
    if (!card || scanning) return;
    setScanning(true);
    setError("");
    const id = resolvedIdentity(card),
      p = new URLSearchParams({
        player: id.playerName || card.player,
        year: id.year || card.year || "",
        set: id.setName || card.setName || "",
        cardNumber: id.cardNumber || card.cardNumber || "",
        variant: id.variation || card.variant || "",
        grader: id.grader || "",
        grade: id.grade || "",
      });
    try {
      const r = await fetch(`/api/portfolio-scan?${p}`, { cache: "no-store" }),
        j = (await r.json()) as ScanResponse;
      if (!r.ok || !j.ok) throw new Error(j.error || "Card scan failed");
      const scan: Scan = {
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
        acceptedSales: Array.isArray(j.acceptedSales) ? j.acceptedSales : [],
      };
      const next = cards().map((c) => {
        if (c.id !== card.id) return c;
        const updated = {
          ...c,
          marketScan: scan,
          marketValue: c.marketValue || 0,
          valuationStatus:
            scan.currentMedian == null
              ? ("NO_MATCH" as const)
              : ("UNREVIEWED" as const),
        };
        return { ...updated, score: getCardSignalScore(updated).score };
      });
      localStorage.setItem(CARD_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
      setCard(next.find((c) => c.id === card.id) || card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Card scan failed");
    } finally {
      setScanning(false);
    }
  };
  const approveValuation = () => {
    if (
      !card?.marketScan?.currentMedian ||
      card.marketScan.matchingVersion !== 3
    )
      return;
    const next = cards().map((c) =>
      c.id === card.id
        ? {
            ...c,
            marketValue: card.marketScan!.currentMedian!,
            valuationStatus: "APPROVED" as const,
          }
        : c,
    );
    localStorage.setItem(CARD_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
    setCard(next.find((c) => c.id === card.id) || card);
  };
  const beginIdentityEdit = () => {
    if (!card) return;
    const current = resolvedIdentity(card);
    setIdentityDraft({
      player: current.playerName || card.player,
      year: current.year || "",
      setName: current.setName || "",
      cardNumber: current.cardNumber || "",
      variant: current.variation || "",
      grader: current.grader || "Raw",
      grade: current.grade || "",
    });
    setTab("overview");
  };
  const saveIdentity = () => {
    if (!card || !identityDraft) return;
    const draft = {
      ...identityDraft,
      player: identityDraft.player.trim(),
      year: identityDraft.year.trim(),
      setName: identityDraft.setName.trim(),
      cardNumber: identityDraft.cardNumber.trim().replace(/^#/, ""),
      variant: identityDraft.variant.trim(),
      grader: identityDraft.grader.trim() || "Raw",
      grade: identityDraft.grader === "Raw" ? "" : identityDraft.grade.trim(),
    };
    if (!draft.player || !draft.year || !draft.setName || !draft.cardNumber) {
      setError(
        "Player, year, set, and card number are required for an exact identity.",
      );
      return;
    }
    if (draft.grader !== "Raw" && !draft.grade) {
      setError("Enter the exact grade, or select Raw.");
      return;
    }
    const meta = [
      draft.year,
      draft.setName,
      `#${draft.cardNumber}`,
      draft.variant,
      draft.grader === "Raw" ? "Raw" : `${draft.grader} ${draft.grade}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const next = cards().map((c) =>
      c.id === card.id
        ? {
            ...c,
            player: draft.player,
            year: draft.year,
            setName: draft.setName,
            cardNumber: draft.cardNumber,
            variant: draft.variant,
            gradingCompany: draft.grader,
            grade: draft.grade,
            meta,
            canonicalIdentity: {
              playerName: draft.player,
              year: draft.year,
              setName: draft.setName,
              cardNumber: draft.cardNumber,
              variation: draft.variant,
            },
            catalogConfirmed: false,
            marketScan: undefined,
            supplySnapshot: undefined,
            marketValue: 0,
            valuationStatus: "NO_MATCH" as const,
            score: 0,
          }
        : c,
    );
    localStorage.setItem(CARD_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
    setCard(next.find((c) => c.id === card.id) || card);
    setIdentityDraft(null);
    setError("");
  };
  if (!card) return null;
  const s = card.marketScan,
    pulse = effectivePulse(s?.pulse, s?.change7d, card.supplySnapshot),
    t = tone(pulse),
    cardHistory = [...history];
  if (s && !cardHistory.some((x) => x.scannedAt === s.scannedAt))
    cardHistory.push({
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
    });
  const sales = s?.acceptedSales || [],
    id = resolvedIdentity(card);
  return (
    <div
      className="cs-detail-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && setCard(null)}
    >
      <section className="cs-detail-modal" data-user-card-id={card.id}>
        <button className="cs-detail-close" onClick={() => setCard(null)}>
          ×
        </button>
        <div className="cs-detail-head">
          <div>
            <span>CARD MARKET TERMINAL</span>
            <h2>{card.player}</h2>
            <p>
              {card.meta ||
                [
                  card.year,
                  card.setName,
                  card.cardNumber && `#${card.cardNumber}`,
                  card.variant,
                ]
                  .filter(Boolean)
                  .join(" · ")}
            </p>
          </div>
          <div className="cs-detail-head-actions">
            <button onClick={beginIdentityEdit}>EDIT IDENTITY</button>
            <b className={t}>{pulse}</b>
          </div>
        </div>
        <nav className="cs-detail-tabs" aria-label="Card detail sections">
          {(["overview", "market", "history", "research"] as DetailTab[]).map(
            (value) => (
              <button
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {value.toUpperCase()}
              </button>
            ),
          )}
        </nav>
        {tab === "overview" && (
          <>
            <div className="cs-md-top">
              <div className="cs-detail-cardart">
                {card.image ? (
                  <img src={card.image} alt={card.player} />
                ) : (
                  <div className="cs-css-card">
                    <small>{card.year || "CARD"}</small>
                    <strong>{initials(card.player)}</strong>
                    <span>{card.setName || "SAVED CARD"}</span>
                    <em>
                      {card.cardNumber ? `#${card.cardNumber}` : "EXACT ID"}
                    </em>
                  </div>
                )}
              </div>
              <div className="cs-md-stats">
                <div>
                  <small>CURRENT MEDIAN</small>
                  <strong>
                    {money(s ? s.currentMedian : card.marketValue)}
                  </strong>
                  <span>
                    {s
                      ? s.acceptedCount
                        ? `${s.acceptedCount} accepted matches`
                        : "No current accepted matches"
                      : "No current scan"}
                  </span>
                </div>
                <div>
                  <small>7D MOVEMENT</small>
                  <strong
                    className={(s?.change7d ?? 0) < 0 ? "negative" : "positive"}
                  >
                    {pct(s?.change7d)}
                  </strong>
                  <span>
                    {s?.change7d == null
                      ? "Needs dated sales in both windows"
                      : "recent vs prior median"}
                  </span>
                </div>
                <div>
                  <small>PRIOR SCAN</small>
                  <strong>{money(previous?.currentMedian)}</strong>
                  <span>
                    {previous
                      ? new Date(previous.scannedAt).toLocaleString()
                      : "No prior scan"}
                  </span>
                </div>
                <div>
                  <small>SALES VELOCITY</small>
                  <strong>{s?.velocity ?? "—"}</strong>
                  <span>
                    {s ? `${s.recentSales} accepted sales / 7D` : "Not scanned"}
                  </span>
                </div>
              </div>
            </div>
            <div className="cs-md-evidence">
              <div>
                <small>CONFIDENCE</small>
                <b>{s?.confidence || "NO SCAN"}</b>
              </div>
              <div>
                <small>ACCEPTED / REJECTED</small>
                <b>{s ? `${s.acceptedCount} / ${s.rejectedCount}` : "—"}</b>
              </div>
              <div>
                <small>LAST SCAN</small>
                <b>{s ? new Date(s.scannedAt).toLocaleString() : "Never"}</b>
              </div>
              <button onClick={rescan} disabled={scanning}>
                {scanning ? "SCANNING…" : "RESCAN CARD"}
              </button>
              {s?.matchingVersion === 3 &&
                s.currentMedian != null &&
                card.valuationStatus !== "APPROVED" && (
                  <button className="approve" onClick={approveValuation}>
                    APPLY VALUE
                  </button>
                )}
            </div>
            {identityDraft && (
              <section className="cs-identity-editor">
                <header>
                  <div>
                    <span>EDIT EXACT IDENTITY</span>
                    <b>
                      Changing identity clears old market evidence and
                      valuation.
                    </b>
                  </div>
                  <button onClick={() => setIdentityDraft(null)}>CANCEL</button>
                </header>
                <div>
                  <label>
                    <span>PLAYER / CARD NAME</span>
                    <input
                      value={identityDraft.player}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          player: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>YEAR</span>
                    <input
                      value={identityDraft.year}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          year: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>SET</span>
                    <input
                      value={identityDraft.setName}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          setName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>CARD #</span>
                    <input
                      value={identityDraft.cardNumber}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          cardNumber: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>VARIANT / PARALLEL</span>
                    <input
                      value={identityDraft.variant}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          variant: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>CONDITION</span>
                    <select
                      value={identityDraft.grader}
                      onChange={(e) =>
                        setIdentityDraft({
                          ...identityDraft,
                          grader: e.target.value,
                          grade:
                            e.target.value === "Raw" ? "" : identityDraft.grade,
                        })
                      }
                    >
                      <option>Raw</option>
                      <option>PSA</option>
                      <option>BGS</option>
                      <option>SGC</option>
                      <option>CGC</option>
                    </select>
                  </label>
                  {identityDraft.grader !== "Raw" && (
                    <label>
                      <span>GRADE</span>
                      <input
                        value={identityDraft.grade}
                        onChange={(e) =>
                          setIdentityDraft({
                            ...identityDraft,
                            grade: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
                <button className="save" onClick={saveIdentity}>
                  SAVE IDENTITY & CLEAR OLD EVIDENCE
                </button>
              </section>
            )}
          </>
        )}
        {error && <div className="cs-md-error">{error}</div>}
        {tab === "history" && (
          <div className="cs-md-columns">
            <article className="cs-md-panel">
              <header>
                <span>PRICE HISTORY</span>
                <b>Saved exact-card scans</b>
              </header>
              <HistoryChart points={cardHistory} />
            </article>
            <article className="cs-md-panel">
              <header>
                <span>CHANGE TIMELINE</span>
                <b>Material alerts</b>
              </header>
              {alerts.length ? (
                <div className="cs-md-timeline">
                  {alerts.map((a) => (
                    <div key={a.id}>
                      <i>
                        {a.kind === "sell" ? "▼" : a.kind === "buy" ? "▲" : "•"}
                      </i>
                      <p>
                        <small>{new Date(a.createdAt).toLocaleString()}</small>
                        <strong>{a.title}</strong>
                        <span>{a.detail}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cs-md-empty compact">
                  <b>No material changes yet</b>
                  <span>Repeated scans will populate this timeline.</span>
                </div>
              )}
            </article>
          </div>
        )}
        {tab === "market" && (
          <>
            <SupplyWatchPanel
              cardId={card.id}
              player={id.playerName || card.player}
              year={id.year || card.year}
              setName={id.setName || card.setName}
              cardNumber={id.cardNumber || card.cardNumber}
              variant={id.variation || card.variant}
              grader={id.grader}
              grade={id.grade}
              soldMedian={s?.currentMedian ?? null}
              identityConfirmed={card.catalogConfirmed}
            />
            <article className="cs-md-panel cs-md-sales">
              <header>
                <span>ACCEPTED MARKET MATCHES</span>
                <b>
                  {sales.length
                    ? `${sales.length} stored from latest scan`
                    : "Rescan to attach sale rows"}
                </b>
              </header>
              {sales.length ? (
                <div className="cs-md-sales-list">
                  {sales.slice(0, 8).map((sale, i) => (
                    <div key={`${sale.source}-${sale.id}-${i}`}>
                      <p>
                        <strong>{sale.title}</strong>
                        <span>
                          {sale.source} · {sale.marketplace}
                          {sale.date
                            ? ` · ${new Date(sale.date).toLocaleDateString()}`
                            : ""}
                        </span>
                      </p>
                      <b>{money(sale.price)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cs-md-empty compact">
                  <b>No stored sale rows yet</b>
                  <span>CardSignal does not invent evidence.</span>
                </div>
              )}
            </article>
          </>
        )}
        {tab === "research" && (
          <div className="cs-md-research-intro">
            <b>Advanced research</b>
            <span>
              Catalysts, grading population, league context, and performance
              baselines are separated from the core valuation because their
              predictive value is still being validated.
            </span>
          </div>
        )}
        <footer>
          Charts and evidence use only saved scans and accepted identity-matched
          market rows.
        </footer>
      </section>
      <style jsx global>{`
        .cs-detail-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1510;
          display: grid;
          place-items: center;
          padding: 22px;
          background: rgba(0, 7, 12, 0.9);
          backdrop-filter: blur(15px);
        }
        .cs-detail-modal {
          position: relative;
          width: min(1080px, 97vw);
          max-height: 94vh;
          overflow: auto;
          padding: 28px;
          border: 1px solid rgba(73, 205, 255, 0.2);
          border-radius: 18px;
          background: linear-gradient(155deg, #081d2e, #04111d 62%, #061821);
          box-shadow: 0 44px 130px rgba(0, 0, 0, 0.72);
          color: #effaff;
        }
        .cs-detail-modal:before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 260px;
          height: 2px;
          background: linear-gradient(90deg, #48f19c, transparent);
        }
        .cs-detail-close {
          position: absolute;
          right: 17px;
          top: 14px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(102, 189, 224, 0.16);
          border-radius: 8px;
          background: #071724;
          color: #8cabbd;
          font-size: 24px;
        }
        .cs-detail-head {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-right: 45px;
        }
        .cs-detail-head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cs-detail-head-actions > button {
          height: 31px;
          padding: 0 9px;
          border: 1px solid rgba(83, 205, 245, 0.18);
          border-radius: 7px;
          background: #071724;
          color: #8fcde0;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-detail-head-actions > b {
          padding: 7px 10px;
          border: 1px solid rgba(83, 205, 245, 0.24);
          border-radius: 7px;
          color: #82dff7;
          font-size: 8px;
        }
        .cs-detail-tabs {
          display: flex;
          gap: 5px;
          margin: 18px 0 4px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(77, 188, 228, 0.1);
        }
        .cs-detail-tabs button {
          height: 32px;
          padding: 0 12px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: #6f8d9d;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .cs-detail-tabs button.active {
          border-color: rgba(83, 205, 245, 0.2);
          background: rgba(24, 86, 110, 0.16);
          color: #9ae8ff;
        }
        .cs-detail-head > div > span {
          color: #55dfff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }
        .cs-detail-head h2 {
          margin: 6px 0 4px;
          font-size: 28px;
        }
        .cs-detail-head p {
          margin: 0;
          color: #7f9cac;
          font-size: 10px;
        }
        .cs-detail-head > b {
          align-self: center;
          padding: 7px 10px;
          border: 1px solid rgba(83, 205, 245, 0.24);
          border-radius: 7px;
          color: #82dff7;
          font-size: 8px;
        }
        .cs-detail-head > b.buy {
          color: #6af0a9;
          border-color: rgba(70, 239, 154, 0.3);
        }
        .cs-detail-head > b.sell {
          color: #ff8493;
          border-color: rgba(255, 104, 124, 0.3);
        }
        .cs-detail-head > b.watch {
          color: #efc86e;
        }
        .cs-md-top {
          display: grid;
          grid-template-columns: 190px 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        .cs-detail-cardart {
          height: 225px;
          display: grid;
          place-items: center;
        }
        .cs-detail-cardart > img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 10px;
        }
        .cs-css-card {
          width: 150px;
          aspect-ratio: 2.5/3.5;
          padding: 10px;
          display: grid;
          grid-template-rows: auto 1fr auto auto;
          align-items: center;
          border: 2px solid rgba(218, 239, 248, 0.6);
          border-radius: 12px;
          background: linear-gradient(
            160deg,
            #dbe8ed 0 10%,
            #0b1924 11%,
            #12344a 74%,
            #07141d
          );
          box-shadow:
            0 18px 35px rgba(0, 0, 0, 0.4),
            0 0 25px rgba(70, 216, 255, 0.1);
        }
        .cs-css-card small {
          color: #182630;
          background: #e7eff3;
          padding: 4px 6px;
          border-radius: 3px;
          font-size: 7px;
        }
        .cs-css-card strong {
          font-size: 40px;
          text-align: center;
          color: #dff6ff;
          text-shadow: 0 0 20px rgba(74, 214, 255, 0.25);
        }
        .cs-css-card span,
        .cs-css-card em {
          display: block;
          text-align: center;
          font-style: normal;
        }
        .cs-css-card span {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .cs-css-card em {
          margin-top: 3px;
          color: #6aa9c2;
          font-size: 6px;
        }
        .cs-md-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .cs-md-stats > div,
        .cs-md-evidence > div {
          padding: 12px;
          border: 1px solid rgba(77, 188, 228, 0.11);
          border-radius: 9px;
          background: rgba(7, 25, 39, 0.68);
        }
        .cs-md-stats small,
        .cs-md-evidence small {
          display: block;
          color: #67899b;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }
        .cs-md-stats strong {
          display: block;
          margin: 6px 0 3px;
          font-size: 21px;
        }
        .cs-md-stats span {
          color: #668797;
          font-size: 7px;
        }
        .cs-md-evidence {
          display: grid;
          grid-template-columns: 1fr 1fr 1.3fr auto auto;
          gap: 8px;
          margin-bottom: 13px;
        }
        .cs-md-evidence b {
          display: block;
          margin-top: 5px;
          font-size: 9px;
        }
        .cs-md-evidence button {
          padding: 0 14px;
          border: 1px solid rgba(66, 239, 154, 0.35);
          border-radius: 8px;
          background: rgba(43, 194, 122, 0.08);
          color: #9affc5;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-md-evidence button.approve {
          border-color: rgba(85, 218, 255, 0.35);
          background: rgba(44, 173, 216, 0.08);
          color: #8ee8ff;
        }
        .cs-identity-editor {
          margin: 10px 0 14px;
          padding: 14px;
          border: 1px solid rgba(239, 200, 110, 0.25);
          border-radius: 10px;
          background: rgba(38, 31, 12, 0.18);
        }
        .cs-identity-editor header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }
        .cs-identity-editor header span,
        .cs-identity-editor header b {
          display: block;
        }
        .cs-identity-editor header span {
          color: #efc86e;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }
        .cs-identity-editor header b {
          margin-top: 3px;
          color: #8d8a73;
          font-size: 7px;
        }
        .cs-identity-editor header button {
          border: 0;
          background: transparent;
          color: #8198a5;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-identity-editor > div {
          display: grid;
          grid-template-columns: 2fr 1fr 2fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        .cs-identity-editor label span {
          display: block;
          margin-bottom: 4px;
          color: #708c9a;
          font-size: 6px;
          font-weight: 900;
        }
        .cs-identity-editor input,
        .cs-identity-editor select {
          width: 100%;
          height: 36px;
          padding: 0 9px;
          border: 1px solid rgba(89, 183, 220, 0.14);
          border-radius: 7px;
          background: #061621;
          color: #e5f6fc;
        }
        .cs-identity-editor .save {
          width: 100%;
          height: 38px;
          margin-top: 10px;
          border: 1px solid rgba(239, 200, 110, 0.28);
          border-radius: 7px;
          background: rgba(174, 135, 40, 0.08);
          color: #efcf7e;
          font-size: 7px;
          font-weight: 900;
        }
        .cs-md-research-intro {
          margin: 14px 0;
          padding: 16px;
          border: 1px solid rgba(113, 153, 190, 0.13);
          border-radius: 9px;
          background: rgba(6, 20, 31, 0.58);
        }
        .cs-md-research-intro b,
        .cs-md-research-intro span {
          display: block;
        }
        .cs-md-research-intro b {
          font-size: 12px;
        }
        .cs-md-research-intro span {
          margin-top: 5px;
          color: #728d9b;
          font-size: 8px;
          line-height: 1.5;
        }
        .cs-md-advanced-toggle {
          width: 100%;
          margin-top: 10px;
          padding: 12px;
          border: 1px solid rgba(101, 145, 180, 0.18);
          border-radius: 8px;
          background: rgba(8, 23, 35, 0.7);
          color: #8ca8b7;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        body:not(.cs-detail-advanced) .cs-detail-catalysts,
        body:not(.cs-detail-advanced) .cs-mctx,
        body:not(.cs-detail-advanced) .cs-gp-panel,
        body:not(.cs-detail-advanced) .cs-league-editor,
        body:not(.cs-detail-advanced) .cs-perf-panel {
          display: none !important;
        }
        .cs-md-error {
          margin-bottom: 10px;
          padding: 9px;
          border: 1px solid rgba(255, 100, 120, 0.25);
          border-radius: 7px;
          color: #ff9cab;
        }
        .cs-md-columns {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 9px;
        }
        .cs-md-panel {
          padding: 14px;
          border: 1px solid rgba(77, 188, 228, 0.11);
          border-radius: 10px;
          background: rgba(5, 20, 32, 0.58);
        }
        .cs-md-panel > header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 9px;
        }
        .cs-md-panel > header span {
          color: #55dfff;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 0.11em;
        }
        .cs-md-panel > header b {
          color: #8ca8b7;
          font-size: 7px;
          font-weight: 600;
        }
        .cs-md-chart {
          height: 185px;
          position: relative;
          color: #55efa2;
        }
        .cs-md-chart > span {
          color: #6f8d9d;
          font-size: 7px;
        }
        .cs-md-chart svg {
          width: 100%;
          height: 145px;
        }
        .cs-md-chart > div {
          display: flex;
          justify-content: space-between;
          color: #668494;
        }
        .cs-md-empty {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 18px;
          border: 1px dashed rgba(77, 188, 228, 0.12);
          border-radius: 8px;
        }
        .cs-md-empty.compact {
          min-height: 85px;
        }
        .cs-md-empty span {
          margin-top: 5px;
          color: #688797;
          font-size: 7px;
        }
        .cs-md-timeline {
          max-height: 180px;
          overflow: auto;
        }
        .cs-md-timeline > div {
          display: grid;
          grid-template-columns: 25px 1fr;
          gap: 7px;
          padding: 7px;
          border-top: 1px solid rgba(78, 183, 224, 0.07);
        }
        .cs-md-timeline i {
          font-style: normal;
          color: #73dff7;
        }
        .cs-md-timeline p {
          margin: 0;
        }
        .cs-md-timeline small,
        .cs-md-timeline strong,
        .cs-md-timeline span {
          display: block;
        }
        .cs-md-timeline small {
          color: #607f90;
          font-size: 6px;
        }
        .cs-md-timeline strong {
          margin-top: 2px;
          font-size: 8px;
        }
        .cs-md-timeline span {
          margin-top: 2px;
          color: #7592a2;
          font-size: 7px;
        }
        .cs-md-sales {
          margin-top: 9px;
        }
        .cs-md-sales-list > div {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 8px 2px;
          border-top: 1px solid rgba(78, 183, 224, 0.07);
        }
        .cs-md-sales-list p {
          margin: 0;
        }
        .cs-md-sales-list strong,
        .cs-md-sales-list span {
          display: block;
        }
        .cs-md-sales-list strong {
          font-size: 8px;
        }
        .cs-md-sales-list span {
          margin-top: 2px;
          color: #688797;
          font-size: 7px;
        }
        .cs-detail-modal > footer {
          margin-top: 10px;
          text-align: center;
          color: #5f7d8e;
          font-size: 7px;
        }
        .positive {
          color: #5eeaa0 !important;
        }
        .negative {
          color: #ff7b8b !important;
        }
        @media (max-width: 760px) {
          .cs-detail-head {
            align-items: flex-start;
          }
          .cs-detail-head-actions {
            align-items: flex-end;
            flex-direction: column;
          }
          .cs-detail-tabs {
            overflow-x: auto;
          }
          .cs-detail-tabs button {
            flex: 0 0 auto;
          }
          .cs-identity-editor > div {
            grid-template-columns: 1fr 1fr;
          }
          .cs-md-top,
          .cs-md-columns {
            grid-template-columns: 1fr;
          }
          .cs-md-evidence {
            grid-template-columns: 1fr 1fr;
          }
          .cs-md-evidence button {
            height: 40px;
            grid-column: 1/-1;
          }
          .cs-md-stats {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
