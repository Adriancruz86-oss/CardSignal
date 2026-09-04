"use client";

import { useEffect } from "react";

type Identity = { year?: string; setName?: string; manufacturer?: string; cardNumber?: string; playerName?: string; variation?: string; sport?: string; url?: string };

function setReactInput(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function label(id: Identity) {
  return [id.year, id.setName, id.cardNumber ? `#${id.cardNumber}` : "", id.variation].filter(Boolean).join(" · ");
}

export default function AddCardIdentityLayer() {
  useEffect(() => {
    const cache = new Map<string, Identity[]>();
    let timer = 0;
    let selected: Identity | null = null;
    let currentPlayerInput: HTMLInputElement | null = null;

    const removeDropdown = () => document.querySelector(".cs-add-card-suggestions")?.remove();
    const removeLocked = () => document.querySelector(".cs-add-card-locked")?.remove();

    const renderLocked = (input: HTMLInputElement, id: Identity) => {
      removeLocked();
      const box = document.createElement("div");
      box.className = "cs-add-card-locked";
      box.innerHTML = `<span>CANONICAL CARD</span><b>${label(id).replace(/[<>]/g, "")}</b><button type="button">CHANGE</button>`;
      box.querySelector("button")?.addEventListener("click", () => {
        selected = null;
        box.remove();
        input.focus();
      });
      input.parentElement?.appendChild(box);
    };

    const applyIdentity = (id: Identity, playerInput: HTMLInputElement) => {
      selected = id;
      removeDropdown();
      const labels = Array.from(document.querySelectorAll<HTMLElement>(".cs-fields label"));
      const yearSet = labels.find((el) => el.textContent?.includes("YEAR / SET"))?.querySelector<HTMLInputElement>("input") ?? null;
      const cardNo = labels.find((el) => el.textContent?.includes("CARD #"))?.querySelector<HTMLInputElement>("input") ?? null;
      const variant = labels.find((el) => el.textContent?.includes("VARIANT"))?.querySelector<HTMLInputElement>("input") ?? null;
      setReactInput(playerInput, id.playerName || playerInput.value);
      setReactInput(yearSet, [id.year, id.setName].filter(Boolean).join(" "));
      setReactInput(cardNo, id.cardNumber || "");
      setReactInput(variant, id.variation || "");
      renderLocked(playerInput, id);
      sessionStorage.setItem("cardsignal-pending-canonical", JSON.stringify(id));
    };

    const renderDropdown = (input: HTMLInputElement, items: Identity[]) => {
      removeDropdown();
      if (!items.length) return;
      const drop = document.createElement("div");
      drop.className = "cs-add-card-suggestions";
      drop.innerHTML = `<div class="cs-add-card-suggest-head">POSSIBLE CARDS — SELECT THE EXACT ONE</div>`;
      items.slice(0, 12).forEach((id) => {
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<strong>${(id.playerName || "Unknown player").replace(/[<>]/g, "")}</strong><span>${label(id).replace(/[<>]/g, "")}</span><small>${[id.manufacturer, id.sport].filter(Boolean).join(" · ").replace(/[<>]/g, "") || "TCDB / Parse"}</small>`;
        button.addEventListener("click", () => applyIdentity(id, input));
        drop.appendChild(button);
      });
      input.parentElement?.appendChild(drop);
    };

    const attach = () => {
      const playerInput = document.querySelector<HTMLInputElement>(".cs-fields label:first-child input");
      if (!playerInput || playerInput === currentPlayerInput) return;
      currentPlayerInput = playerInput;
      playerInput.parentElement?.classList.add("cs-add-card-smart-wrap");
      const onInput = () => {
        selected = null;
        removeLocked();
        sessionStorage.removeItem("cardsignal-pending-canonical");
        window.clearTimeout(timer);
        const q = playerInput.value.trim();
        if (q.length < 6) { removeDropdown(); return; }
        timer = window.setTimeout(async () => {
          const key = q.toLowerCase();
          if (cache.has(key)) { renderDropdown(playerInput, cache.get(key)!); return; }
          try {
            const r = await fetch(`/api/card-suggestions?q=${encodeURIComponent(q)}`);
            const j = await r.json();
            const items = r.ok && j.ok && Array.isArray(j.suggestions) ? j.suggestions as Identity[] : [];
            cache.set(key, items);
            renderDropdown(playerInput, items);
          } catch { removeDropdown(); }
        }, 450);
      };
      playerInput.addEventListener("input", onInput);
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!button) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      if (text.includes("ADD TO DASHBOARD") && selected) {
        window.setTimeout(() => {
          try {
            const cards = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
            if (Array.isArray(cards) && cards.length) {
              cards[0] = { ...cards[0], canonicalIdentity: selected };
              localStorage.setItem("cardsignal-added-cards", JSON.stringify(cards));
              window.dispatchEvent(new CustomEvent("cardsignal:user-cards-changed"));
            }
          } catch {}
          selected = null;
          sessionStorage.removeItem("cardsignal-pending-canonical");
        }, 120);
      }
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
    };
  }, []);

  return <style jsx global>{`
    .cs-add-card-smart-wrap{position:relative}.cs-add-card-suggestions{position:absolute;z-index:150;left:0;right:0;top:68px;max-height:360px;overflow:auto;padding:7px;border:1px solid rgba(75,207,255,.3);border-radius:10px;background:#061522;box-shadow:0 22px 70px rgba(0,0,0,.78)}.cs-add-card-suggest-head{position:sticky;top:-7px;z-index:2;margin:-7px -7px 3px;padding:9px 10px;background:#061522;border-bottom:1px solid rgba(75,207,255,.12);color:#5addff;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-add-card-suggestions button{display:block;width:100%;min-height:64px;padding:10px 11px;border:0;border-top:1px solid rgba(75,207,255,.08);background:transparent;color:#e8f8ff;text-align:left;cursor:pointer}.cs-add-card-suggestions button:hover{background:rgba(44,190,141,.08)}.cs-add-card-suggestions strong,.cs-add-card-suggestions span,.cs-add-card-suggestions small{display:block}.cs-add-card-suggestions strong{font-size:10px}.cs-add-card-suggestions span{margin-top:4px;color:#9cb6c3;font-size:9px;line-height:1.35}.cs-add-card-suggestions small{margin-top:4px;color:#5f8091;font-size:8px}.cs-add-card-locked{display:flex;align-items:center;gap:7px;margin-top:6px;padding:7px 9px;border:1px solid rgba(62,241,154,.22);border-radius:7px;background:rgba(35,173,108,.07)}.cs-add-card-locked span{color:#62eba6;font-size:7px;font-weight:900;letter-spacing:.1em}.cs-add-card-locked b{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.cs-add-card-locked button{border:0;background:none;color:#69dfff;font-size:7px;font-weight:900;cursor:pointer}@media(max-width:720px){.cs-add-card-suggestions{position:fixed;left:20px;right:20px;top:145px;max-height:50vh}}
  `}</style>;
}
