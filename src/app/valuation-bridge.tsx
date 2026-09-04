"use client";

import { useEffect } from "react";

type StoredCard = {
  id?: number;
  player?: string;
  meta?: string;
};

function readCards(): StoredCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findCard(player: string, meta: string) {
  const cards = readCards();
  return cards.find((card) => card.player === player && card.meta === meta) || cards.find((card) => card.player === player) || null;
}

function openMarket(player: string, meta: string) {
  const card = findCard(player, meta);
  window.dispatchEvent(new CustomEvent("cardsignal:open-market", {
    detail: {
      cardId: card?.id,
      player,
      meta,
      query: [player, meta].filter(Boolean).join(" ").replace(/\s*·\s*/g, " "),
    },
  }));
}

export default function ValuationBridge() {
  useEffect(() => {
    const enhance = () => {
      const detail = document.querySelector<HTMLElement>(".cs-detail-modal");
      if (detail && !detail.querySelector(".cs-detail-live")) {
        const player = detail.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim() || "";
        const meta = detail.querySelector<HTMLElement>(".cs-detail-head p")?.textContent?.trim() || "";
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
          live.addEventListener("click", () => openMarket(player, meta));
          wrap.appendChild(live);
        }
      }

      document.querySelectorAll<HTMLElement>(".cs-portfolio-card").forEach((article) => {
        if (article.querySelector(".cs-portfolio-live")) return;
        const player = article.querySelector<HTMLElement>(".cs-portfolio-copy strong")?.textContent?.trim() || "";
        const meta = article.querySelector<HTMLElement>(".cs-portfolio-copy > span")?.textContent?.trim() || "";
        const actions = article.querySelector<HTMLElement>(".cs-portfolio-actions");
        if (!player || !actions) return;

        const live = document.createElement("button");
        live.type = "button";
        live.className = "cs-portfolio-live";
        live.textContent = "LIVE COMPS";
        live.addEventListener("click", (event) => {
          event.stopPropagation();
          openMarket(player, meta);
        });
        actions.insertBefore(live, actions.firstChild);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    const onApplied = (event: Event) => {
      const detail = (event as CustomEvent<{ player?: string; meta?: string; marketValue?: number; savedAt?: string }>).detail;
      if (!detail?.player || detail.marketValue == null) return;

      const modal = document.querySelector<HTMLElement>(".cs-detail-modal");
      const modalPlayer = modal?.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim();
      const modalMeta = modal?.querySelector<HTMLElement>(".cs-detail-head p")?.textContent?.trim();
      if (modal && modalPlayer === detail.player && (!detail.meta || modalMeta === detail.meta)) {
        const market = modal.querySelector<HTMLElement>(".cs-detail-market strong");
        const lastScan = modal.querySelector<HTMLElement>(".cs-detail-last b");
        if (market) market.textContent = `$${detail.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (lastScan) lastScan.textContent = "live comps · just now";
      }
    };

    window.addEventListener("cardsignal:valuation-applied", onApplied as EventListener);
    return () => {
      observer.disconnect();
      window.removeEventListener("cardsignal:valuation-applied", onApplied as EventListener);
    };
  }, []);

  return (
    <style jsx global>{`
      .cs-detail-action-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cs-detail-action-row .cs-detail-analyze{width:100%}.cs-detail-live{height:46px;border:1px solid rgba(75,207,255,.34);border-radius:9px;background:linear-gradient(180deg,rgba(35,155,205,.16),rgba(7,34,51,.72));color:#aeefff;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-detail-live span{color:#55f0a5;text-shadow:0 0 10px #55f0a5;margin-right:6px}.cs-portfolio-actions .cs-portfolio-live{border-color:rgba(67,215,255,.28);color:#72ddff}.cs-portfolio-actions .cs-portfolio-live:hover{border-color:rgba(72,238,157,.45);color:#9fffc9}@media(max-width:680px){.cs-detail-action-row{grid-template-columns:1fr}}
    `}</style>
  );
}
