"use client";

import { useEffect } from "react";

type StoredCard = {
  id?: number;
  player?: string;
  meta?: string;
  marketValue?: number;
  liveValuation?: Record<string, unknown>;
};

type ValuationEventDetail = {
  query?: string;
  marketValue?: number;
  confidence?: string;
  compCount?: number;
  target?: {
    cardId?: number;
    player?: string;
    meta?: string;
  } | null;
};

function readCards(): StoredCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function norm(v?: string) { return String(v || "").trim().replace(/\s+/g, " ").toLowerCase(); }
function findCard(player: string, meta: string, cardId?: number) {
  const cards = readCards();
  if (cardId != null) {
    const byId = cards.find((card) => Number(card.id) === Number(cardId));
    if (byId) return byId;
  }
  const exact = cards.filter((card) => norm(card.player) === norm(player) && (!meta || norm(card.meta) === norm(meta)));
  if (exact.length === 1) return exact[0];
  const samePlayer = cards.filter((card) => norm(card.player) === norm(player));
  return samePlayer.length === 1 ? samePlayer[0] : null;
}

function openMarket(player: string, meta: string, cardId?: number) {
  const card = findCard(player, meta, cardId);
  if (!card) return;
  window.dispatchEvent(new CustomEvent("cardsignal:open-market", {
    detail: {
      cardId: card.id,
      player: card.player || player,
      meta: card.meta || meta,
      query: [card.player || player, card.meta || meta].filter(Boolean).join(" ").replace(/\s*·\s*/g, " "),
    },
  }));
}

function applyValuationFallback(detail: ValuationEventDetail) {
  const target = detail.target;
  if (!target || detail.marketValue == null) return false;

  const cards = readCards();
  if (!cards.length) return false;
  const matchedCard = findCard(target.player || "", target.meta || "", target.cardId);
  if (!matchedCard?.id) return false;

  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = JSON.parse(localStorage.getItem("cardsignal-live-valuation") || "{}");
  } catch {}

  const updated = cards.map((card) => Number(card.id) === Number(matchedCard.id) ? {
      ...card,
      marketValue: Number(detail.marketValue),
      liveValuation: {
        provider: "SoldComps",
        identity: snapshot.identity,
        identityLabel: snapshot.identityLabel,
        confidence: detail.confidence || snapshot.confidence,
        median: Number(detail.marketValue),
        average: snapshot.average,
        low: snapshot.low,
        high: snapshot.high,
        compCount: detail.compCount ?? snapshot.compCount,
        savedAt: snapshot.savedAt || new Date().toISOString(),
        acceptedComps: snapshot.acceptedComps,
      },
    } : card);

  localStorage.setItem("cardsignal-added-cards", JSON.stringify(updated));

  try {
    const state = JSON.parse(localStorage.getItem("cardsignal-card-detail-state") || "{}");
    const exactKey = `${matchedCard.player || ""}|${matchedCard.meta || ""}`;
    state[exactKey] = {
      ...(state[exactKey] || {}),
      marketValue: Number(detail.marketValue),
      lastScan: "live comps · just now",
    };
    localStorage.setItem("cardsignal-card-detail-state", JSON.stringify(state));
  } catch {}

  window.dispatchEvent(new CustomEvent("cardsignal:user-cards-changed"));
  window.dispatchEvent(new CustomEvent("cardsignal:valuation-applied", {
    detail: {
      cardId: matchedCard.id,
      player: matchedCard.player,
      meta: matchedCard.meta,
      marketValue: Number(detail.marketValue),
      confidence: detail.confidence,
      compCount: detail.compCount,
      savedAt: new Date().toISOString(),
    },
  }));

  return true;
}

export default function ValuationBridge() {
  useEffect(() => {
    const enhance = () => {
      const detail = document.querySelector<HTMLElement>(".cs-detail-modal");
      if (detail && !detail.querySelector(".cs-detail-live")) {
        const player = detail.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim() || "";
        const meta = detail.querySelector<HTMLElement>(".cs-detail-head p")?.textContent?.trim() || "";
        const cardId = Number(detail.dataset.userCardId || 0) || undefined;
        const analyze = detail.querySelector<HTMLButtonElement>(".cs-detail-analyze");
        if (player && analyze) {
          const wrap = document.createElement("div");
          wrap.className = "cs-detail-action-row";
          analyze.parentElement?.insertBefore(wrap, analyze);
          wrap.appendChild(analyze);

          const live = document.createElement("button");
          live.type = "button";
          live.className = "cs-detail-live";
          live.innerHTML = '<span>●</span> LIVE SOLD COMPS';
          live.addEventListener("click", () => openMarket(player, meta, cardId));
          wrap.appendChild(live);
        }
      }

      document.querySelectorAll<HTMLElement>(".cs-portfolio-card").forEach((article) => {
        if (article.querySelector(".cs-portfolio-live")) return;
        const player = article.querySelector<HTMLElement>(".cs-portfolio-copy strong")?.textContent?.trim() || "";
        const meta = article.querySelector<HTMLElement>(".cs-portfolio-copy > span")?.textContent?.trim() || "";
        const cardId = Number(article.dataset.userCardId || 0) || undefined;
        const actions = article.querySelector<HTMLElement>(".cs-portfolio-actions");
        if (!player || !actions) return;

        const live = document.createElement("button");
        live.type = "button";
        live.className = "cs-portfolio-live";
        live.textContent = "LIVE COMPS";
        live.addEventListener("click", (event) => {
          event.stopPropagation();
          openMarket(player, meta, cardId);
        });
        actions.insertBefore(live, actions.firstChild);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    const onValuation = (event: Event) => {
      const detail = (event as CustomEvent<ValuationEventDetail>).detail;
      if (!detail?.target || detail.marketValue == null) return;
      applyValuationFallback(detail);
    };

    const onApplied = (event: Event) => {
      const detail = (event as CustomEvent<{ cardId?: number; player?: string; meta?: string; marketValue?: number; savedAt?: string }>).detail;
      if (detail?.marketValue == null) return;

      const modal = document.querySelector<HTMLElement>(".cs-detail-modal");
      const modalId = Number(modal?.dataset.userCardId || 0);
      if (modal && detail.cardId != null && modalId === Number(detail.cardId)) {
        const market = modal.querySelector<HTMLElement>(".cs-detail-market strong");
        const lastScan = modal.querySelector<HTMLElement>(".cs-detail-last b");
        if (market) market.textContent = `$${detail.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (lastScan) lastScan.textContent = "live comps · just now";
      }
    };

    window.addEventListener("cardsignal:valuation", onValuation as EventListener);
    window.addEventListener("cardsignal:valuation-applied", onApplied as EventListener);
    return () => {
      observer.disconnect();
      window.removeEventListener("cardsignal:valuation", onValuation as EventListener);
      window.removeEventListener("cardsignal:valuation-applied", onApplied as EventListener);
    };
  }, []);

  return (
    <style jsx global>{`
      .cs-detail-action-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cs-detail-action-row .cs-detail-analyze{width:100%}.cs-detail-live{height:46px;border:1px solid rgba(75,207,255,.34);border-radius:9px;background:linear-gradient(180deg,rgba(35,155,205,.16),rgba(7,34,51,.72));color:#aeefff;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-detail-live span{color:#55f0a5;text-shadow:0 0 10px #55f0a5;margin-right:6px}.cs-portfolio-actions .cs-portfolio-live{border-color:rgba(67,215,255,.28);color:#72ddff}.cs-portfolio-actions .cs-portfolio-live:hover{border-color:rgba(72,238,157,.45);color:#9fffc9}@media(max-width:680px){.cs-detail-action-row{grid-template-columns:1fr}}
    `}</style>
  );
}
