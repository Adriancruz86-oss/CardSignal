"use client";

import { FormEvent, useState } from "react";

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

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function LiveSealedDiscovery() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Sports" | "Pokémon">("Sports");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResponseData | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/sealed-discovery?q=${encodeURIComponent(query.trim())}&category=${encodeURIComponent(category)}`, { cache: "no-store" });
      const data = await response.json() as ResponseData;
      setResult(data);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Discovery failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="live-sealed-discovery">
      <div className="live-sealed-inner">
        <div className="live-sealed-heading">
          <div>
            <span>LIVE SEALED DISCOVERY</span>
            <h2>Find the product first. Confirm the exact SKU second.</h2>
            <p>CardSignal searches configured sold-market providers for sealed-product evidence, groups listings into product identities, and refuses to treat marketplace titles as exact catalog truth until you confirm them.</p>
          </div>
          <b>{result?.provider ? `LIVE · ${result.provider}` : "PROVIDER READY"}</b>
        </div>

        <form onSubmit={search} className="live-sealed-search">
          <select value={category} onChange={(e) => setCategory(e.target.value as "Sports" | "Pokémon")}>
            <option>Sports</option>
            <option>Pokémon</option>
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try: 2026 Topps Chrome hobby box" />
          <button disabled={loading || query.trim().length < 3}>{loading ? "Searching…" : "Search live market"}</button>
        </form>

        {result && !result.ok && <div className="live-sealed-error">{result.error || "Live discovery failed."}</div>}

        {result?.ok && (
          <>
            <div className="live-sealed-meta">
              <span>{result.scannedListings ?? 0} marketplace records scanned</span>
              <span>{result.candidates?.length ?? 0} sealed identities found</span>
              <span>{result.fetchedAt ? `Fetched ${new Date(result.fetchedAt).toLocaleString()}` : ""}</span>
            </div>
            {result.identityNote && <p className="identity-warning">{result.identityNote}</p>}
            <div className="identity-grid">
              {(result.candidates ?? []).map((candidate) => {
                const isConfirmed = Boolean(confirmed[candidate.canonicalKey]);
                return (
                  <article className="identity-card" key={candidate.canonicalKey}>
                    <div className="identity-head">
                      <div>
                        <span>{candidate.category} · {candidate.format ?? "Format unknown"}</span>
                        <h3>{[candidate.year, candidate.brand, candidate.line].filter(Boolean).join(" ")}</h3>
                      </div>
                      <b className={`identity-confidence ${candidate.confidence}`}>{candidate.confidence} ID</b>
                    </div>
                    <div className="identity-evidence">
                      <div><span>MARKET MEDIAN</span><b>{money(candidate.marketMedian)}</b></div>
                      <div><span>EVIDENCE</span><b>{candidate.evidenceCount}</b></div>
                      <div><span>PRICED SALES</span><b>{candidate.pricedEvidenceCount}</b></div>
                      <div><span>LAST SALE</span><b>{candidate.lastSaleDate ? candidate.lastSaleDate.slice(0, 10) : "—"}</b></div>
                    </div>
                    <div className="canonical-key"><span>CANONICAL SKU KEY</span><code>{candidate.canonicalKey}</code></div>
                    <details>
                      <summary>See source listing title</summary>
                      <p>{candidate.sampleTitle}</p>
                    </details>
                    <button className={isConfirmed ? "confirmed" : ""} onClick={() => setConfirmed((old) => ({ ...old, [candidate.canonicalKey]: !isConfirmed }))}>
                      {isConfirmed ? "✓ Exact identity confirmed" : "Confirm exact SKU identity"}
                    </button>
                    {isConfirmed && <small className="confirmed-note">Confirmed for this session. Persistent catalog storage is the next data pass.</small>}
                  </article>
                );
              })}
            </div>
            {result.candidates?.length === 0 && <div className="live-sealed-empty">No sealed-product identities survived the exact-product filters. Try including the year, product line and format, such as “2026 Topps Chrome hobby box”.</div>}
          </>
        )}
      </div>
      <style jsx>{`
        .live-sealed-discovery{background:#03111b;color:#d8edf5;border-bottom:1px solid rgba(87,220,255,.15);font-family:Arial,sans-serif}.live-sealed-inner{max-width:1360px;margin:0 auto;padding:22px 24px}.live-sealed-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.live-sealed-heading span{font-size:10px;font-weight:900;letter-spacing:.14em;color:#5ee6ff}.live-sealed-heading h2{margin:6px 0 5px;font-size:22px}.live-sealed-heading p{max-width:850px;margin:0;color:#7899a8;font-size:12px;line-height:1.55}.live-sealed-heading>b{font-size:9px;color:#6ef0ab;border:1px solid rgba(110,240,171,.25);padding:7px 9px;border-radius:7px;white-space:nowrap}.live-sealed-search{display:grid;grid-template-columns:130px 1fr auto;gap:8px;margin-top:17px}.live-sealed-search select,.live-sealed-search input,.live-sealed-search button{min-height:42px;border:1px solid rgba(86,199,235,.2);border-radius:8px;background:#071d2b;color:#cce8f2;padding:0 12px}.live-sealed-search button{font-weight:900;color:#9ff6c4;border-color:rgba(90,235,157,.32);cursor:pointer}.live-sealed-meta{display:flex;gap:18px;flex-wrap:wrap;margin:15px 0 8px;color:#6f929f;font-size:9px}.identity-warning{font-size:10px;color:#d5b97b}.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.identity-card{border:1px solid rgba(83,198,235,.15);background:#061925;border-radius:10px;padding:14px}.identity-head{display:flex;justify-content:space-between;gap:12px}.identity-head span{font-size:8px;color:#63cfea;text-transform:uppercase}.identity-head h3{font-size:15px;margin:5px 0}.identity-confidence{font-size:8px;padding:5px 7px;border-radius:6px;height:max-content;text-transform:uppercase}.identity-confidence.high{color:#70efaa;background:rgba(60,200,130,.1)}.identity-confidence.medium{color:#f0ca78;background:rgba(220,170,70,.1)}.identity-confidence.low{color:#ef8b8b;background:rgba(220,80,80,.1)}.identity-evidence{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.identity-evidence div{background:#04131d;border:1px solid rgba(80,180,215,.08);border-radius:7px;padding:8px}.identity-evidence span,.canonical-key span{display:block;color:#617f8c;font-size:7px;font-weight:900;letter-spacing:.07em}.identity-evidence b{display:block;margin-top:3px;font-size:12px}.canonical-key{padding:9px;background:#04131d;border-radius:7px}.canonical-key code{display:block;margin-top:4px;color:#8ec9d8;font-size:8px;word-break:break-all}.identity-card details{margin:9px 0;color:#7799a7;font-size:9px}.identity-card details p{line-height:1.45}.identity-card>button{width:100%;min-height:36px;border:1px solid rgba(86,205,240,.2);background:#082333;color:#9cd6e7;border-radius:7px;font-weight:800;cursor:pointer}.identity-card>button.confirmed{color:#91f0b8;border-color:rgba(83,230,145,.3);background:rgba(40,150,95,.1)}.confirmed-note{display:block;margin-top:6px;color:#648b76}.live-sealed-error,.live-sealed-empty{margin-top:12px;padding:11px;border-radius:8px;background:#0a1b25;color:#d39898;font-size:11px}.live-sealed-empty{color:#779aa8}@media(max-width:760px){.live-sealed-inner{padding:16px 14px}.live-sealed-heading{display:block}.live-sealed-heading>b{display:inline-block;margin-top:10px}.live-sealed-search{grid-template-columns:1fr}.identity-grid{grid-template-columns:1fr}.identity-evidence{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </section>
  );
}
