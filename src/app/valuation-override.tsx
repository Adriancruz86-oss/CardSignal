"use client";

import { useEffect } from "react";

type StoredCard = {
  id?: number;
  player?: string;
  meta?: string;
  marketValue?: number;
  liveValuation?: Record<string, unknown>;
};

function parseMoney(text: string) {
  const value = Number.parseFloat(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function readCards(): StoredCard[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCards(cards: StoredCard[]) {
  localStorage.setItem("cardsignal-added-cards", JSON.stringify(cards));
}

export default function ValuationOverride() {
  useEffect(() => {
    let scheduled = false;

    const enhance = () => {
      scheduled = false;
      const panel = document.querySelector<HTMLElement>(".cs-live-modal");
      if (!panel) return;

      const mainButton = panel.querySelector<HTMLButtonElement>(".cs-live-confidence > button");
      const acceptedText = panel.querySelector<HTMLElement>(".cs-live-confidence > div:nth-child(2) strong")?.textContent || "0";
      const accepted = Number.parseInt(acceptedText, 10) || 0;
      const confidence = panel.querySelector<HTMLElement>(".cs-live-confidence > div:first-child strong")?.textContent?.trim() || "";
      const target = panel.querySelector<HTMLElement>(".cs-live-target");
      const medianText = panel.querySelector<HTMLElement>(".cs-live-summary > div:first-child strong")?.textContent || "";
      const median = parseMoney(medianText);

      let note = panel.querySelector<HTMLElement>(".cs-valuation-lock-note");
      let override = panel.querySelector<HTMLButtonElement>(".cs-valuation-override");
      const shouldShowOverride = Boolean(mainButton?.disabled && target && accepted > 0 && median != null);

      if (!shouldShowOverride) {
        note?.remove();
        override?.remove();
        return;
      }

      const noteText = accepted === 1
        ? "CardSignal found only 1 accepted comp, so the trusted Apply button is locked. You can still use this single-sale value manually."
        : `CardSignal found ${accepted} accepted comps, but confidence is ${confidence || "low"}. You can still apply the value manually.`;

      if (!note) {
        note = document.createElement("div");
        note.className = "cs-valuation-lock-note";
        mainButton?.parentElement?.appendChild(note);
      }
      if (note.textContent !== noteText) note.textContent = noteText;

      if (!override) {
        override = document.createElement("button");
        override.type = "button";
        override.className = "cs-valuation-override";
        mainButton?.parentElement?.appendChild(override);
      }

      const overrideText = accepted === 1 ? "APPLY 1 COMP ANYWAY" : "APPLY LOW-CONFIDENCE VALUE";
      if (override.textContent !== overrideText && !override.disabled) override.textContent = overrideText;

      override.onclick = () => {
        const player = target?.querySelector<HTMLElement>("b")?.textContent?.trim() || "";
        const meta = target?.querySelector<HTMLElement>("small")?.textContent?.trim() || "";
        if (!player || median == null) return;

        const cards = readCards();
        const exactIndex = cards.findIndex((card) => card.player === player && (!meta || card.meta === meta));
        const index = exactIndex >= 0 ? exactIndex : cards.findIndex((card) => card.player === player);
        if (index < 0) {
          window.alert("CardSignal could not find this saved card to update.");
          return;
        }

        const savedAt = new Date().toISOString();
        cards[index] = {
          ...cards[index],
          marketValue: median,
          liveValuation: {
            provider: "SoldComps",
            confidence: confidence || "Loose",
            median,
            compCount: accepted,
            savedAt,
            manualOverride: true,
          },
        };
        saveCards(cards);

        try {
          const state = JSON.parse(localStorage.getItem("cardsignal-card-detail-state") || "{}");
          const key = `${player}|${meta}`;
          state[key] = { ...(state[key] || {}), marketValue: median, lastScan: "live comps · manual override" };
          localStorage.setItem("cardsignal-card-detail-state", JSON.stringify(state));
        } catch {}

        window.dispatchEvent(new CustomEvent("cardsignal:user-cards-changed"));
        window.dispatchEvent(new CustomEvent("cardsignal:valuation-applied", {
          detail: { player, meta, marketValue: median, confidence: confidence || "Loose", compCount: accepted, savedAt },
        }));

        override!.textContent = "VALUE APPLIED";
        override!.disabled = true;
        note!.textContent = "Applied as a low-confidence valuation. CardSignal will keep the warning attached to this value.";
      };
    };

    const scheduleEnhance = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(enhance);
    };

    scheduleEnhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .cs-live-confidence{align-items:stretch}.cs-live-confidence>button{min-height:54px}.cs-valuation-lock-note{grid-column:1/-1;margin-top:2px;padding:9px 11px;border:1px solid rgba(240,197,109,.18);border-radius:8px;background:rgba(180,120,20,.06);color:#c8a96d;font-size:9px;line-height:1.45}.cs-valuation-override{grid-column:1/-1;height:38px;border:1px solid rgba(240,197,109,.35);border-radius:8px;background:rgba(180,120,20,.09);color:#f1cf88;font-size:9px;font-weight:900;letter-spacing:.09em;cursor:pointer;pointer-events:auto!important;position:relative;z-index:10}.cs-valuation-override:hover{border-color:rgba(240,197,109,.58);background:rgba(180,120,20,.14)}.cs-valuation-override:disabled{opacity:.65;cursor:default}
    `}</style>
  );
}
