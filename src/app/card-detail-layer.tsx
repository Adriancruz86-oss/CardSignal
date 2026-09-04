"use client";

import { useEffect, useMemo, useState } from "react";

type DetailCard = {
  key: string;
  player: string;
  meta: string;
  score: number;
  move: number;
  marketValue: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  confidence: "HIGH" | "MEDIUM";
  lastScan: string;
  scanCount: number;
};

type PersistedMap = Record<string, Partial<DetailCard>>;

const detailSteps = [
  "Refreshing recent sales",
  "Rechecking active listings",
  "Measuring demand shift",
  "Recalculating momentum",
];

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function recommendationFor(score: number): DetailCard["recommendation"] {
  return score >= 75 ? "BUY" : score <= 55 ? "SELL" : "HOLD";
}

function confidenceFor(score: number): DetailCard["confidence"] {
  return score >= 82 || score <= 50 ? "HIGH" : "MEDIUM";
}

function marketFor(player: string, meta: string) {
  const seed = hashText(`${player}|${meta}`);
  return Math.round((48 + (seed % 430) + ((seed >> 4) % 100) / 100) * 100) / 100;
}

function parseMove(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildBreakdown(card: DetailCard) {
  const seed = hashText(`${card.key}|${card.scanCount}`);
  const clamp = (value: number) => Math.max(32, Math.min(96, value));
  return [
    ["Price momentum", clamp(card.score + ((seed % 11) - 5))],
    ["Sales velocity", clamp(card.score - 3 + (((seed >> 3) % 17) - 8))],
    ["Supply pressure", clamp(100 - Math.abs(68 - card.score) + (((seed >> 6) % 9) - 4))],
    ["Market interest", clamp(card.score + 4 + (((seed >> 9) % 13) - 6))],
  ] as const;
}

function insightFor(card: DetailCard) {
  if (card.recommendation === "BUY") return "Sales velocity is improving while supply remains controlled. The card is showing confirmed upward pressure rather than a single isolated sale.";
  if (card.recommendation === "SELL") return "Supply is outrunning demand and the latest price action is weakening. CardSignal is flagging elevated downside risk until buyers absorb the excess inventory.";
  return "Price, inventory, and demand are relatively balanced. The card is moving, but there is not enough confirmation yet for a strong buy or sell signal.";
}

function getAddedCard(player: string, meta: string) {
  try {
    const added = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
    return added.find((item: { player?: string; meta?: string }) => item.player === player && item.meta === meta) || added.find((item: { player?: string }) => item.player === player);
  } catch {
    return null;
  }
}

function readPersisted(): PersistedMap {
  try {
    return JSON.parse(localStorage.getItem("cardsignal-card-detail-state") || "{}");
  } catch {
    return {};
  }
}

export default function CardDetailLayer() {
  const [card, setCard] = useState<DetailCard | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [step, setStep] = useState(0);

  const breakdown = useMemo(() => card ? buildBreakdown(card) : [], [card]);

  useEffect(() => {
    document.body.classList.add("cs-detail-enabled");

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".cs-detail-modal") || target.closest(".cs-modal")) return;
      const row = target.closest<HTMLElement>(".signal-row");
      if (!row) return;

      const player = row.querySelector<HTMLElement>(".signal-copy strong")?.textContent?.trim();
      const meta = row.querySelector<HTMLElement>(".signal-copy span")?.textContent?.trim() || "Card details unavailable";
      const scoreText = row.querySelector<HTMLElement>(".score-pill b")?.textContent || "60";
      const moveText = row.querySelector<HTMLElement>(".score-pill small")?.textContent || "0";
      if (!player) return;

      const key = `${player}|${meta}`;
      const persisted = readPersisted()[key] || {};
      const added = getAddedCard(player, meta);
      const score = Number(persisted.score ?? Number.parseInt(scoreText, 10) ?? 60);
      const move = Number(persisted.move ?? parseMove(moveText));
      const marketValue = Number(persisted.marketValue ?? added?.marketValue ?? marketFor(player, meta));
      const recommendation = (persisted.recommendation as DetailCard["recommendation"] | undefined) ?? recommendationFor(score);
      const confidence = (persisted.confidence as DetailCard["confidence"] | undefined) ?? confidenceFor(score);

      setCard({
        key,
        player,
        meta,
        score,
        move,
        marketValue,
        recommendation,
        confidence,
        lastScan: String(persisted.lastScan ?? "2 min ago"),
        scanCount: Number(persisted.scanCount ?? 0),
      });
      setReanalyzing(false);
      setStep(0);
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      document.body.classList.remove("cs-detail-enabled");
    };
  }, []);

  useEffect(() => {
    if (!card) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card]);

  useEffect(() => {
    if (!reanalyzing || !card) return;
    if (step < detailSteps.length) {
      const timer = window.setTimeout(() => setStep((value) => value + 1), 520);
      return () => window.clearTimeout(timer);
    }

    const seed = hashText(`${card.key}|reanalyze|${card.scanCount + 1}`);
    let delta = (seed % 15) - 7;
    if (delta === 0) delta = seed % 2 === 0 ? 3 : -3;
    const nextScore = Math.max(36, Math.min(96, card.score + delta));
    const nextMove = Math.round((card.move + delta * 0.7) * 10) / 10;
    const nextMarket = Math.max(5, Math.round(card.marketValue * (1 + nextMove / 1000) * 100) / 100);
    const nextRecommendation = recommendationFor(nextScore);
    const nextConfidence = confidenceFor(nextScore);
    const nextCard: DetailCard = {
      ...card,
      score: nextScore,
      move: nextMove,
      marketValue: nextMarket,
      recommendation: nextRecommendation,
      confidence: nextConfidence,
      lastScan: "just now",
      scanCount: card.scanCount + 1,
    };

    const persisted = readPersisted();
    persisted[card.key] = nextCard;
    localStorage.setItem("cardsignal-card-detail-state", JSON.stringify(persisted));

    const rows = Array.from(document.querySelectorAll<HTMLElement>(".signal-row"));
    const matching = rows.find((row) => {
      const name = row.querySelector<HTMLElement>(".signal-copy strong")?.textContent?.trim();
      const meta = row.querySelector<HTMLElement>(".signal-copy span")?.textContent?.trim();
      return name === card.player && meta === card.meta;
    });
    if (matching) {
      const pill = matching.querySelector<HTMLElement>(".score-pill");
      const mini = matching.querySelector<HTMLElement>(".mini-card");
      const scoreNode = pill?.querySelector<HTMLElement>("b");
      const moveNode = pill?.querySelector<HTMLElement>("small");
      if (scoreNode) scoreNode.textContent = String(nextScore);
      if (moveNode) moveNode.textContent = `${nextMove >= 0 ? "+" : ""}${nextMove}%`;
      const tone = nextRecommendation === "BUY" ? "buy" : nextRecommendation === "SELL" ? "sell" : "hold";
      pill?.classList.remove("buy", "sell", "hold");
      pill?.classList.add(tone);
      mini?.classList.remove("mini-buy", "mini-sell", "mini-hold");
      mini?.classList.add(`mini-${tone}`);
    }

    try {
      const added = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
      const updatedAdded = added.map((item: { player?: string; meta?: string }) => item.player === card.player && (item.meta === card.meta || !item.meta)
        ? { ...item, score: nextScore, move: `${nextMove >= 0 ? "+" : ""}${nextMove}%`, marketValue: nextMarket, tone: nextRecommendation === "BUY" ? "buy" : nextRecommendation === "SELL" ? "sell" : "hold" }
        : item);
      localStorage.setItem("cardsignal-added-cards", JSON.stringify(updatedAdded));
    } catch {}

    const alertsPanel = document.querySelector<HTMLElement>(".alerts-panel");
    if (alertsPanel) {
      const alert = document.createElement("div");
      const tone = delta > 0 ? "buy" : "sell";
      alert.className = `alert ${tone} cs-generated-alert`;
      alert.innerHTML = `<i>${delta > 0 ? "▲" : "▼"}</i><div><b>${delta > 0 ? "Momentum strengthened" : "Momentum weakened"}</b><p>${card.player.replace(/[<>]/g, "")} moved ${card.score} → ${nextScore}.</p><small>just now</small></div>`;
      const firstAlert = alertsPanel.querySelector(".alert");
      if (firstAlert) alertsPanel.insertBefore(alert, firstAlert);
      else alertsPanel.appendChild(alert);
    }

    setCard(nextCard);
    setReanalyzing(false);
    setStep(0);
  }, [reanalyzing, step, card]);

  if (!card) return null;

  return (
    <div className="cs-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCard(null)}>
      <section className="cs-detail-modal" role="dialog" aria-modal="true" aria-label={`${card.player} card details`}>
        <button className="cs-detail-close" onClick={() => setCard(null)} aria-label="Close">×</button>

        <div className="cs-detail-head">
          <div>
            <span className="cs-detail-kicker">CARD SIGNAL</span>
            <h2>{card.player}</h2>
            <p>{card.meta}</p>
          </div>
          <span className={`cs-detail-rec ${card.recommendation.toLowerCase()}`}>{card.recommendation}</span>
        </div>

        <div className="cs-detail-grid">
          <div className="cs-detail-cardart">
            <img src="/assets/cropped/cards/slab-frame-large.png" alt="" />
            <div className="cs-detail-initials">{card.player.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
          </div>

          <div className="cs-detail-summary">
            <div className="cs-detail-scorebox"><small>MOMENTUM SCORE</small><strong>{card.score}</strong><span>{card.confidence} CONFIDENCE</span></div>
            <div className="cs-detail-market"><small>EST. MARKET</small><strong>${card.marketValue.toFixed(2)}</strong><span className={card.move >= 0 ? "positive" : "negative"}>{card.move >= 0 ? "+" : ""}{card.move}% / 7D</span></div>
            <div className="cs-detail-last"><span>LAST SCAN</span><b>{card.lastScan}</b></div>
          </div>
        </div>

        <div className="cs-detail-breakdown">
          <div className="cs-detail-section-title"><span>SIGNAL BREAKDOWN</span><b>Why CardSignal sees it this way</b></div>
          {breakdown.map(([label, value]) => (
            <div className="cs-detail-metric" key={label}>
              <div><span>{label}</span><b>{value}</b></div>
              <div className="cs-detail-track"><i style={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="cs-detail-insight"><span>CARDSIGNAL INSIGHT</span><p>{insightFor(card)}</p></div>

        {reanalyzing ? (
          <div className="cs-detail-rescan">
            <div className="cs-detail-scanline"><i style={{ width: `${Math.min(100, (step / detailSteps.length) * 100)}%` }} /></div>
            <strong>Re-analyzing market…</strong>
            <div>{detailSteps.map((item, index) => <span key={item} className={index < step ? "done" : index === step ? "active" : ""}>{index < step ? "✓" : "•"} {item}</span>)}</div>
          </div>
        ) : (
          <button className="cs-detail-analyze" onClick={() => { setStep(0); setReanalyzing(true); }}><img src="/assets/cropped/icons/action-search.png" alt="" /> ANALYZE NOW</button>
        )}
      </section>

      <style jsx global>{`
        .cs-detail-enabled .signal-row{cursor:pointer;transition:background .18s ease,transform .18s ease}.cs-detail-enabled .signal-row:hover{background:rgba(55,198,255,.035);transform:translateX(2px)}
        .cs-detail-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:22px;background:rgba(0,7,12,.8);backdrop-filter:blur(14px)}
        .cs-detail-modal{position:relative;width:min(860px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(73,205,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 42px 120px rgba(0,0,0,.72);color:#effaff}.cs-detail-modal:before{content:"";position:absolute;left:0;top:0;width:210px;height:2px;background:linear-gradient(90deg,#48f19c,transparent);box-shadow:0 0 18px rgba(72,241,156,.65)}
        .cs-detail-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-detail-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-right:46px}.cs-detail-kicker{color:#53d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-detail-head h2{margin:7px 0 4px;font-size:31px;letter-spacing:-.04em}.cs-detail-head p{margin:0;color:#7896a8;font-size:12px}.cs-detail-rec{margin-top:22px;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:.12em}.cs-detail-rec.buy{color:#77ffb5;border:1px solid rgba(71,242,158,.3);background:rgba(46,198,126,.1)}.cs-detail-rec.sell{color:#ff8996;border:1px solid rgba(255,91,111,.3);background:rgba(211,50,71,.09)}.cs-detail-rec.hold{color:#74ddff;border:1px solid rgba(72,210,255,.28);background:rgba(42,151,196,.08)}
        .cs-detail-grid{display:grid;grid-template-columns:210px 1fr;gap:28px;align-items:center;margin:26px 0}.cs-detail-cardart{position:relative;height:265px;display:grid;place-items:center}.cs-detail-cardart>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.9;filter:drop-shadow(0 18px 30px rgba(0,0,0,.45))}.cs-detail-initials{position:relative;z-index:2;font-size:44px;font-weight:900;color:#dff7ff;text-shadow:0 0 24px rgba(64,216,255,.25)}.cs-detail-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-detail-scorebox,.cs-detail-market,.cs-detail-last{border:1px solid rgba(75,188,228,.13);border-radius:12px;background:rgba(8,27,42,.7);padding:16px}.cs-detail-scorebox small,.cs-detail-market small,.cs-detail-last span{display:block;color:#6e8fa3;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-detail-scorebox strong{display:block;font-size:64px;line-height:1;margin:8px 0;color:#effcff}.cs-detail-scorebox span{color:#75f4b1;font-size:9px;font-weight:900;letter-spacing:.09em}.cs-detail-market strong{display:block;font-size:28px;margin:12px 0 8px}.cs-detail-market span{font-size:11px}.cs-detail-last{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center}.cs-detail-last b{font-size:12px;color:#c4dce8}
        .cs-detail-breakdown{margin-top:8px;border-top:1px solid rgba(80,180,220,.11);padding-top:20px}.cs-detail-section-title{display:flex;justify-content:space-between;margin-bottom:16px}.cs-detail-section-title span{color:#54d9ff;font-size:9px;font-weight:900;letter-spacing:.15em}.cs-detail-section-title b{font-size:12px;color:#d7eaf3}.cs-detail-metric{margin:12px 0}.cs-detail-metric>div:first-child{display:flex;justify-content:space-between;color:#9db5c3;font-size:11px}.cs-detail-metric b{color:#e8f8ff}.cs-detail-track{height:7px;margin-top:6px;border-radius:8px;background:#081822;border:1px solid rgba(89,184,222,.08);overflow:hidden}.cs-detail-track i{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#18aaca,#48efa2);box-shadow:0 0 12px rgba(65,232,163,.25)}
        .cs-detail-insight{margin:20px 0;border:1px solid rgba(69,201,246,.16);border-radius:11px;background:rgba(17,72,98,.11);padding:14px}.cs-detail-insight span{color:#55d9ff;font-size:9px;font-weight:900;letter-spacing:.13em}.cs-detail-insight p{margin:7px 0 0;color:#9fb8c7;font-size:12px;line-height:1.55}.cs-detail-analyze{width:100%;height:46px;border:1px solid rgba(60,241,153,.46);border-radius:9px;background:linear-gradient(180deg,rgba(47,226,136,.21),rgba(16,90,62,.14));color:#c7ffe0;font-size:11px;font-weight:900;letter-spacing:.1em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}.cs-detail-analyze img{width:20px;height:20px;object-fit:contain}.cs-detail-rescan{border:1px solid rgba(62,211,255,.15);border-radius:11px;padding:15px;background:rgba(6,23,36,.72)}.cs-detail-scanline{height:5px;background:#07151f;border-radius:8px;overflow:hidden;margin-bottom:12px}.cs-detail-scanline i{display:block;height:100%;background:linear-gradient(90deg,#1eb1d1,#4cf0a5)}.cs-detail-rescan strong{display:block;margin-bottom:9px}.cs-detail-rescan>div:last-child{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.cs-detail-rescan span{font-size:10px;color:#668394}.cs-detail-rescan span.active{color:#5fdcff}.cs-detail-rescan span.done{color:#68efaa}.positive{color:#55efa4!important}.negative{color:#ff6678!important}.cs-generated-alert{animation:csAlertIn .28s ease both}@keyframes csAlertIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @media(max-width:680px){.cs-detail-modal{padding:22px}.cs-detail-grid{grid-template-columns:1fr}.cs-detail-cardart{height:220px}.cs-detail-summary{grid-template-columns:1fr 1fr}.cs-detail-section-title{flex-direction:column;gap:5px}.cs-detail-rescan>div:last-child{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
