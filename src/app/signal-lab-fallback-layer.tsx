"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Sale = { source: string; id: string; title: string; price: number | null; date: string; marketplace: string; grader?: string; grade?: string; image?: string };
type Tier = { count: number; median: number | null; average: number | null; low: number | null; high: number | null; sales: Sale[] };
type ExactPayload = { market?: { tiers?: { exact?: Tier; related?: Tier; reference?: Tier } } };

function money(v: number | null | undefined) {
  return v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SignalLabFallbackLayer() {
  const [payload, setPayload] = useState<ExactPayload | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const original = window.fetch.bind(window);
    const patched: typeof window.fetch = async (...args) => {
      const response = await original(...args);
      const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
      if (url.includes("/api/signal-lab-exact")) {
        response.clone().json().then((json) => {
          if (json?.market?.tiers) window.dispatchEvent(new CustomEvent("cardsignal:signal-tiers", { detail: json }));
        }).catch(() => {});
      }
      return response;
    };
    window.fetch = patched;
    const onTiers = (event: Event) => setPayload((event as CustomEvent).detail as ExactPayload);
    window.addEventListener("cardsignal:signal-tiers", onTiers);

    const syncHost = () => setHost(document.querySelector<HTMLElement>(".cs-signal-lab-modal"));
    syncHost();
    const observer = new MutationObserver(syncHost);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (window.fetch === patched) window.fetch = original;
      window.removeEventListener("cardsignal:signal-tiers", onTiers);
      observer.disconnect();
    };
  }, []);

  if (!host || !payload?.market?.tiers) return null;
  const { exact, related, reference } = payload.market.tiers;
  if (!exact || !related || !reference) return null;

  const renderTier = (name: string, subtitle: string, tier: Tier, tone: string) => (
    <section className={`cs-tier-card ${tone}`}>
      <div className="cs-tier-head"><div><span>{name}</span><small>{subtitle}</small></div><b>{tier.count} comps</b></div>
      <div className="cs-tier-stats"><div><small>MEDIAN</small><strong>{money(tier.median)}</strong></div><div><small>RANGE</small><strong>{money(tier.low)} — {money(tier.high)}</strong></div></div>
      {tier.sales.length > 0 ? <div className="cs-tier-sales">{tier.sales.slice(0, 4).map((sale, i) => <div key={`${sale.source}-${sale.id}-${i}`}><span className={`cs-tier-badge ${tone}`}>{name}</span><p>{sale.title}</p><b>{money(sale.price)}</b></div>)}</div> : <div className="cs-tier-empty">No sales found in this tier.</div>}
    </section>
  );

  return createPortal(
    <div className="cs-tier-wrap">
      <div className="cs-tier-intro"><span>FALLBACK MATCHING</span><b>{exact.count ? "Exact comps determine valuation." : "No exact comps — broader matches are context only."}</b><small>Related and Reference sales never get mixed into CardSignal&apos;s trusted market value.</small></div>
      <div className="cs-tier-grid">
        {renderTier("Exact", "Exact card identity + requested grade", exact, "exact")}
        {renderTier("Related", "Same exact card, other/raw or nearby grade", related, "related")}
        {renderTier("Reference", "Same card number or product/parallel family", reference, "reference")}
      </div>
      <style jsx global>{`
        .cs-tier-wrap{margin-top:12px;padding:15px;border:1px solid rgba(83,198,237,.16);border-radius:12px;background:rgba(4,17,28,.72)}.cs-tier-intro{display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:3px;align-items:center;margin-bottom:10px}.cs-tier-intro span{color:#5addff;font-size:8px;font-weight:900;letter-spacing:.14em}.cs-tier-intro b{font-size:10px}.cs-tier-intro small{grid-column:2;color:#6f91a3;font-size:8px}.cs-tier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.cs-tier-card{padding:12px;border:1px solid rgba(80,185,223,.12);border-radius:10px;background:#061522}.cs-tier-card.exact{border-color:rgba(74,239,156,.23)}.cs-tier-card.related{border-color:rgba(79,203,255,.22)}.cs-tier-card.reference{border-color:rgba(235,190,95,.2)}.cs-tier-head{display:flex;justify-content:space-between;gap:10px}.cs-tier-head span{display:block;font-size:10px;font-weight:900}.cs-tier-head small{display:block;margin-top:3px;color:#68899b;font-size:8px}.cs-tier-head>b{color:#c7dbe5;font-size:10px}.cs-tier-stats{display:grid;grid-template-columns:1fr 1.4fr;gap:6px;margin:10px 0}.cs-tier-stats>div{padding:8px;border:1px solid rgba(80,185,223,.09);border-radius:7px}.cs-tier-stats small{display:block;color:#648698;font-size:7px;font-weight:900;letter-spacing:.1em}.cs-tier-stats strong{display:block;margin-top:5px;font-size:11px}.cs-tier-sales{display:grid;gap:5px}.cs-tier-sales>div{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:6px;border-top:1px solid rgba(80,185,223,.07)}.cs-tier-sales p{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a9c0cc;font-size:8px}.cs-tier-sales b{font-size:9px;color:#66e9aa}.cs-tier-badge{padding:3px 5px;border-radius:5px;font-size:6px;font-weight:900;text-transform:uppercase}.cs-tier-badge.exact{color:#63efaa;background:rgba(55,202,126,.12)}.cs-tier-badge.related{color:#67dfff;background:rgba(56,160,211,.12)}.cs-tier-badge.reference{color:#eac775;background:rgba(193,144,43,.11)}.cs-tier-empty{padding:12px;color:#658698;text-align:center;font-size:8px}@media(max-width:850px){.cs-tier-grid{grid-template-columns:1fr}}
      `}</style>
    </div>, host
  );
}
