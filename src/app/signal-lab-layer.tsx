"use client";

import { FormEvent, useState } from "react";

type Sale = { source: string; id: string; title: string; price: number | null; date: string; marketplace: string; grader?: string; grade?: string; image?: string };
type Identity = { year?: string; setName?: string; manufacturer?: string; cardNumber?: string; playerName?: string; variation?: string; url?: string };
type Result = {
  ok: boolean;
  query: string;
  elapsedMs: number;
  identity: { provider: string; ok: boolean; error?: string | null; candidates: Identity[] };
  market: {
    merged: { count: number; median: number | null; average: number | null; low: number | null; high: number | null };
    sourceAgreement: string;
    disagreementPct: number | null;
    sources: {
      soldComps: { ok: boolean; error?: string | null; count: number; median: number | null; average: number | null; low: number | null; high: number | null };
      cardApi: { ok: boolean; error?: string | null; count: number; median: number | null; average: number | null; low: number | null; high: number | null };
    };
    sales: Sale[];
  };
};

function money(v: number | null | undefined) {
  return v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SignalLabLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Shohei Ohtani 2024 Topps Chrome PSA 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/signal-lab?q=${encodeURIComponent(query.trim())}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Signal Lab request failed");
      setResult(json as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal Lab request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="cs-signal-lab-launch" onClick={() => setOpen(true)}>SIGNAL LAB</button>
      {open && <div className="cs-signal-lab-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
        <section className="cs-signal-lab-modal">
          <button className="cs-signal-lab-close" onClick={() => setOpen(false)}>×</button>
          <div className="cs-signal-lab-head"><span>MULTI-SOURCE ENGINE</span><h2>Signal Lab</h2><p>Cross-check identity and completed-sales data before CardSignal trusts a market value.</p></div>
          <form className="cs-signal-lab-search" onSubmit={run}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
            <button disabled={loading}>{loading ? "ANALYZING…" : "RUN MULTI-SOURCE CHECK"}</button>
          </form>
          {error && <div className="cs-signal-lab-error">{error}</div>}

          {result && <>
            <div className="cs-signal-lab-summary">
              <div><span>MERGED MEDIAN</span><strong>{money(result.market.merged.median)}</strong><small>{result.market.merged.count} deduped sales</small></div>
              <div><span>SOURCE AGREEMENT</span><strong className={`agreement-${result.market.sourceAgreement.toLowerCase().replace(" ", "-")}`}>{result.market.sourceAgreement}</strong><small>{result.market.disagreementPct == null ? "Only one source priced" : `${result.market.disagreementPct}% median spread`}</small></div>
              <div><span>TCDB IDENTITY</span><strong>{result.identity.candidates.length}</strong><small>candidate cards</small></div>
              <div><span>PIPELINE TIME</span><strong>{result.elapsedMs} ms</strong><small>3 sources in parallel</small></div>
            </div>

            <div className="cs-signal-lab-grid">
              <div className="cs-signal-panel">
                <div className="cs-signal-panel-title"><span>CATALOG IDENTITY</span><b>TCDB / Parse</b></div>
                {!result.identity.ok && <div className="cs-signal-mini-error">{result.identity.error || "TCDB lookup failed"}</div>}
                {result.identity.ok && result.identity.candidates.length === 0 && <div className="cs-signal-empty">No identity candidates returned for this broad query.</div>}
                <div className="cs-signal-identities">{result.identity.candidates.slice(0, 8).map((id, i) => <div key={`${id.url}-${i}`} className="cs-signal-identity">
                  <strong>{id.playerName || "Unknown player"}</strong>
                  <span>{[id.year, id.setName, id.cardNumber ? `#${id.cardNumber}` : "", id.variation].filter(Boolean).join(" · ")}</span>
                  <small>{id.manufacturer || "TCDB record"}</small>
                </div>)}</div>
              </div>

              <div className="cs-signal-panel">
                <div className="cs-signal-panel-title"><span>MARKET CROSS-CHECK</span><b>Provider comparison</b></div>
                <div className="cs-source-compare">
                  <div><span>SoldComps</span><strong>{money(result.market.sources.soldComps.median)}</strong><small>{result.market.sources.soldComps.count} sales</small>{!result.market.sources.soldComps.ok && <em>{result.market.sources.soldComps.error}</em>}</div>
                  <div><span>The Card API</span><strong>{money(result.market.sources.cardApi.median)}</strong><small>{result.market.sources.cardApi.count} sales</small>{!result.market.sources.cardApi.ok && <em>{result.market.sources.cardApi.error}</em>}</div>
                </div>
                <div className="cs-signal-range"><span>MERGED RANGE</span><b>{money(result.market.merged.low)} — {money(result.market.merged.high)}</b></div>
              </div>
            </div>

            <div className="cs-signal-panel cs-signal-sales-panel">
              <div className="cs-signal-panel-title"><span>DEDUPED SALES FEED</span><b>{result.market.sales.length} shown</b></div>
              <div className="cs-signal-sales">{result.market.sales.slice(0, 16).map((sale, i) => <div className="cs-signal-sale" key={`${sale.source}-${sale.id}-${i}`}>
                {sale.image ? <img src={sale.image} alt="" /> : <div className="cs-signal-thumb">CS</div>}
                <div><strong>{sale.title}</strong><span>{sale.source} · {sale.marketplace}{sale.grader ? ` · ${sale.grader} ${sale.grade || ""}` : ""}{sale.date ? ` · ${sale.date.slice(0, 10)}` : ""}</span></div>
                <b>{money(sale.price)}</b>
              </div>)}</div>
            </div>
          </>}

          {!result && !loading && !error && <div className="cs-signal-lab-empty">Run a card through all currently connected sources. PSA remains separate until its API approval is active.</div>}
        </section>
      </div>}
      <style jsx global>{`
        .cs-signal-lab-launch{position:fixed;left:24px;bottom:76px;z-index:895;height:38px;padding:0 14px;border:1px solid rgba(87,214,255,.3);border-radius:9px;background:rgba(6,30,46,.92);color:#8be5ff;font-size:9px;font-weight:900;letter-spacing:.12em;cursor:pointer}.cs-signal-lab-launch:hover{border-color:rgba(87,214,255,.58)}
        .cs-signal-lab-backdrop{position:fixed;inset:0;z-index:1450;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.84);backdrop-filter:blur(15px)}.cs-signal-lab-modal{position:relative;width:min(1160px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(75,207,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.72);color:#effaff}.cs-signal-lab-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-signal-lab-head>span,.cs-signal-panel-title span{color:#51d9ff;font-size:9px;font-weight:900;letter-spacing:.16em}.cs-signal-lab-head h2{margin:7px 0 5px;font-size:31px}.cs-signal-lab-head p{margin:0;color:#7896a8;font-size:11px}.cs-signal-lab-search{display:grid;grid-template-columns:1fr auto;gap:10px;margin:18px 0}.cs-signal-lab-search input{height:46px;border:1px solid rgba(82,190,230,.18);border-radius:10px;background:#06131f;color:#ecf9ff;padding:0 14px}.cs-signal-lab-search button{border:1px solid rgba(62,241,154,.42);border-radius:10px;background:rgba(35,173,108,.14);color:#c9ffe2;font-size:9px;font-weight:900;letter-spacing:.1em;padding:0 18px;cursor:pointer}.cs-signal-lab-search button:disabled{opacity:.4}.cs-signal-lab-error,.cs-signal-mini-error{padding:11px;border:1px solid rgba(255,91,111,.24);border-radius:9px;background:rgba(150,30,47,.09);color:#ff9daa;font-size:9px}.cs-signal-lab-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}.cs-signal-lab-summary>div,.cs-source-compare>div,.cs-signal-range{padding:13px;border:1px solid rgba(74,187,229,.13);border-radius:10px;background:rgba(6,24,38,.72)}.cs-signal-lab-summary span,.cs-source-compare span,.cs-signal-range span{display:block;color:#6e8fa2;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-signal-lab-summary strong,.cs-source-compare strong{display:block;margin-top:6px;font-size:18px}.cs-signal-lab-summary small,.cs-source-compare small{display:block;margin-top:3px;color:#57788b;font-size:8px}.agreement-high{color:#62efaa}.agreement-moderate{color:#f0c56d}.agreement-low{color:#ff8291}.agreement-single-source{color:#78bed8}.cs-signal-lab-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.cs-signal-panel{padding:15px;border:1px solid rgba(75,207,255,.15);border-radius:12px;background:rgba(5,20,32,.62)}.cs-signal-panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.cs-signal-panel-title b{font-size:10px;color:#a8c4d2}.cs-signal-identities{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.cs-signal-identity{padding:10px;border:1px solid rgba(76,191,230,.1);border-radius:8px;background:#071724}.cs-signal-identity strong,.cs-signal-identity span,.cs-signal-identity small{display:block}.cs-signal-identity strong{font-size:10px}.cs-signal-identity span{margin-top:4px;color:#8ba8b7;font-size:8px}.cs-signal-identity small{margin-top:4px;color:#58788b;font-size:8px}.cs-source-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cs-source-compare em{display:block;margin-top:5px;color:#ff8291;font-size:8px;font-style:normal}.cs-signal-range{margin-top:8px}.cs-signal-range b{display:block;margin-top:6px;color:#dff8ff;font-size:15px}.cs-signal-sales-panel{margin-top:12px}.cs-signal-sales{display:grid;gap:6px}.cs-signal-sale{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid rgba(76,191,230,.09);border-radius:9px;background:#061522}.cs-signal-sale img,.cs-signal-thumb{width:42px;height:42px;object-fit:cover;border-radius:6px;background:#0a2030}.cs-signal-thumb{display:grid;place-items:center;color:#4bcdf3;font-size:8px}.cs-signal-sale strong{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-signal-sale span{display:block;margin-top:3px;color:#648698;font-size:8px}.cs-signal-sale>b{color:#61efaa;font-size:12px}.cs-signal-lab-empty,.cs-signal-empty{padding:24px;border:1px dashed rgba(86,190,229,.15);border-radius:11px;color:#69899b;text-align:center;font-size:10px}
        @media(max-width:800px){.cs-signal-lab-summary{grid-template-columns:repeat(2,1fr)}.cs-signal-lab-grid{grid-template-columns:1fr}.cs-signal-identities{grid-template-columns:1fr}.cs-signal-lab-search{grid-template-columns:1fr}.cs-signal-lab-search button{height:42px}}
      `}</style>
    </>
  );
}
