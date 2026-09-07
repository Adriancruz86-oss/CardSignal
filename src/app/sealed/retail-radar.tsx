"use client";

import { useEffect, useState } from "react";

type Offer = {
  source: string;
  title: string;
  price: number;
  shipping: number;
  deliveredPrice: number;
  url: string;
  inStock: boolean;
  sourceType: "retailer" | "marketplace";
};
type Link = { source: string; url: string };
type Data = {
  ok: boolean;
  checkedAt?: string;
  msrp?: number | null;
  liveOffers?: Offer[];
  bestLiveOffer?: Offer | null;
  atOrBelowMsrp?: boolean;
  savingsVsMsrp?: number | null;
  retailerSearchLinks?: Link[];
  note?: string;
  error?: string;
};

function money(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function entrySignal(best: Offer | null | undefined, market?: number | null, atOrBelowMsrp?: boolean) {
  if (!best) return { label: "NO VERIFIED ENTRY", tone: "neutral" };
  if (atOrBelowMsrp) return { label: "FAVORABLE ENTRY", tone: "good" };
  if (market && market > 0) {
    const gap = (best.deliveredPrice - market) / market;
    if (gap <= -0.08) return { label: "FAVORABLE ENTRY", tone: "good" };
    if (gap <= 0.05) return { label: "FAIR ENTRY", tone: "fair" };
    return { label: "WAIT", tone: "wait" };
  }
  return { label: "LIVE OFFER", tone: "fair" };
}

export default function RetailRadar({
  query,
  msrp,
  market,
  compact = false,
}: {
  query: string;
  msrp?: number | null;
  market?: number | null;
  compact?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const p = new URLSearchParams({ q: query });
    if (msrp != null) p.set("msrp", String(msrp));
    fetch(`/api/sealed-retail-radar?${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && setData(j))
      .catch((e) => live && setData({ ok: false, error: e instanceof Error ? e.message : "Retail lookup failed" }))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [query, msrp]);

  if (loading) return <div className={`retail-radar summary ${compact ? "compact" : ""}`}>Checking buy price…</div>;
  if (!data?.ok) return <div className={`retail-radar summary ${compact ? "compact" : ""}`}>Buy price unavailable</div>;

  const best = data.bestLiveOffer;
  const signal = entrySignal(best, market, data.atOrBelowMsrp);

  return (
    <div className={`retail-radar summary ${compact ? "compact" : ""}`}>
      <div className="rr-summary-row">
        <div>
          <span>BEST VERIFIED BUY</span>
          {best ? <a href={best.url} target="_blank" rel="noreferrer"><strong>{money(best.deliveredPrice)}</strong><small>{best.source}</small></a> : <strong>—</strong>}
        </div>
        <b className={`rr-entry ${signal.tone}`}>{signal.label}</b>
      </div>
      <details className="rr-details">
        <summary>Retail details</summary>
        {best && data.savingsVsMsrp != null && data.savingsVsMsrp > 0 && <p>{money(data.savingsVsMsrp)} under MSRP.</p>}
        <div className="rr-links">{(data.retailerSearchLinks || []).map((x) => <a key={x.source} href={x.url} target="_blank" rel="noreferrer">{x.source}</a>)}</div>
        <small>{data.note}</small>
      </details>
      <style jsx>{`
        .retail-radar{margin-top:10px;padding:11px;border:1px solid rgba(90,200,230,.14);border-radius:10px;background:#04151f;color:#cce7ef}.rr-summary-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.rr-summary-row>div>span{display:block;font-size:7px;font-weight:900;letter-spacing:.1em;color:#6f919d}.rr-summary-row a{display:flex;align-items:baseline;gap:7px;margin-top:3px;text-decoration:none;color:#a8f2c2}.rr-summary-row strong{font-size:17px}.rr-summary-row small{font-size:8px;color:#77948a}.rr-entry{font-size:8px;letter-spacing:.06em;border:1px solid;padding:6px 8px;border-radius:999px;white-space:nowrap}.rr-entry.good{color:#83efae;border-color:rgba(110,230,160,.3);background:rgba(50,150,95,.1)}.rr-entry.fair{color:#8fdff1;border-color:rgba(100,205,235,.26)}.rr-entry.wait{color:#f2c879;border-color:rgba(235,190,100,.28)}.rr-entry.neutral{color:#859ca5;border-color:rgba(130,160,170,.2)}.rr-details{margin-top:8px;color:#718d97;font-size:8px}.rr-details summary{cursor:pointer;color:#8fb2bd}.rr-details p{margin:7px 0 0}.rr-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.rr-links a{font-size:8px;text-decoration:none;color:#9ad8e8;border:1px solid rgba(100,190,220,.14);padding:5px 7px;border-radius:6px}.rr-details>small{display:block;margin-top:6px;color:#566f78;line-height:1.4}.compact{padding:8px}.compact .rr-summary-row strong{font-size:15px}
      `}</style>
    </div>
  );
}
