"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Sale = { source: string; id: string; title: string; price: number | null; date: string; marketplace: string; grader?: string; grade?: string; image?: string };
type Identity = { year?: string; setName?: string; manufacturer?: string; cardNumber?: string; playerName?: string; variation?: string; sport?: string; url?: string };
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
      soldComps: { ok: boolean; error?: string | null; count: number; rawCount?: number; rejected?: number; median: number | null; average: number | null; low: number | null; high: number | null };
      cardApi: { ok: boolean; error?: string | null; count: number; rawCount?: number; rejected?: number; median: number | null; average: number | null; low: number | null; high: number | null };
    };
    sales: Sale[];
  };
};

type SuggestionResponse = { ok: boolean; suggestions?: Identity[]; error?: string };

function money(v: number | null | undefined) {
  return v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function identityLabel(id: Identity) {
  return [id.year, id.setName, id.cardNumber ? `#${id.cardNumber}` : "", id.variation].filter(Boolean).join(" · ");
}

export default function SignalLabLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Shohei Ohtani 2024 Topps Chrome PSA 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [suggestions, setSuggestions] = useState<Identity[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState<Identity | null>(null);
  const cache = useRef(new Map<string, Identity[]>());

  useEffect(() => {
    if (!open || selected || query.trim().length < 6) {
      if (query.trim().length < 6) setSuggestions([]);
      return;
    }
    const key = query.trim().toLowerCase();
    const cached = cache.current.get(key);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSuggesting(true);
      try {
        const response = await fetch(`/api/card-suggestions?q=${encodeURIComponent(query.trim())}`);
        const json = await response.json() as SuggestionResponse;
        const next = response.ok && json.ok ? (json.suggestions ?? []) : [];
        cache.current.set(key, next);
        setSuggestions(next);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query, open, selected]);

  const selectedText = useMemo(() => selected ? `${selected.playerName || "Card"} · ${identityLabel(selected)}` : "", [selected]);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (selected) {
        if (selected.playerName) params.set("player", selected.playerName);
        if (selected.year) params.set("year", selected.year.slice(0, 4));
        if (selected.setName) params.set("set", selected.setName);
        if (selected.cardNumber) params.set("cardNumber", selected.cardNumber);
        if (selected.variation) params.set("variant", selected.variation);
        if (selected.sport) params.set("sport", selected.sport);
      }
      const response = await fetch(`/api/signal-lab-exact?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Signal Lab request failed");
      setResult(json as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal Lab request failed");
    } finally {
      setLoading(false);
    }
  };

  const choose = (id: Identity) => {
    setSelected(id);
    setSuggestions([]);
    const grade = query.match(/\b(?:PSA|BGS|SGC|CGC)\s*\d+(?:\.5)?\b/i)?.[0] ?? "";
    setQuery([id.playerName, id.year, id.setName, id.cardNumber ? `#${id.cardNumber}` : "", id.variation, grade].filter(Boolean).join(" "));
    setResult(null);
  };

  return (
    <>
      <button className="cs-signal-lab-launch" onClick={() => setOpen(true)}>SIGNAL LAB</button>
      {open && <div className="cs-signal-lab-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
        <section className="cs-signal-lab-modal">
          <button className="cs-signal-lab-close" onClick={() => setOpen(false)}>×</button>
          <div className="cs-signal-lab-head"><span>MULTI-SOURCE ENGINE</span><h2>Signal Lab</h2><p>Select the exact catalog card first, then CardSignal filters both sale feeds against that identity.</p></div>
          <form className="cs-signal-lab-search" onSubmit={run}>
            <div className="cs-smart-search-wrap">
              <input value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null); setResult(null); }} autoComplete="off" />
              {selected && <div className="cs-selected-identity"><span>LOCKED IDENTITY</span><b>{selectedText}</b><button type="button" onClick={() => setSelected(null)}>CHANGE</button></div>}
              {!selected && (suggesting || suggestions.length > 0) && <div className="cs-card-suggestions">
                <div className="cs-suggest-head">{suggesting ? "SEARCHING TCDB…" : "POSSIBLE CARDS — SELECT THE EXACT ONE"}</div>
                {suggestions.map((id, i) => <button type="button" key={`${id.url}-${id.cardNumber}-${i}`} onClick={() => choose(id)}>
                  <strong>{id.playerName || "Unknown player"}</strong>
                  <span>{identityLabel(id) || "TCDB card"}</span>
                  <small>{[id.manufacturer, id.sport].filter(Boolean).join(" · ") || "TCDB / Parse"}</small>
                </button>)}
              </div>}
            </div>
            <button disabled={loading || !selected}>{loading ? "ANALYZING…" : selected ? "RUN EXACT CARD CHECK" : "SELECT CARD FIRST"}</button>
          </form>
          {!selected && <div className="cs-identity-required">Start typing the player, year and set. Pick the exact card from the dropdown before CardSignal calculates market value.</div>}
          {error && <div className="cs-signal-lab-error">{error}</div>}

          {result && <>
            <div className="cs-signal-lab-summary">
              <div><span>MERGED MEDIAN</span><strong>{money(result.market.merged.median)}</strong><small>{result.market.merged.count} accepted sales</small></div>
              <div><span>SOURCE AGREEMENT</span><strong className={`agreement-${result.market.sourceAgreement.toLowerCase().replace(" ", "-")}`}>{result.market.sourceAgreement}</strong><small>{result.market.disagreementPct == null ? "Only one source priced" : `${result.market.disagreementPct}% median spread`}</small></div>
              <div><span>CANONICAL ID</span><strong>{selected?.cardNumber ? `#${selected.cardNumber}` : "LOCKED"}</strong><small>{selected?.variation || selected?.setName || "TCDB identity"}</small></div>
              <div><span>PIPELINE TIME</span><strong>{result.elapsedMs} ms</strong><small>3 sources in parallel</small></div>
            </div>

            <div className="cs-signal-lab-grid">
              <div className="cs-signal-panel">
                <div className="cs-signal-panel-title"><span>CATALOG IDENTITY</span><b>TCDB / Parse</b></div>
                <div className="cs-canonical-card"><strong>{selected?.playerName}</strong><span>{selected && identityLabel(selected)}</span><small>{selected?.manufacturer || "TCDB record"}</small></div>
              </div>
              <div className="cs-signal-panel">
                <div className="cs-signal-panel-title"><span>MARKET CROSS-CHECK</span><b>Exact-card filtering</b></div>
                <div className="cs-source-compare">
                  <div><span>SoldComps</span><strong>{money(result.market.sources.soldComps.median)}</strong><small>{result.market.sources.soldComps.count} accepted · {result.market.sources.soldComps.rejected ?? 0} rejected</small>{!result.market.sources.soldComps.ok && <em>{result.market.sources.soldComps.error}</em>}</div>
                  <div><span>The Card API</span><strong>{money(result.market.sources.cardApi.median)}</strong><small>{result.market.sources.cardApi.count} accepted · {result.market.sources.cardApi.rejected ?? 0} rejected</small>{!result.market.sources.cardApi.ok && <em>{result.market.sources.cardApi.error}</em>}</div>
                </div>
                <div className="cs-signal-range"><span>MERGED RANGE</span><b>{money(result.market.merged.low)} — {money(result.market.merged.high)}</b></div>
              </div>
            </div>

            <div className="cs-signal-panel cs-signal-sales-panel">
              <div className="cs-signal-panel-title"><span>IDENTITY-MATCHED SALES FEED</span><b>{result.market.sales.length} shown</b></div>
              <div className="cs-signal-sales">{result.market.sales.slice(0, 16).map((sale, i) => <div className="cs-signal-sale" key={`${sale.source}-${sale.id}-${i}`}>
                {sale.image ? <img src={sale.image} alt="" /> : <div className="cs-signal-thumb">CS</div>}
                <div><strong>{sale.title}</strong><span>{sale.source} · {sale.marketplace}{sale.grader ? ` · ${sale.grader} ${sale.grade || ""}` : ""}{sale.date ? ` · ${sale.date.slice(0, 10)}` : ""}</span></div>
                <b>{money(sale.price)}</b>
              </div>)}</div>
            </div>
          </>}

          {!result && !loading && !error && selected && <div className="cs-signal-lab-empty">Exact identity locked. Run the check to filter SoldComps and The Card API to this card.</div>}
        </section>
      </div>}
      <style jsx global>{`
        .cs-signal-lab-launch{position:fixed;left:24px;bottom:76px;z-index:895;height:38px;padding:0 14px;border:1px solid rgba(87,214,255,.3);border-radius:9px;background:rgba(6,30,46,.92);color:#8be5ff;font-size:9px;font-weight:900;letter-spacing:.12em;cursor:pointer}.cs-signal-lab-backdrop{position:fixed;inset:0;z-index:1450;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.84);backdrop-filter:blur(15px)}.cs-signal-lab-modal{position:relative;width:min(1160px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(75,207,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.72);color:#effaff}.cs-signal-lab-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-signal-lab-head>span,.cs-signal-panel-title span{color:#51d9ff;font-size:9px;font-weight:900;letter-spacing:.16em}.cs-signal-lab-head h2{margin:7px 0 5px;font-size:31px}.cs-signal-lab-head p{margin:0;color:#7896a8;font-size:11px}.cs-signal-lab-search{display:grid;grid-template-columns:1fr auto;gap:10px;margin:18px 0 8px}.cs-smart-search-wrap{position:relative}.cs-signal-lab-search input{width:100%;height:46px;border:1px solid rgba(82,190,230,.18);border-radius:10px;background:#06131f;color:#ecf9ff;padding:0 14px}.cs-signal-lab-search>button{border:1px solid rgba(62,241,154,.42);border-radius:10px;background:rgba(35,173,108,.14);color:#c9ffe2;font-size:9px;font-weight:900;letter-spacing:.1em;padding:0 18px;cursor:pointer}.cs-signal-lab-search>button:disabled{opacity:.4;cursor:not-allowed}.cs-card-suggestions{position:absolute;z-index:50;left:0;right:0;top:52px;max-height:350px;overflow:auto;padding:7px;border:1px solid rgba(75,207,255,.28);border-radius:11px;background:#061522;box-shadow:0 22px 60px rgba(0,0,0,.7)}.cs-suggest-head{padding:7px 9px;color:#61dcff;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-card-suggestions button{display:block;width:100%;padding:10px;text-align:left;border:0;border-top:1px solid rgba(82,190,230,.09);background:transparent;color:#e8f8ff;cursor:pointer}.cs-card-suggestions button:hover{background:rgba(45,190,141,.09)}.cs-card-suggestions strong,.cs-card-suggestions span,.cs-card-suggestions small{display:block}.cs-card-suggestions strong{font-size:10px}.cs-card-suggestions span{margin-top:3px;color:#9bb6c4;font-size:9px}.cs-card-suggestions small{margin-top:3px;color:#5f7f91;font-size:8px}.cs-selected-identity{display:flex;align-items:center;gap:8px;margin-top:7px;padding:8px 10px;border:1px solid rgba(62,241,154,.22);border-radius:8px;background:rgba(35,173,108,.07)}.cs-selected-identity span{color:#59eaa0;font-size:7px;font-weight:900;letter-spacing:.12em}.cs-selected-identity b{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.cs-selected-identity button{border:0;background:none;color:#70dfff;font-size:8px;font-weight:900;cursor:pointer}.cs-identity-required{margin-bottom:12px;padding:10px 12px;border:1px solid rgba(240,197,109,.18);border-radius:8px;background:rgba(180,120,20,.06);color:#d9bb78;font-size:9px}.cs-signal-lab-error,.cs-signal-mini-error{padding:11px;border:1px solid rgba(255,91,111,.24);border-radius:9px;background:rgba(150,30,47,.09);color:#ff9daa;font-size:9px}.cs-signal-lab-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}.cs-signal-lab-summary>div,.cs-source-compare>div,.cs-signal-range{padding:13px;border:1px solid rgba(74,187,229,.13);border-radius:10px;background:rgba(6,24,38,.72)}.cs-signal-lab-summary span,.cs-source-compare span,.cs-signal-range span{display:block;color:#6e8fa2;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-signal-lab-summary strong,.cs-source-compare strong{display:block;margin-top:6px;font-size:18px}.cs-signal-lab-summary small,.cs-source-compare small{display:block;margin-top:3px;color:#57788b;font-size:8px}.agreement-high{color:#62efaa}.agreement-moderate{color:#f0c56d}.agreement-low{color:#ff8291}.agreement-single-source{color:#78bed8}.cs-signal-lab-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.cs-signal-panel{padding:15px;border:1px solid rgba(75,207,255,.15);border-radius:12px;background:rgba(5,20,32,.62)}.cs-signal-panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.cs-signal-panel-title b{font-size:10px;color:#a8c4d2}.cs-canonical-card{padding:16px;border:1px solid rgba(62,241,154,.18);border-radius:10px;background:rgba(35,173,108,.06)}.cs-canonical-card strong,.cs-canonical-card span,.cs-canonical-card small{display:block}.cs-canonical-card strong{font-size:13px}.cs-canonical-card span{margin-top:5px;color:#b8d2dc;font-size:10px}.cs-canonical-card small{margin-top:5px;color:#66899a;font-size:8px}.cs-source-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cs-source-compare em{display:block;margin-top:5px;color:#ff8291;font-size:8px;font-style:normal}.cs-signal-range{margin-top:8px}.cs-signal-range b{display:block;margin-top:6px;color:#dff8ff;font-size:15px}.cs-signal-sales-panel{margin-top:12px}.cs-signal-sales{display:grid;gap:6px}.cs-signal-sale{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid rgba(76,191,230,.09);border-radius:9px;background:#061522}.cs-signal-sale img,.cs-signal-thumb{width:42px;height:42px;object-fit:cover;border-radius:6px;background:#0a2030}.cs-signal-thumb{display:grid;place-items:center;color:#4bcdf3;font-size:8px}.cs-signal-sale strong{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-signal-sale span{display:block;margin-top:3px;color:#648698;font-size:8px}.cs-signal-sale>b{color:#61efaa;font-size:12px}.cs-signal-lab-empty{padding:24px;border:1px dashed rgba(86,190,229,.15);border-radius:11px;color:#69899b;text-align:center;font-size:10px}@media(max-width:800px){.cs-signal-lab-summary{grid-template-columns:repeat(2,1fr)}.cs-signal-lab-grid{grid-template-columns:1fr}.cs-signal-lab-search{grid-template-columns:1fr}.cs-signal-lab-search>button{height:42px}}
      `}</style>
    </>
  );
}
