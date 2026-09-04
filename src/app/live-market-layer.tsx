"use client";

import { FormEvent, useMemo, useState } from "react";

type AnyRecord = Record<string, unknown>;

function arr(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((item): item is AnyRecord => Boolean(item && typeof item === "object")) : [];
}

function num(...values: unknown[]) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function unwrapData(payload: AnyRecord | null) {
  if (!payload) return [];
  const direct = arr(payload.data);
  if (direct.length) return direct;
  const results = payload.results;
  if (results && typeof results === "object") {
    const nested = arr((results as AnyRecord).data);
    if (nested.length) return nested;
  }
  return [];
}

function cardTitle(card: AnyRecord) {
  const player = text(card.player_name, card.playerName, card.player, card.name, card.subject);
  const year = text(card.year);
  const manufacturer = text(card.manufacturer, card.brand);
  const set = text(card.set_name, card.setName, card.set, card.product_name);
  return [year, manufacturer, set, player].filter(Boolean).join(" ") || "Unknown card";
}

function cardMeta(card: AnyRecord) {
  const number = text(card.card_number, card.cardNumber, card.number);
  const grade = text(card.grade, card.grading_grade);
  const grader = text(card.grader, card.grading_company, card.gradingCompany);
  return [number && `#${number}`, grader, grade].filter(Boolean).join(" · ");
}

function cardPrice(card: AnyRecord) {
  return num(card.current_price, card.currentPrice, card.price, card.market_price, card.marketPrice, card.value);
}

function cardId(card: AnyRecord) {
  return text(card.id, card.card_id, card.cardId, card.uuid);
}

function normalizeDetail(payload: AnyRecord | null) {
  if (!payload) return null;
  const wrapper = payload.card;
  if (!wrapper || typeof wrapper !== "object") return null;
  const envelope = wrapper as AnyRecord;
  const data = envelope.data && typeof envelope.data === "object" ? envelope.data as AnyRecord : envelope;
  return data;
}

function provenanceRows(payload: AnyRecord | null) {
  if (!payload) return [];
  const wrapper = payload.provenance;
  if (!wrapper || typeof wrapper !== "object") return [];
  const env = wrapper as AnyRecord;
  const data = env.data && typeof env.data === "object" ? env.data as AnyRecord : env;

  const direct = arr(data.comps);
  if (direct.length) return direct;

  const observations = arr(data.observations);
  if (observations.length) return observations;

  const provenance = data.provenance;
  if (provenance && typeof provenance === "object") {
    const p = provenance as AnyRecord;
    const pComps = arr(p.comps);
    if (pComps.length) return pComps;
    const sources = p.bySource;
    if (sources && typeof sources === "object") {
      return Object.entries(sources as Record<string, unknown>).flatMap(([source, value]) => {
        const rows = arr(value);
        if (rows.length) return rows.map((row) => ({ ...row, source: text(row.source) || source }));
        if (value && typeof value === "object") {
          const nested = arr((value as AnyRecord).comps);
          return nested.map((row) => ({ ...row, source: text(row.source) || source }));
        }
        return [];
      });
    }
  }

  return [];
}

export default function LiveMarketLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("Victor Wembanyama 2023 Prizm Silver PSA 10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPayload, setSearchPayload] = useState<AnyRecord | null>(null);
  const [detailPayload, setDetailPayload] = useState<AnyRecord | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const results = useMemo(() => unwrapData(searchPayload).slice(0, 12), [searchPayload]);
  const detail = useMemo(() => normalizeDetail(detailPayload), [detailPayload]);
  const comps = useMemo(() => provenanceRows(detailPayload).slice(0, 8), [detailPayload]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setDetailPayload(null);
    setSelectedId("");
    try {
      const response = await fetch(`/api/market?q=${encodeURIComponent(query.trim())}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Search failed");
      setSearchPayload(json.results || json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const selectCard = async (card: AnyRecord) => {
    const id = cardId(card);
    if (!id) return;
    setLoading(true);
    setError("");
    setSelectedId(id);
    try {
      const response = await fetch(`/api/market?id=${encodeURIComponent(id)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Card details failed");
      setDetailPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card details failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="cs-live-launch" onClick={() => setOpen(true)}>
        <span /> LIVE MARKET
      </button>

      {open && (
        <div className="cs-live-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="cs-live-modal">
            <button className="cs-live-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="cs-live-head">
              <span>REAL MARKET DATA</span>
              <h2>Live comps search</h2>
              <p>This panel is hitting a real card-market API. Search for the exact card, then select the closest match.</p>
            </div>

            <form className="cs-live-search" onSubmit={search}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="2024 Topps Chrome Jackson Holliday PSA 10" />
              <button disabled={loading}>{loading ? "SEARCHING…" : "SEARCH LIVE DATA"}</button>
            </form>

            {error && <div className="cs-live-error">{error}</div>}

            {!detail && (
              <div className="cs-live-results">
                {results.length === 0 && !loading && <div className="cs-live-empty">Search for a card to pull live matches.</div>}
                {results.map((card, index) => {
                  const price = cardPrice(card);
                  const id = cardId(card);
                  return (
                    <button key={id || index} onClick={() => selectCard(card)} disabled={!id || loading} className={selectedId === id ? "selected" : ""}>
                      <div>
                        <strong>{cardTitle(card)}</strong>
                        <span>{cardMeta(card) || text(card.sport, card.category) || "CardPricer catalog match"}</span>
                      </div>
                      <b>{price === null ? "—" : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</b>
                    </button>
                  );
                })}
              </div>
            )}

            {detail && (
              <div className="cs-live-detail">
                <button className="cs-live-back" onClick={() => { setDetailPayload(null); setSelectedId(""); }}>← BACK TO MATCHES</button>
                <div className="cs-live-card-head">
                  <div>
                    <span>LIVE MATCH</span>
                    <h3>{cardTitle(detail)}</h3>
                    <p>{cardMeta(detail)}</p>
                  </div>
                  <div>
                    <small>CURRENT MARKET</small>
                    <strong>{cardPrice(detail) === null ? "—" : `$${cardPrice(detail)!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong>
                  </div>
                </div>

                <div className="cs-live-proof">
                  <div><span>DATA SOURCE</span><b>CardPricer</b></div>
                  <div><span>COMPS FOUND</span><b>{comps.length || "—"}</b></div>
                  <div><span>LIVE STATUS</span><b className="good">CONNECTED</b></div>
                </div>

                <div className="cs-live-comps">
                  <div className="cs-live-section"><span>RECENT / SUPPORTING COMPS</span><b>Observed market evidence</b></div>
                  {comps.length === 0 ? (
                    <div className="cs-live-empty">This match returned a price, but no individual provenance rows were exposed in the response.</div>
                  ) : comps.map((comp, index) => {
                    const price = num(comp.price, comp.sold_price, comp.soldPrice, comp.amount, comp.value);
                    const source = text(comp.source, comp.marketplace, comp.venue) || "market";
                    const title = text(comp.title, comp.name, comp.description) || `Comp ${index + 1}`;
                    const date = text(comp.sold_date, comp.soldDate, comp.date, comp.observed_at, comp.observedAt);
                    return (
                      <div className="cs-live-comp" key={index}>
                        <div><strong>{title}</strong><span>{source}{date ? ` · ${date.slice(0, 10)}` : ""}</span></div>
                        <b>{price === null ? "—" : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</b>
                      </div>
                    );
                  })}
                </div>

                <div className="cs-live-note">
                  <b>FIRST REAL-DATA STEP</b>
                  <p>CardSignal can now retrieve live catalog pricing and provenance. Next we can feed this result into the Add Card scan so market value and recent price movement stop being mocked.</p>
                </div>
              </div>
            )}

            <div className="cs-live-attribution">Market data powered by CardPricer · Prototype integration</div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .cs-live-launch{position:fixed;right:24px;bottom:24px;z-index:900;height:42px;padding:0 16px;border:1px solid rgba(65,241,155,.42);border-radius:10px;background:linear-gradient(180deg,rgba(33,193,115,.2),rgba(4,30,20,.9));color:#bfffdc;font-size:10px;font-weight:900;letter-spacing:.12em;cursor:pointer;box-shadow:0 16px 35px rgba(0,0,0,.32)}.cs-live-launch span{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#4ff1a0;box-shadow:0 0 12px #4ff1a0}
        .cs-live-backdrop{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.82);backdrop-filter:blur(15px)}.cs-live-modal{position:relative;width:min(980px,96vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(75,207,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.72);color:#effaff}.cs-live-modal:before{content:"";position:absolute;left:0;top:0;width:250px;height:2px;background:linear-gradient(90deg,#45f19a,transparent);box-shadow:0 0 18px rgba(69,241,154,.6)}.cs-live-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-live-head>span{color:#51d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-live-head h2{margin:7px 0 5px;font-size:31px;letter-spacing:-.04em}.cs-live-head p{margin:0;color:#7896a8;font-size:12px}
        .cs-live-search{display:grid;grid-template-columns:1fr auto;gap:10px;margin:24px 0 18px}.cs-live-search input{height:46px;border:1px solid rgba(82,190,230,.18);border-radius:10px;background:#06131f;color:#ecf9ff;padding:0 14px;outline:none}.cs-live-search input:focus{border-color:rgba(70,220,255,.5);box-shadow:0 0 0 3px rgba(70,220,255,.05)}.cs-live-search button{height:46px;padding:0 18px;border:1px solid rgba(62,241,154,.42);border-radius:10px;background:rgba(35,173,108,.14);color:#c9ffe2;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-live-search button:disabled{opacity:.55}.cs-live-error{padding:11px 13px;margin-bottom:14px;border:1px solid rgba(255,91,111,.25);border-radius:9px;background:rgba(150,30,47,.1);color:#ff9daa;font-size:11px}
        .cs-live-results{display:grid;gap:8px}.cs-live-results>button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:18px;padding:13px 15px;text-align:left;border:1px solid rgba(78,183,224,.12);border-radius:10px;background:rgba(7,24,38,.7);color:#eaf8ff;cursor:pointer}.cs-live-results>button:hover,.cs-live-results>button.selected{border-color:rgba(70,221,255,.36);background:rgba(20,80,105,.16)}.cs-live-results>button div{min-width:0}.cs-live-results strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-live-results span{display:block;margin-top:4px;color:#6f90a2;font-size:10px}.cs-live-results>button>b{color:#65efaa;font-size:14px;white-space:nowrap}.cs-live-empty{padding:28px;border:1px dashed rgba(86,190,229,.15);border-radius:11px;color:#69899b;text-align:center;font-size:11px}
        .cs-live-back{margin-bottom:16px;border:0;background:transparent;color:#66dfff;font-size:9px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-live-card-head{display:flex;justify-content:space-between;gap:24px;padding:18px;border:1px solid rgba(82,190,229,.14);border-radius:13px;background:rgba(7,28,43,.74)}.cs-live-card-head>div:first-child>span{color:#54d9ff;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-live-card-head h3{margin:6px 0 5px;font-size:23px}.cs-live-card-head p{margin:0;color:#7898aa;font-size:11px}.cs-live-card-head>div:last-child{text-align:right}.cs-live-card-head small{display:block;color:#7392a4;font-size:8px;font-weight:900;letter-spacing:.13em}.cs-live-card-head>div:last-child strong{display:block;margin-top:8px;font-size:27px;color:#66efaa}.cs-live-proof{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 18px}.cs-live-proof>div{padding:12px;border:1px solid rgba(78,183,224,.11);border-radius:10px;background:#06131f}.cs-live-proof span{display:block;color:#68899b;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-live-proof b{display:block;margin-top:5px;font-size:12px}.cs-live-proof .good{color:#5cefaa}
        .cs-live-section{display:flex;justify-content:space-between;gap:14px;margin-bottom:10px}.cs-live-section span{color:#55d9ff;font-size:9px;font-weight:900;letter-spacing:.13em}.cs-live-section b{font-size:11px;color:#d8eaf3}.cs-live-comp{display:flex;justify-content:space-between;gap:18px;padding:11px 4px;border-bottom:1px solid rgba(83,174,211,.08)}.cs-live-comp strong{display:block;font-size:11px}.cs-live-comp span{display:block;margin-top:4px;color:#668698;font-size:9px}.cs-live-comp>b{color:#dff8ec;font-size:12px;white-space:nowrap}.cs-live-note{margin-top:18px;padding:13px;border:1px solid rgba(66,215,255,.14);border-radius:10px;background:rgba(15,73,99,.11)}.cs-live-note b{color:#58dbff;font-size:9px;letter-spacing:.12em}.cs-live-note p{margin:6px 0 0;color:#95b2c1;font-size:11px;line-height:1.5}.cs-live-attribution{margin-top:18px;text-align:right;color:#526f80;font-size:9px}
        @media(max-width:720px){.cs-live-modal{padding:22px 16px}.cs-live-search{grid-template-columns:1fr}.cs-live-card-head{flex-direction:column}.cs-live-card-head>div:last-child{text-align:left}.cs-live-proof{grid-template-columns:1fr}.cs-live-launch{right:14px;bottom:14px}}
      `}</style>
    </>
  );
}
