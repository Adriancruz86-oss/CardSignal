"use client";

import { FormEvent, useMemo, useState } from "react";

type Comp = {
  id: string;
  title: string;
  soldPrice: number | null;
  shippingCost: number | null;
  soldDate: string;
  condition: string;
  url: string;
  image: string;
  marketplace: string;
};

type MarketResponse = {
  ok: boolean;
  source?: string;
  fetchedAt?: string;
  query?: string;
  comps?: Comp[];
  error?: string;
  setupRequired?: boolean;
};

type MatchBand = "Exact" | "Strong" | "Loose" | "Rejected";

type ScoredComp = Comp & {
  matchScore: number;
  band: MatchBand;
  reason: string;
  defaultIncluded: boolean;
};

const INSERT_TERMS = [
  "instant impact", "emergent", "global reach", "deca brilliance", "deep space",
  "dominance", "fireworks", "get hyped", "luck of the lottery", "rookie revolution",
  "stock attack", "hoops premium", "monopoly", "breakaway", "green wave", "ice",
];

const VARIANT_TERMS = [
  "silver", "refractor", "gold", "green", "red", "blue", "orange", "purple", "pink",
  "wave", "shimmer", "scope", "holo", "optic", "prizm", "chrome", "auto", "autograph",
  "numbered", "rookie", "rc", "base",
];

function money(value: number | null | undefined) {
  return value == null ? "—" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9#]+/g, " ").replace(/\s+/g, " ").trim();
}

function words(value: string) {
  return normalize(value).split(" ").filter((word) => word.length > 1);
}

function extractYear(value: string) {
  return normalize(value).match(/\b(?:19|20)\d{2}(?:\s?24)?\b/)?.[0] ?? "";
}

function extractGrader(value: string) {
  return normalize(value).match(/\b(psa|bgs|sgc|cgc)\b/)?.[1]?.toUpperCase() ?? "";
}

function extractGrade(value: string) {
  const match = normalize(value).match(/\b(?:psa|bgs|sgc|cgc)\s*(10|9\.5|9|8\.5|8|7\.5|7)\b/);
  return match?.[1] ?? "";
}

function extractCardNumber(value: string) {
  const clean = normalize(value);
  const explicit = clean.match(/#\s*([a-z0-9-]+)/)?.[1];
  if (explicit) return explicit;
  const card = clean.match(/\b(?:card|no|number)\s*#?\s*([a-z0-9-]+)\b/)?.[1];
  return card ?? "";
}

function titleCardNumber(value: string) {
  const clean = normalize(value);
  return clean.match(/#\s*([a-z0-9-]+)/)?.[1] ?? "";
}

function scoreComp(query: string, comp: Comp): ScoredComp {
  const q = normalize(query);
  const t = normalize(comp.title);
  const queryWords = words(query).filter((word) => !["panini", "card", "the", "and"].includes(word));
  const titleSet = new Set(words(comp.title));

  let score = 0;
  const notes: string[] = [];
  let hardReject = false;

  const tokenMatches = queryWords.filter((word) => titleSet.has(word)).length;
  score += queryWords.length ? Math.round((tokenMatches / queryWords.length) * 44) : 0;

  const qYear = extractYear(query);
  const tYear = extractYear(comp.title);
  if (qYear) {
    if (t.includes(qYear.slice(0, 4))) { score += 12; notes.push("year"); }
    else if (tYear) { hardReject = true; notes.push("wrong year"); }
  }

  const qGrader = extractGrader(query);
  const tGrader = extractGrader(comp.title);
  if (qGrader) {
    if (tGrader === qGrader) { score += 10; notes.push(qGrader); }
    else if (tGrader) { hardReject = true; notes.push(`wrong grader ${tGrader}`); }
    else { score -= 8; notes.push("grader unclear"); }
  }

  const qGrade = extractGrade(query);
  const tGrade = extractGrade(comp.title);
  if (qGrade) {
    if (tGrade === qGrade) { score += 10; notes.push(`grade ${qGrade}`); }
    else if (tGrade) { hardReject = true; notes.push(`wrong grade ${tGrade}`); }
    else { score -= 7; notes.push("grade unclear"); }
  }

  const qNumber = extractCardNumber(query);
  const tNumber = titleCardNumber(comp.title);
  if (qNumber) {
    if (tNumber === qNumber) { score += 16; notes.push(`#${qNumber}`); }
    else if (tNumber) { hardReject = true; notes.push(`wrong #${tNumber}`); }
    else { score -= 12; notes.push("card # unclear"); }
  }

  const qVariants = VARIANT_TERMS.filter((term) => q.includes(term));
  const matchedVariants = qVariants.filter((term) => t.includes(term));
  if (qVariants.length) {
    score += Math.round((matchedVariants.length / qVariants.length) * 12);
    if (matchedVariants.length < qVariants.length) notes.push("variant incomplete");
  }

  const conflictingInsert = INSERT_TERMS.find((term) => t.includes(term) && !q.includes(term));
  if (conflictingInsert) {
    hardReject = true;
    notes.push(`different insert: ${conflictingInsert}`);
  }

  score = Math.max(0, Math.min(100, score));
  let band: MatchBand = hardReject ? "Rejected" : score >= 88 ? "Exact" : score >= 70 ? "Strong" : score >= 54 ? "Loose" : "Rejected";
  if (comp.soldPrice == null) band = "Rejected";

  return {
    ...comp,
    matchScore: score,
    band,
    reason: notes.slice(0, 3).join(" · ") || `${tokenMatches}/${queryWords.length} query terms`,
    defaultIncluded: band === "Exact" || band === "Strong",
  };
}

function calcSummary(items: ScoredComp[]) {
  const prices = items.map((item) => item.soldPrice).filter((value): value is number => value != null).sort((a, b) => a - b);
  if (!prices.length) return { count: 0, median: null as number | null, average: null as number | null, low: null as number | null, high: null as number | null };
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  return { count: prices.length, median: Math.round(median * 100) / 100, average: Math.round(average * 100) / 100, low: prices[0], high: prices[prices.length - 1] };
}

export default function LiveMarketLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Victor Wembanyama 2023 Prizm Silver PSA 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [data, setData] = useState<MarketResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const scored = useMemo(() => (data?.comps ?? []).map((comp) => scoreComp(data?.query || query, comp)), [data, query]);
  const included = useMemo(() => scored.filter((comp, index) => overrides[comp.id || String(index)] ?? comp.defaultIncluded), [scored, overrides]);
  const summary = useMemo(() => calcSummary(included), [included]);
  const rejectedCount = scored.length - included.length;
  const avgMatch = included.length ? Math.round(included.reduce((sum, item) => sum + item.matchScore, 0) / included.length) : 0;
  const confidence: MatchBand = included.length >= 3 && avgMatch >= 88 ? "Exact" : included.length >= 3 && avgMatch >= 70 ? "Strong" : included.length ? "Loose" : "Rejected";
  const usable = (confidence === "Exact" || confidence === "Strong") && included.length >= 3 && summary.median != null;

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(""); setSetupRequired(false); setData(null); setOverrides({}); setSaved(false);
    try {
      const response = await fetch(`/api/market?q=${encodeURIComponent(query.trim())}`);
      const json = await response.json() as MarketResponse;
      if (!response.ok || !json.ok) { setSetupRequired(Boolean(json.setupRequired)); throw new Error(json.error || "Live comp search failed"); }
      setData(json);
    } catch (err) { setError(err instanceof Error ? err.message : "Live comp search failed"); }
    finally { setLoading(false); }
  };

  const toggle = (comp: ScoredComp, index: number) => {
    const key = comp.id || String(index);
    const current = overrides[key] ?? comp.defaultIncluded;
    setOverrides((previous) => ({ ...previous, [key]: !current }));
    setSaved(false);
  };

  const useValuation = () => {
    if (!usable || summary.median == null) return;
    const valuation = {
      query: data?.query || query,
      median: summary.median,
      average: summary.average,
      low: summary.low,
      high: summary.high,
      compCount: summary.count,
      confidence,
      matchScore: avgMatch,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("cardsignal-live-valuation", JSON.stringify(valuation));
    window.dispatchEvent(new CustomEvent("cardsignal:valuation", { detail: valuation }));
    setSaved(true);
  };

  return (
    <>
      <button className="cs-live-launch" onClick={() => setOpen(true)}><span /> LIVE MARKET</button>
      {open && (
        <div className="cs-live-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="cs-live-modal">
            <button className="cs-live-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="cs-live-head"><span>REAL MARKET DATA</span><h2>Smart sold comps</h2><p>CardSignal filters raw sold listings for the exact card before calculating a valuation.</p></div>
            <form className="cs-live-search" onSubmit={search}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="2024 Topps Chrome #172 Jackson Holliday Refractor PSA 10" /><button disabled={loading}>{loading ? "SEARCHING…" : "SEARCH SOLD COMPS"}</button></form>

            {error && <div className={`cs-live-error ${setupRequired ? "setup" : ""}`}><strong>{setupRequired ? "ONE-TIME API SETUP" : "LIVE DATA ERROR"}</strong><span>{error}</span></div>}
            {!data && !loading && !error && <div className="cs-live-empty">Search for a card to pull recent sold listings.</div>}

            {data && (
              <div className="cs-live-detail">
                <div className="cs-match-banner">
                  <div><span>VALUATION CONFIDENCE</span><strong className={`band-${confidence.toLowerCase()}`}>{confidence}</strong><small>{avgMatch}% average title match</small></div>
                  <div><span>ACCEPTED</span><strong>{included.length}</strong><small>used in valuation</small></div>
                  <div><span>REJECTED</span><strong>{rejectedCount}</strong><small>excluded from stats</small></div>
                  <button disabled={!usable} onClick={useValuation}>{saved ? "VALUATION SAVED ✓" : usable ? "USE THIS VALUATION" : "NEED 3 STRONG COMPS"}</button>
                </div>

                <div className="cs-live-summary">
                  <div><span>FILTERED MEDIAN</span><strong>{money(summary.median)}</strong></div>
                  <div><span>FILTERED AVERAGE</span><strong>{money(summary.average)}</strong></div>
                  <div><span>LOW</span><strong>{money(summary.low)}</strong></div>
                  <div><span>HIGH</span><strong>{money(summary.high)}</strong></div>
                  <div><span>COMPS USED</span><strong>{summary.count}</strong></div>
                </div>

                <div className="cs-live-section"><span>COMP REVIEW</span><b>{data.query}</b></div>
                <div className="cs-live-comps">
                  {scored.length === 0 ? <div className="cs-live-empty">No sold listings returned.</div> : scored.map((comp, index) => {
                    const key = comp.id || String(index);
                    const isIncluded = overrides[key] ?? comp.defaultIncluded;
                    return (
                      <div className={`cs-live-comp ${isIncluded ? "included" : "excluded"}`} key={key}>
                        <button className={`cs-comp-toggle ${isIncluded ? "on" : ""}`} onClick={() => toggle(comp, index)} aria-label={isIncluded ? "Exclude comp" : "Include comp"}>{isIncluded ? "✓" : "+"}</button>
                        {comp.image ? <img src={comp.image} alt="" /> : <div className="cs-live-thumb">CS</div>}
                        <div className="cs-live-comp-copy"><div className="cs-comp-titleline"><strong>{comp.title}</strong><em className={`band-${comp.band.toLowerCase()}`}>{comp.band} · {comp.matchScore}%</em></div><span>{comp.reason}{comp.soldDate ? ` · ${comp.soldDate.slice(0, 10)}` : ""}</span></div>
                        <div className="cs-live-price"><b>{money(comp.soldPrice)}</b>{comp.shippingCost != null && comp.shippingCost > 0 && <small>+ {money(comp.shippingCost)} ship</small>}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="cs-live-note"><b>HOW THIS IS BETTER</b><p>Only accepted comps drive the valuation. Different inserts, years, grades, graders and card numbers are rejected automatically. You can override any comp with the +/- control.</p></div>
              </div>
            )}
            <div className="cs-live-attribution">Sold-market data via SoldComps · Matching by CardSignal</div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .cs-live-launch{position:fixed;right:24px;bottom:24px;z-index:900;height:42px;padding:0 16px;border:1px solid rgba(65,241,155,.42);border-radius:10px;background:linear-gradient(180deg,rgba(33,193,115,.2),rgba(4,30,20,.9));color:#bfffdc;font-size:10px;font-weight:900;letter-spacing:.12em;cursor:pointer}.cs-live-launch span{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#4ff1a0;box-shadow:0 0 12px #4ff1a0}
        .cs-live-backdrop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.82);backdrop-filter:blur(15px)}.cs-live-modal{position:relative;width:min(1120px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(75,207,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.72);color:#effaff}.cs-live-modal:before{content:"";position:absolute;left:0;top:0;width:250px;height:2px;background:linear-gradient(90deg,#45f19a,transparent)}.cs-live-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-live-head>span{color:#51d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-live-head h2{margin:7px 0 5px;font-size:31px}.cs-live-head p{margin:0;color:#7896a8;font-size:12px}.cs-live-search{display:grid;grid-template-columns:1fr auto;gap:10px;margin:24px 0 18px}.cs-live-search input{height:46px;border:1px solid rgba(82,190,230,.18);border-radius:10px;background:#06131f;color:#ecf9ff;padding:0 14px}.cs-live-search button,.cs-match-banner button{border:1px solid rgba(62,241,154,.42);border-radius:10px;background:rgba(35,173,108,.14);color:#c9ffe2;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer}.cs-live-search button{height:46px;padding:0 18px}.cs-live-search button:disabled,.cs-match-banner button:disabled{opacity:.4;cursor:not-allowed}.cs-live-error{padding:13px;border:1px solid rgba(255,91,111,.25);border-radius:9px;color:#ff9daa}.cs-live-error strong,.cs-live-error span{display:block}.cs-live-error span{margin-top:5px;font-size:11px}.cs-live-empty{padding:28px;border:1px dashed rgba(86,190,229,.15);border-radius:11px;color:#69899b;text-align:center;font-size:11px}
        .cs-match-banner{display:grid;grid-template-columns:1.4fr .7fr .7fr 1.1fr;gap:9px;margin-bottom:10px}.cs-match-banner>div,.cs-match-banner>button{min-height:74px;padding:13px;border-radius:10px}.cs-match-banner>div{border:1px solid rgba(74,187,229,.13);background:rgba(6,24,38,.72)}.cs-match-banner span,.cs-live-summary span{display:block;color:#6e8fa2;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-match-banner strong{display:block;margin-top:5px;font-size:20px}.cs-match-banner small{display:block;margin-top:3px;color:#607f91;font-size:8px}.band-exact{color:#67f3aa!important}.band-strong{color:#63dfff!important}.band-loose{color:#ffd36a!important}.band-rejected{color:#ff7586!important}
        .cs-live-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:10px 0 18px}.cs-live-summary>div{padding:14px;border:1px solid rgba(74,187,229,.13);border-radius:10px;background:rgba(6,24,38,.72)}.cs-live-summary strong{display:block;margin-top:6px;font-size:18px}.cs-live-summary>div:first-child strong{color:#62efaa}.cs-live-section{display:flex;justify-content:space-between;gap:20px;margin:18px 0 10px}.cs-live-section span{color:#50d9ff;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-live-section b{color:#8ca8b7;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cs-live-comps{display:grid;gap:7px}.cs-live-comp{display:grid;grid-template-columns:32px 52px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(78,183,224,.11);border-radius:10px;background:rgba(7,24,38,.68);transition:.18s}.cs-live-comp.excluded{opacity:.48}.cs-live-comp.included{border-color:rgba(73,224,165,.16)}.cs-comp-toggle{width:28px;height:28px;border:1px solid rgba(86,190,229,.2);border-radius:7px;background:#06141f;color:#7b9bad;cursor:pointer}.cs-comp-toggle.on{border-color:rgba(68,238,156,.35);color:#5cf0a5;background:rgba(35,174,108,.1)}.cs-live-comp>img,.cs-live-thumb{width:52px;height:52px;border-radius:7px;object-fit:cover;background:#0a2030}.cs-live-thumb{display:grid;place-items:center;color:#4bcdf3;font-size:10px;font-weight:900}.cs-live-comp-copy{min-width:0}.cs-comp-titleline{display:flex;align-items:center;gap:8px;min-width:0}.cs-comp-titleline strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.cs-comp-titleline em{flex:none;font-size:8px;font-style:normal;font-weight:900}.cs-live-comp-copy>span{display:block;margin-top:4px;color:#69899b;font-size:9px}.cs-live-price{text-align:right}.cs-live-price b{display:block;color:#61efaa;font-size:14px}.cs-live-price small{display:block;margin-top:3px;color:#6f8fa0;font-size:8px}.cs-live-note{margin-top:16px;padding:13px;border:1px solid rgba(64,218,255,.14);border-radius:10px;background:rgba(19,79,103,.1)}.cs-live-note b{color:#55d9ff;font-size:8px}.cs-live-note p{margin:6px 0 0;color:#91adbc;font-size:10px;line-height:1.5}.cs-live-attribution{margin-top:18px;text-align:right;color:#506f80;font-size:9px}
        @media(max-width:780px){.cs-live-modal{padding:22px 16px}.cs-live-search,.cs-match-banner{grid-template-columns:1fr}.cs-live-summary{grid-template-columns:repeat(2,1fr)}.cs-live-comp{grid-template-columns:28px 42px 1fr}.cs-live-comp>img,.cs-live-thumb{width:42px;height:42px}.cs-live-price{grid-column:3;text-align:left}.cs-live-section{flex-direction:column;gap:5px}}
      `}</style>
    </>
  );
}
