"use client";

import { FormEvent, useState } from "react";
import { persistConfirmedSealed } from "./sealed-cloud";
import RetailRadar from "./retail-radar";

type Candidate = {
  year: string | null;
  brand: string | null;
  line: string | null;
  format: string | null;
  category: "Sports" | "Pokémon";
  canonicalKey: string;
  confidence: "high" | "medium" | "low";
  evidenceCount: number;
  pricedEvidenceCount: number;
  marketMedian: number | null;
  lastSaleDate: string | null;
  sampleTitle: string;
  marketplace: string;
  imageUrl?: string;
  imageSource?: string;
};

type ResponseData = {
  ok: boolean;
  provider?: string;
  fetchedAt?: string;
  scannedListings?: number;
  candidates?: Candidate[];
  identityNote?: string;
  error?: string;
};

function money(v: number | null) {
  return v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function displayName(candidate: Candidate) {
  return [candidate.year, candidate.brand, candidate.line].filter(Boolean).join(" ") || candidate.sampleTitle;
}

export default function LiveSealedDiscovery() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Sports" | "Pokémon">("Sports");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResponseData | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveMessage, setSaveMessage] = useState<Record<string, string>>({});

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`/api/sealed-discovery?q=${encodeURIComponent(query.trim())}&category=${encodeURIComponent(category)}`, { cache: "no-store" });
      setResult(await r.json() as ResponseData);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Discovery failed" });
    } finally {
      setLoading(false);
    }
  }

  async function confirm(candidate: Candidate) {
    const key = candidate.canonicalKey;
    setSaving((o) => ({ ...o, [key]: true }));
    setSaveMessage((o) => ({ ...o, [key]: "" }));
    try {
      await persistConfirmedSealed(candidate, result?.provider);
      setConfirmed((o) => ({ ...o, [key]: true }));
      setSaveMessage((o) => ({ ...o, [key]: "Saved to My Sealed and market history started." }));
      window.dispatchEvent(new Event("cardsignal-sealed-snapshot"));
    } catch (err) {
      setSaveMessage((o) => ({ ...o, [key]: err instanceof Error ? err.message : "Could not save sealed product." }));
    } finally {
      setSaving((o) => ({ ...o, [key]: false }));
    }
  }

  return (
    <section className="live-sealed-discovery">
      <div className="live-sealed-inner">
        <div className="live-sealed-heading">
          <div>
            <span>DISCOVER</span>
            <h2>Find wax. Check the price. Track it.</h2>
            <p>Search the live market and CardSignal will surface the most likely sealed products, current market value, and best verified buy entry.</p>
          </div>
          <b>{result?.provider ? `LIVE · ${result.provider}` : "LIVE MARKET"}</b>
        </div>

        <form onSubmit={search} className="live-sealed-search">
          <select value={category} onChange={(e) => setCategory(e.target.value as "Sports" | "Pokémon")}>
            <option>Sports</option>
            <option>Pokémon</option>
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a box, pack, set, or release…" />
          <button disabled={loading || query.trim().length < 3}>{loading ? "Searching…" : "Search"}</button>
        </form>

        {result && !result.ok && <div className="live-sealed-error">{result.error || "Live discovery failed."}</div>}

        {result?.ok && (
          <>
            <div className="live-sealed-meta">
              <span>{result.candidates?.length ?? 0} matches</span>
              <span>{result.scannedListings ?? 0} market records checked</span>
              <span>{result.fetchedAt ? `Updated ${new Date(result.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
            </div>

            <div className="identity-grid">
              {(result.candidates ?? []).map((candidate) => {
                const isConfirmed = !!confirmed[candidate.canonicalKey];
                const isSaving = !!saving[candidate.canonicalKey];
                const buyQuery = [candidate.year, candidate.brand, candidate.line, candidate.format].filter(Boolean).join(" ");

                return (
                  <article className="identity-card" key={candidate.canonicalKey}>
                    <div className="identity-primary">
                      <div className="identity-image">
                        {candidate.imageUrl ? <img src={candidate.imageUrl} alt={displayName(candidate)} /> : <span>WAX</span>}
                      </div>

                      <div className="identity-main">
                        <span className="identity-kicker">{candidate.category} · {candidate.format ?? "Format unknown"}</span>
                        <h3>{displayName(candidate)}</h3>
                        <div className="identity-price-row">
                          <div><span>MARKET</span><strong>{money(candidate.marketMedian)}</strong></div>
                          <RetailRadar compact query={buyQuery} market={candidate.marketMedian} />
                        </div>
                      </div>
                    </div>

                    <button className={`track-button ${isConfirmed ? "confirmed" : ""}`} disabled={isSaving || isConfirmed} onClick={() => confirm(candidate)}>
                      {isSaving ? "Saving…" : isConfirmed ? "✓ Tracking" : "+ Track product"}
                    </button>

                    {saveMessage[candidate.canonicalKey] && <small className={isConfirmed ? "confirmed-note" : "save-error"}>{saveMessage[candidate.canonicalKey]}</small>}

                    <details className="identity-details">
                      <summary>Product details</summary>
                      <div className="identity-detail-grid">
                        <div><span>ID CONFIDENCE</span><b className={candidate.confidence}>{candidate.confidence}</b></div>
                        <div><span>EVIDENCE</span><b>{candidate.evidenceCount}</b></div>
                        <div><span>PRICED SALES</span><b>{candidate.pricedEvidenceCount}</b></div>
                        <div><span>LAST SALE</span><b>{candidate.lastSaleDate ? candidate.lastSaleDate.slice(0, 10) : "—"}</b></div>
                      </div>
                      <div className="canonical-key"><span>CARDSIGNAL IDENTITY KEY</span><code>{candidate.canonicalKey}</code></div>
                      <p className="source-title"><span>SOURCE TITLE</span>{candidate.sampleTitle}</p>
                      {candidate.imageSource && <small>Image: {candidate.imageSource}</small>}
                      {result.identityNote && <small>{result.identityNote}</small>}
                    </details>
                  </article>
                );
              })}
            </div>

            {result.candidates?.length === 0 && <div className="live-sealed-empty">No strong sealed matches found. Try including the year, set name, and format.</div>}
          </>
        )}
      </div>

      <style jsx global>{`
        .live-sealed-discovery{background:#03111b;color:#d8edf5;font-family:Arial,sans-serif}.live-sealed-inner{max-width:1360px;margin:0 auto;padding:24px}.live-sealed-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.live-sealed-heading span{font-size:9px;font-weight:900;letter-spacing:.14em;color:#5ee6ff}.live-sealed-heading h2{margin:5px 0;font-size:20px}.live-sealed-heading p{max-width:760px;margin:0;color:#7899a8;font-size:11px;line-height:1.5}.live-sealed-heading>b{font-size:8px;color:#6ef0ab;border:1px solid rgba(110,240,171,.22);padding:6px 8px;border-radius:7px}.live-sealed-search{display:grid;grid-template-columns:120px 1fr auto;gap:8px;margin-top:16px}.live-sealed-search select,.live-sealed-search input,.live-sealed-search button{min-height:42px;border:1px solid rgba(86,199,235,.18);border-radius:9px;background:#071d2b;color:#cce8f2;padding:0 12px}.live-sealed-search button{font-weight:900;color:#9ff6c4;cursor:pointer}.live-sealed-meta{display:flex;gap:15px;flex-wrap:wrap;margin:13px 0 8px;color:#6f929f;font-size:8px}.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}.identity-card{border:1px solid rgba(83,198,235,.13);background:#061925;border-radius:12px;padding:13px}.identity-primary{display:grid;grid-template-columns:118px 1fr;gap:13px}.identity-image{height:118px;background:#031018;border-radius:9px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#4c6771;font-size:10px;font-weight:900}.identity-image img{max-width:100%;max-height:100%;object-fit:contain}.identity-kicker{font-size:8px;color:#63cfea;text-transform:uppercase}.identity-main h3{font-size:15px;line-height:1.25;margin:4px 0 10px}.identity-price-row>div:first-child{margin-bottom:2px}.identity-price-row>div:first-child span{display:block;color:#617f8c;font-size:7px;font-weight:900;letter-spacing:.08em}.identity-price-row>div:first-child strong{display:block;margin-top:2px;font-size:19px}.track-button{width:100%;min-height:38px;margin-top:11px;border:1px solid rgba(110,230,160,.24);background:rgba(50,150,95,.09);color:#9cf0bc;border-radius:8px;font-weight:900;cursor:pointer}.track-button.confirmed{color:#84e9aa}.confirmed-note,.save-error{display:block;margin-top:6px;color:#648b76;font-size:8px}.save-error{color:#d28e8e}.identity-details{margin-top:10px;border-top:1px solid rgba(90,180,205,.09);padding-top:8px;color:#7799a7;font-size:8px}.identity-details summary{cursor:pointer;color:#93b2bc;font-weight:800}.identity-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}.identity-detail-grid>div,.canonical-key,.source-title{background:#04131d;border-radius:6px;padding:7px}.identity-detail-grid span,.canonical-key span,.source-title span{display:block;color:#617f8c;font-size:6px;font-weight:900;letter-spacing:.08em}.identity-detail-grid b{display:block;margin-top:2px;color:#bdd5dc;font-size:9px;text-transform:capitalize}.identity-detail-grid b.high{color:#70efaa}.identity-detail-grid b.medium{color:#f0ca78}.identity-detail-grid b.low{color:#ef8b8b}.canonical-key{margin-top:6px}.canonical-key code{display:block;margin-top:3px;color:#8ec9d8;font-size:7px;word-break:break-all}.source-title{margin:6px 0;color:#7897a2;line-height:1.4}.source-title span{margin-bottom:3px}.identity-details>small{display:block;margin-top:4px;color:#5e7882}.live-sealed-error,.live-sealed-empty{margin-top:12px;padding:11px;border-radius:8px;background:#0a1b25;color:#d39898;font-size:10px}@media(max-width:760px){.live-sealed-inner{padding:16px 14px}.live-sealed-heading{display:block}.live-sealed-heading>b{display:inline-block;margin-top:9px}.live-sealed-search{grid-template-columns:1fr}.identity-grid{grid-template-columns:1fr}.identity-primary{grid-template-columns:92px 1fr}.identity-image{height:92px}.identity-detail-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </section>
  );
}
