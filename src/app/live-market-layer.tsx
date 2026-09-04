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
  totalItems?: number;
  totalResults?: string | number | null;
  summary?: {
    count: number;
    average: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
  };
  comps?: Comp[];
  error?: string;
  setupRequired?: boolean;
};

function money(value: number | null | undefined) {
  return value == null ? "—" : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LiveMarketLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Victor Wembanyama 2023 Prizm Silver PSA 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [data, setData] = useState<MarketResponse | null>(null);

  const comps = useMemo(() => data?.comps ?? [], [data]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSetupRequired(false);
    setData(null);

    try {
      const response = await fetch(`/api/market?q=${encodeURIComponent(query.trim())}`);
      const json = await response.json() as MarketResponse;
      if (!response.ok || !json.ok) {
        setSetupRequired(Boolean(json.setupRequired));
        throw new Error(json.error || "Live comp search failed");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live comp search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="cs-live-launch" onClick={() => setOpen(true)}><span /> LIVE MARKET</button>

      {open && (
        <div className="cs-live-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="cs-live-modal">
            <button className="cs-live-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="cs-live-head">
              <span>REAL MARKET DATA</span>
              <h2>Live sold comps</h2>
              <p>Search the exact card. CardSignal pulls recent completed sales and calculates a comp range from the returned results.</p>
            </div>

            <form className="cs-live-search" onSubmit={search}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="2024 Topps Chrome Jackson Holliday PSA 10" />
              <button disabled={loading}>{loading ? "SEARCHING…" : "SEARCH SOLD COMPS"}</button>
            </form>

            {error && (
              <div className={`cs-live-error ${setupRequired ? "setup" : ""}`}>
                <strong>{setupRequired ? "ONE-TIME API SETUP" : "LIVE DATA ERROR"}</strong>
                <span>{error}</span>
                {setupRequired && <small>The free provider allows 100 requests/month with no credit card. The key stays only on your server in .env.local.</small>}
              </div>
            )}

            {!data && !loading && !error && <div className="cs-live-empty">Search for a card to pull recent sold listings.</div>}

            {data && (
              <div className="cs-live-detail">
                <div className="cs-live-summary">
                  <div><span>MEDIAN SOLD</span><strong>{money(data.summary?.median)}</strong></div>
                  <div><span>AVERAGE SOLD</span><strong>{money(data.summary?.average)}</strong></div>
                  <div><span>LOW</span><strong>{money(data.summary?.low)}</strong></div>
                  <div><span>HIGH</span><strong>{money(data.summary?.high)}</strong></div>
                  <div><span>COMPS</span><strong>{data.summary?.count ?? comps.length}</strong></div>
                </div>

                <div className="cs-live-section"><span>RECENT SOLD LISTINGS</span><b>{data.query}</b></div>

                <div className="cs-live-comps">
                  {comps.length === 0 ? (
                    <div className="cs-live-empty">No matching sold listings were returned. Try removing one descriptor or grade.</div>
                  ) : comps.map((comp, index) => (
                    <div className="cs-live-comp" key={comp.id || index}>
                      {comp.image ? <img src={comp.image} alt="" /> : <div className="cs-live-thumb">CS</div>}
                      <div className="cs-live-comp-copy">
                        <strong>{comp.title}</strong>
                        <span>{comp.marketplace || "eBay"}{comp.condition ? ` · ${comp.condition}` : ""}{comp.soldDate ? ` · ${comp.soldDate.slice(0, 10)}` : ""}</span>
                      </div>
                      <div className="cs-live-price">
                        <b>{money(comp.soldPrice)}</b>
                        {comp.shippingCost != null && comp.shippingCost > 0 && <small>+ {money(comp.shippingCost)} ship</small>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cs-live-note">
                  <b>REAL DATA</b>
                  <p>These are completed marketplace sales, not CardSignal mock values. Once this feed is stable, the median and sale velocity can feed directly into Analyze Card.</p>
                </div>
              </div>
            )}

            <div className="cs-live-attribution">Sold-market data via SoldComps · eBay completed listings · Prototype integration</div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .cs-live-launch{position:fixed;right:24px;bottom:24px;z-index:900;height:42px;padding:0 16px;border:1px solid rgba(65,241,155,.42);border-radius:10px;background:linear-gradient(180deg,rgba(33,193,115,.2),rgba(4,30,20,.9));color:#bfffdc;font-size:10px;font-weight:900;letter-spacing:.12em;cursor:pointer;box-shadow:0 16px 35px rgba(0,0,0,.32)}.cs-live-launch span{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#4ff1a0;box-shadow:0 0 12px #4ff1a0}
        .cs-live-backdrop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.82);backdrop-filter:blur(15px)}.cs-live-modal{position:relative;width:min(1040px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(75,207,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.72);color:#effaff}.cs-live-modal:before{content:"";position:absolute;left:0;top:0;width:250px;height:2px;background:linear-gradient(90deg,#45f19a,transparent);box-shadow:0 0 18px rgba(69,241,154,.6)}.cs-live-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-live-head>span{color:#51d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-live-head h2{margin:7px 0 5px;font-size:31px;letter-spacing:-.04em}.cs-live-head p{margin:0;color:#7896a8;font-size:12px}
        .cs-live-search{display:grid;grid-template-columns:1fr auto;gap:10px;margin:24px 0 18px}.cs-live-search input{height:46px;border:1px solid rgba(82,190,230,.18);border-radius:10px;background:#06131f;color:#ecf9ff;padding:0 14px;outline:none}.cs-live-search input:focus{border-color:rgba(70,220,255,.5);box-shadow:0 0 0 3px rgba(70,220,255,.05)}.cs-live-search button{height:46px;padding:0 18px;border:1px solid rgba(62,241,154,.42);border-radius:10px;background:rgba(35,173,108,.14);color:#c9ffe2;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-live-search button:disabled{opacity:.55}
        .cs-live-error{display:flex;flex-direction:column;gap:5px;padding:13px 14px;margin-bottom:14px;border:1px solid rgba(255,91,111,.25);border-radius:9px;background:rgba(150,30,47,.1);color:#ff9daa}.cs-live-error strong{font-size:9px;letter-spacing:.12em}.cs-live-error span{font-size:11px}.cs-live-error small{color:#a7bdc9;font-size:10px}.cs-live-error.setup{border-color:rgba(87,209,255,.25);background:rgba(36,125,160,.08);color:#67dcff}
        .cs-live-empty{padding:28px;border:1px dashed rgba(86,190,229,.15);border-radius:11px;color:#69899b;text-align:center;font-size:11px}.cs-live-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:18px}.cs-live-summary>div{padding:14px;border:1px solid rgba(74,187,229,.13);border-radius:10px;background:rgba(6,24,38,.72)}.cs-live-summary span{display:block;color:#6e8fa2;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-live-summary strong{display:block;margin-top:6px;font-size:18px;color:#eafaff}.cs-live-summary>div:first-child strong{color:#62efaa}
        .cs-live-section{display:flex;justify-content:space-between;gap:20px;margin:18px 0 10px}.cs-live-section span{color:#50d9ff;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-live-section b{color:#8ca8b7;font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-live-comps{display:grid;gap:7px}.cs-live-comp{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(78,183,224,.11);border-radius:10px;background:rgba(7,24,38,.68)}.cs-live-comp>img,.cs-live-thumb{width:52px;height:52px;border-radius:7px;object-fit:cover;background:#0a2030}.cs-live-thumb{display:grid;place-items:center;color:#4bcdf3;font-size:10px;font-weight:900}.cs-live-comp-copy{min-width:0}.cs-live-comp-copy strong{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-live-comp-copy span{display:block;margin-top:4px;color:#69899b;font-size:9px}.cs-live-price{text-align:right}.cs-live-price b{display:block;color:#61efaa;font-size:14px}.cs-live-price small{display:block;margin-top:3px;color:#6f8fa0;font-size:8px}.cs-live-note{margin-top:16px;padding:13px;border:1px solid rgba(64,218,255,.14);border-radius:10px;background:rgba(19,79,103,.1)}.cs-live-note b{color:#55d9ff;font-size:8px;letter-spacing:.13em}.cs-live-note p{margin:6px 0 0;color:#91adbc;font-size:10px;line-height:1.5}.cs-live-attribution{margin-top:18px;text-align:right;color:#506f80;font-size:9px}
        @media(max-width:760px){.cs-live-modal{padding:22px 16px}.cs-live-search{grid-template-columns:1fr}.cs-live-summary{grid-template-columns:repeat(2,1fr)}.cs-live-comp{grid-template-columns:42px 1fr}.cs-live-comp>img,.cs-live-thumb{width:42px;height:42px}.cs-live-price{grid-column:2;text-align:left}.cs-live-section{flex-direction:column;gap:5px}}
      `}</style>
    </>
  );
}
