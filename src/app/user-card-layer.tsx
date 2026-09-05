"use client";

import { useEffect, useMemo, useState } from "react";
import { getCardSignalScore, type ScorePulse } from "./card-signal-score";

type MarketScan={scannedAt:string;acceptedCount:number;rejectedCount:number;currentMedian:number|null;recentMedian:number|null;priorMedian:number|null;change7d:number|null;recentSales:number;velocity:number|null;pulse:ScorePulse;confidence:string;elapsedMs:number};
type UserCard = {
  id: number;
  player: string;
  meta: string;
  score: number;
  move: string;
  tone: "buy" | "hold" | "sell";
  mode: "owned" | "watching";
  marketValue: number;
  purchasePrice?: number;
  image?: string;
  addedAt?: string;
  year?:string;
  setName?:string;
  cardNumber?:string;
  variant?:string;
  marketScan?:MarketScan;
  liveValuation?: {
    provider?: string;
    identityLabel?: string;
    confidence?: string;
    median?: number;
    compCount?: number;
    savedAt?: string;
  };
};

type SortMode="score"|"value"|"move"|"recent"|"name";
type FilterMode="ALL"|ScorePulse;
const STORAGE_KEY = "cardsignal-added-cards";

function readCards(): UserCard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((card) => ({
      ...card,
      id: Number(card.id || Date.now()),
      score: Number(card.score || 0),
      marketValue: Number(card.marketValue || 0),
      mode: card.mode === "owned" ? "owned" : "watching",
      tone: card.tone === "buy" || card.tone === "sell" ? card.tone : "hold",
      purchasePrice: card.purchasePrice === undefined || card.purchasePrice === "" ? undefined : Number(card.purchasePrice),
    }));
  } catch {
    return [];
  }
}

function saveCards(cards: UserCard[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.slice(0, 100))); }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function safeText(value: string) { return value.replace(/[<>]/g, ""); }
function moveNumber(card:UserCard){return card.marketScan?.change7d==null?-9999:Number(card.marketScan.change7d)}
function scanTime(card:UserCard){const t=card.marketScan?.scannedAt?new Date(card.marketScan.scannedAt).getTime():0;return Number.isFinite(t)?t:0}

export default function UserCardLayer() {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"owned" | "watching">("owned");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<SortMode>("score");
  const [filter,setFilter]=useState<FilterMode>("ALL");

  const owned = useMemo(() => cards.filter((card) => card.mode === "owned"), [cards]);
  const watching = useMemo(() => cards.filter((card) => card.mode === "watching"), [cards]);
  const marketTotal = useMemo(() => owned.reduce((sum, card) => sum + (Number(card.marketValue) || 0), 0), [owned]);
  const costBasis = useMemo(() => owned.reduce((sum, card) => sum + (Number(card.purchasePrice) || 0), 0), [owned]);
  const gainLoss = marketTotal - costBasis;
  const refresh = () => setCards(readCards());

  useEffect(() => {
    setCards(readCards());
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button) return;
      const label = button.textContent?.trim().replace(/\s+/g, " ") || "";
      if (button.matches(".nav-tabs button") && label === "Portfolio") { setOpen(true); setTab("owned"); return; }
      if (button.matches(".cs-primary") && label.includes("ADD TO DASHBOARD")) {
        const purchaseInput = document.querySelector<HTMLInputElement>(".cs-price input");
        const preview = document.querySelector<HTMLImageElement>(".cs-upload > img:not([src*='action-camera'])");
        const purchasePrice = purchaseInput?.value ? Number.parseFloat(purchaseInput.value) : undefined;
        const image = preview?.src?.startsWith("data:image/") ? preview.src : undefined;
        window.setTimeout(() => {
          const current = readCards();
          if (current.length) {
            current[0] = {...current[0],purchasePrice:Number.isFinite(purchasePrice as number)?purchasePrice:current[0].purchasePrice,image:image||current[0].image,addedAt:current[0].addedAt||new Date().toISOString()};
            saveCards(current);
          }
          setCards(current);
        }, 80);
        return;
      }
      if (button.matches(".cs-detail-analyze")) window.setTimeout(refresh, 2600);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  useEffect(() => { const onCardsChanged = () => refresh(); window.addEventListener("cardsignal:user-cards-changed", onCardsChanged); return () => window.removeEventListener("cardsignal:user-cards-changed", onCardsChanged); }, []);

  useEffect(() => {
    const watchPanel = document.querySelector<HTMLElement>(".triple-grid .radar-panel:nth-child(3)");
    if (!watchPanel) return;
    watchPanel.querySelectorAll(".cs-added-row").forEach((row) => row.remove());
    [...watching].reverse().forEach((card) => {
      const row = document.createElement("div");
      row.className = "signal-row cs-added-row cs-restored-row";
      row.dataset.userCardId = String(card.id);
      const sc=getCardSignalScore(card);
      row.innerHTML = `<div class="mini-card mini-${card.tone}">${card.image ? `<img src="${card.image}" alt="" />` : `<span>${initials(card.player)}</span>`}<i></i></div><div class="signal-copy"><strong>${safeText(card.player)}</strong><span>${safeText(card.meta)}</span></div><div class="score-pill ${sc.tone==='sell'?'sell':sc.tone==='buy'?'buy':'hold'}"><b>${sc.score||'—'}</b><small>${safeText(sc.label)}</small></div>`;
      const firstRow = watchPanel.querySelector(".signal-row");
      if (firstRow) watchPanel.insertBefore(row, firstRow); else watchPanel.appendChild(row);
    });
  }, [cards, watching]);

  const updateMode = (id: number, mode: "owned" | "watching") => { const next = cards.map((card) => card.id === id ? { ...card, mode } : card); saveCards(next); setCards(next); window.dispatchEvent(new Event("cardsignal:user-cards-changed")); };
  const removeCard = (id: number) => {
    const card = cards.find((item) => item.id === id); if (!card) return;
    if (!window.confirm(`Remove ${card.player} from CardSignal?`)) return;
    const next = cards.filter((item) => item.id !== id); saveCards(next); setCards(next); window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
    try { const detailState = JSON.parse(localStorage.getItem("cardsignal-card-detail-state") || "{}"); delete detailState[`${card.player}|${card.meta}`]; localStorage.setItem("cardsignal-card-detail-state", JSON.stringify(detailState)); } catch {}
  };

  const activeCards = useMemo(()=>{
    const base=(tab==="owned"?owned:watching).filter(card=>{
      const q=search.trim().toLowerCase();
      const text=[card.player,card.meta,card.year,card.setName,card.cardNumber,card.variant].filter(Boolean).join(" ").toLowerCase();
      const searchOk=!q||text.includes(q);
      const signal=card.marketScan?.acceptedCount&&card.marketScan.acceptedCount>=3?card.marketScan.pulse:"NOT ENOUGH DATA";
      const filterOk=filter==="ALL"||signal===filter;
      return searchOk&&filterOk;
    });
    return [...base].sort((a,b)=>{
      if(sort==="score")return getCardSignalScore(b).score-getCardSignalScore(a).score;
      if(sort==="value")return Number(b.marketValue||0)-Number(a.marketValue||0);
      if(sort==="move")return Math.abs(moveNumber(b))-Math.abs(moveNumber(a));
      if(sort==="recent")return scanTime(b)-scanTime(a);
      return a.player.localeCompare(b.player);
    });
  },[tab,owned,watching,search,sort,filter]);

  return <>
    {open && <div className="cs-portfolio-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="cs-portfolio-modal" role="dialog" aria-modal="true" aria-label="My CardSignal cards">
        <button className="cs-portfolio-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        <div className="cs-portfolio-head"><div><span>MY CARDS</span><h2>Portfolio & Watchlist</h2><p>Search, filter, and sort by the unified CardSignal Score and live market evidence.</p></div><button className="cs-portfolio-add" onClick={() => { setOpen(false); window.setTimeout(() => document.querySelector<HTMLButtonElement>(".add-card")?.click(), 50); }}>＋ ADD CARD</button></div>
        <div className="cs-portfolio-stats">
          <div><small>OWNED MARKET VALUE</small><strong>${marketTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span>{owned.length} owned card{owned.length===1?"":"s"}</span></div>
          <div><small>COST BASIS</small><strong>${costBasis.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span>From entered purchase prices</span></div>
          <div><small>UNREALIZED GAIN / LOSS</small><strong className={gainLoss>=0?"positive":"negative"}>{gainLoss>=0?"+":"-"}${Math.abs(gainLoss).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span>{costBasis>0?`${gainLoss>=0?"+":""}${((gainLoss/costBasis)*100).toFixed(1)}%`:"Add purchase prices to calculate"}</span></div>
          <div><small>WATCHING</small><strong>{watching.length}</strong><span>Personal watchlist cards</span></div>
        </div>
        <div className="cs-portfolio-tabs"><button className={tab==="owned"?"active":""} onClick={()=>setTab("owned")}>OWNED <b>{owned.length}</b></button><button className={tab==="watching"?"active":""} onClick={()=>setTab("watching")}>WATCHING <b>{watching.length}</b></button></div>
        <div className="cs-portfolio-controls">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search player, set, card #, variant…" aria-label="Search cards"/>
          <select value={filter} onChange={e=>setFilter(e.target.value as FilterMode)} aria-label="Filter by signal"><option value="ALL">All signals</option><option>BUY MORE</option><option>SELL RISK</option><option>WATCH CLOSELY</option><option>HOLD</option><option>NOT ENOUGH DATA</option></select>
          <select value={sort} onChange={e=>setSort(e.target.value as SortMode)} aria-label="Sort cards"><option value="score">Score: highest</option><option value="value">Value: highest</option><option value="move">Biggest 7D move</option><option value="recent">Most recently scanned</option><option value="name">Player A–Z</option></select>
          <span>{activeCards.length} shown</span>
        </div>
        <div className="cs-portfolio-list">{activeCards.length===0?<div className="cs-portfolio-empty"><img src="/assets/cropped/icons/action-cards.png" alt=""/><b>No cards match these filters</b><p>Clear the search or signal filter to see more cards.</p></div>:activeCards.map(card=>{const sc=getCardSignalScore(card);const s=card.marketScan;return <article className="cs-portfolio-card signal-row" data-user-card-id={card.id} key={card.id}>
          <div className={`cs-portfolio-art ${card.tone}`}>{card.image?<img src={card.image} alt={card.player}/>:<span>{initials(card.player)}</span>}</div>
          <div className="cs-portfolio-copy"><strong>{card.player}</strong><span>{card.meta}</span><small>{s?`${s.acceptedCount} accepted matches · ${s.confidence} confidence`:card.mode==="owned"&&card.purchasePrice?`Paid $${card.purchasePrice.toFixed(2)}`:card.mode==="owned"?"Not scanned yet":"Watching for an entry"}</small></div>
          <div className="cs-portfolio-market"><small>{s?"CURRENT MEDIAN":"MARKET"}</small><strong>${Number(card.marketValue||0).toFixed(2)}</strong><span className={(s?.change7d??0)<0?"negative":"positive"}>{s?.change7d==null?"—":`${s.change7d>=0?"+":""}${s.change7d.toFixed(1)}% 7D`}</span></div>
          <div className={`cs-portfolio-score ${sc.tone}`}><small>CARDSIGNAL SCORE</small><strong>{sc.score||"—"}</strong><span>{sc.label}</span></div>
          <div className="cs-portfolio-actions"><button onClick={e=>{e.stopPropagation();updateMode(card.id,card.mode==="owned"?"watching":"owned")}}>{card.mode==="owned"?"MOVE TO WATCHLIST":"MARK AS OWNED"}</button><button className="danger" onClick={e=>{e.stopPropagation();removeCard(card.id)}}>REMOVE</button></div>
        </article>})}</div>
      </section>
    </div>}
    <style jsx global>{`
      .cs-restored-row .mini-card{overflow:hidden}.cs-restored-row .mini-card>img{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:cover;border-radius:5px;opacity:.78}.cs-restored-row .mini-card>i{z-index:3}
      .cs-portfolio-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:22px;background:rgba(0,7,12,.82);backdrop-filter:blur(14px)}.cs-portfolio-modal{position:relative;width:min(1180px,97vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(74,205,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 42px 120px rgba(0,0,0,.74);color:#effaff}.cs-portfolio-modal:before{content:"";position:absolute;top:0;left:0;width:250px;height:2px;background:linear-gradient(90deg,#49f19c,transparent);box-shadow:0 0 18px rgba(73,241,156,.6)}
      .cs-portfolio-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(100,189,225,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-portfolio-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding-right:42px}.cs-portfolio-head>div>span{color:#52d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-portfolio-head h2{margin:7px 0 5px;font-size:31px;letter-spacing:-.04em}.cs-portfolio-head p{margin:0;color:#7897a9;font-size:12px}.cs-portfolio-add{height:40px;padding:0 17px;border:1px solid rgba(68,241,155,.4);border-radius:8px;background:rgba(39,202,124,.1);color:#8affbd;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer}
      .cs-portfolio-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0 18px}.cs-portfolio-stats>div{min-height:105px;border:1px solid rgba(76,188,229,.13);border-radius:11px;background:rgba(7,25,39,.72);padding:14px}.cs-portfolio-stats small{display:block;color:#6e8fa2;font-size:8px;font-weight:900;letter-spacing:.13em}.cs-portfolio-stats strong{display:block;margin:9px 0 6px;font-size:22px}.cs-portfolio-stats span{color:#6e8fa2;font-size:9px}
      .cs-portfolio-tabs{display:flex;gap:6px;border-bottom:1px solid rgba(80,184,221,.12);margin-bottom:12px}.cs-portfolio-tabs button{padding:11px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:#65879a;font-size:10px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-portfolio-tabs button.active{color:#65e7ff;border-bottom-color:#48e99d}.cs-portfolio-tabs b{margin-left:5px;color:#bcd3de}
      .cs-portfolio-controls{display:grid;grid-template-columns:minmax(280px,1.4fr) 180px 190px auto;gap:8px;align-items:center;margin:0 0 12px}.cs-portfolio-controls input,.cs-portfolio-controls select{height:38px;border:1px solid rgba(78,190,232,.16);border-radius:8px;background:#071724;color:#d9edf5;padding:0 11px;font-size:10px;outline:none}.cs-portfolio-controls input:focus,.cs-portfolio-controls select:focus{border-color:rgba(83,220,255,.42)}.cs-portfolio-controls span{color:#6f91a1;font-size:9px;text-align:right}
      .cs-portfolio-list{display:flex;flex-direction:column;gap:8px}.cs-portfolio-card{display:grid!important;grid-template-columns:62px minmax(230px,1fr) 125px 150px 190px;gap:14px;align-items:center;min-height:90px;border:1px solid rgba(74,179,217,.11)!important;border-radius:11px;background:rgba(6,21,33,.7);padding:11px!important;cursor:pointer}.cs-portfolio-card:hover{border-color:rgba(77,202,244,.26)!important;background:rgba(8,29,44,.82)}.cs-portfolio-art{width:52px;height:66px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(82,205,245,.2);border-radius:7px;background:#071721;font-size:17px;font-weight:900}.cs-portfolio-art.buy{border-color:rgba(72,238,157,.35)}.cs-portfolio-art.sell{border-color:rgba(255,89,108,.35)}.cs-portfolio-art img{width:100%;height:100%;object-fit:cover}.cs-portfolio-copy{min-width:0}.cs-portfolio-copy strong{display:block;font-size:13px}.cs-portfolio-copy span{display:block;margin:3px 0;color:#7898aa;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-portfolio-copy small{color:#628295;font-size:9px}.cs-portfolio-market small,.cs-portfolio-score small{display:block;color:#648497;font-size:8px;letter-spacing:.11em}.cs-portfolio-market strong{display:block;margin:5px 0 3px;font-size:14px}.cs-portfolio-market span{font-size:9px}.cs-portfolio-score strong{display:block;margin:3px 0;font-size:23px}.cs-portfolio-score span{font-size:7px;font-weight:900;line-height:1.2}.cs-portfolio-score.buy span{color:#62efa5}.cs-portfolio-score.sell span{color:#ff6d7d}.cs-portfolio-score.watch span{color:#efc86e}.cs-portfolio-score.hold span{color:#62dfff}.cs-portfolio-score.data span{color:#a89cdf}.cs-portfolio-actions{display:flex;gap:6px;justify-content:flex-end}.cs-portfolio-actions button{height:32px;padding:0 9px;border:1px solid rgba(78,190,232,.18);border-radius:7px;background:#071724;color:#87a9bb;font-size:8px;font-weight:900;letter-spacing:.06em;cursor:pointer}.cs-portfolio-actions button:hover{border-color:rgba(74,219,255,.4);color:#d8f6ff}.cs-portfolio-actions button.danger:hover{border-color:rgba(255,91,111,.38);color:#ff8894}.cs-portfolio-empty{padding:48px 20px;text-align:center;border:1px dashed rgba(78,190,232,.16);border-radius:12px;color:#7895a6}.cs-portfolio-empty img{display:block;width:62px;height:62px;object-fit:contain;margin:0 auto 8px;opacity:.65}.cs-portfolio-empty b{display:block;color:#d5e9f2}.cs-portfolio-empty p{margin:5px 0 0;font-size:11px}
      @media(max-width:900px){.cs-portfolio-stats{grid-template-columns:1fr 1fr}.cs-portfolio-controls{grid-template-columns:1fr 1fr}.cs-portfolio-controls input{grid-column:1/-1}.cs-portfolio-card{grid-template-columns:52px 1fr 110px}.cs-portfolio-score,.cs-portfolio-market{grid-row:2}.cs-portfolio-actions{grid-column:1/-1;justify-content:flex-start}}@media(max-width:560px){.cs-portfolio-modal{padding:22px 14px}.cs-portfolio-head{align-items:flex-start;flex-direction:column}.cs-portfolio-stats,.cs-portfolio-controls{grid-template-columns:1fr}.cs-portfolio-controls input{grid-column:auto}.cs-portfolio-card{grid-template-columns:52px 1fr}.cs-portfolio-market,.cs-portfolio-score{grid-row:auto}.cs-portfolio-actions{grid-column:1/-1;flex-wrap:wrap}}
    `}</style>
  </>;
}
