"use client";

import { useEffect, useMemo, useState } from "react";
import { getCardSignalScore, type ScorePulse } from "./card-signal-score";

type MarketScan={scannedAt:string;acceptedCount:number;rejectedCount:number;currentMedian:number|null;recentMedian:number|null;priorMedian:number|null;change7d:number|null;recentSales:number;velocity:number|null;pulse:ScorePulse;confidence:string;elapsedMs:number};
type Card={id:number;player:string;meta?:string;year?:string;setName?:string;cardNumber?:string;variant?:string;mode?:"owned"|"watching";marketValue?:number;marketScan?:MarketScan};
type SortMode="score"|"move"|"value"|"confidence"|"name";

const CARD_KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function money(v:number|null|undefined){return v==null?"—":`$${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function pct(v:number|null|undefined){return v==null?"—":`${v>=0?"+":""}${v.toFixed(1)}%`}
function navButton(label:string){return [...document.querySelectorAll<HTMLButtonElement>(".nav-tabs button")].find(b=>b.textContent?.trim()===label)}
function confRank(v?:string){const c=(v||"").toUpperCase();return c.includes("HIGH")?3:c.includes("MODERATE")?2:c.includes("LOW")?1:0}

export default function StatCardNavigationLayer(){
 const[cards,setCards]=useState<Card[]>([]),[open,setOpen]=useState<"buy"|"sell"|null>(null),[query,setQuery]=useState(""),[sort,setSort]=useState<SortMode>("score");
 const refresh=()=>setCards(readCards());
 useEffect(()=>{refresh();const h=()=>refresh();window.addEventListener("cardsignal:user-cards-changed",h);window.addEventListener("storage",h);return()=>{window.removeEventListener("cardsignal:user-cards-changed",h);window.removeEventListener("storage",h)}},[]);
 useEffect(()=>{
  const stats=[...document.querySelectorAll<HTMLElement>(".stat-grid .stat-card")];
  const labels=["Open portfolio","Open watchlist","Open Buy More signals","Open Sell Risk signals"];
  stats.forEach((el,i)=>{if(i>3)return;el.classList.add("cs-stat-clickable");el.tabIndex=0;el.setAttribute("role","button");el.setAttribute("aria-label",labels[i]);el.title=labels[i];});
  const activate=(index:number)=>{
   if(index===0){navButton("Portfolio")?.click();return;}
   if(index===1){navButton("Portfolio")?.click();window.setTimeout(()=>document.querySelector<HTMLButtonElement>(".cs-portfolio-tabs button:nth-child(2)")?.click(),80);return;}
   if(index===2){refresh();setQuery("");setSort("score");setOpen("buy");return;}
   if(index===3){refresh();setQuery("");setSort("score");setOpen("sell");return;}
  };
  const click=(e:MouseEvent)=>{const el=(e.target as HTMLElement).closest<HTMLElement>(".stat-grid .stat-card");if(!el)return;const idx=stats.indexOf(el);if(idx>=0&&idx<4)activate(idx)};
  const key=(e:KeyboardEvent)=>{if(e.key!=="Enter"&&e.key!==" ")return;const el=(e.target as HTMLElement).closest<HTMLElement>(".stat-grid .stat-card");if(!el)return;const idx=stats.indexOf(el);if(idx>=0&&idx<4){e.preventDefault();activate(idx)}};
  document.addEventListener("click",click);document.addEventListener("keydown",key);
  return()=>{document.removeEventListener("click",click);document.removeEventListener("keydown",key)};
 },[]);
 const filtered=useMemo(()=>{
  if(!open)return[];
  const q=query.trim().toLowerCase();
  const target=open==="buy"?"BUY MORE":"SELL RISK";
  const rows=cards.filter(c=>c.mode!=="watching"&&c.marketScan?.pulse===target).filter(c=>!q||[c.player,c.meta,c.year,c.setName,c.cardNumber,c.variant].filter(Boolean).join(" ").toLowerCase().includes(q));
  return [...rows].sort((a,b)=>{
   if(sort==="score")return getCardSignalScore(b).score-getCardSignalScore(a).score;
   if(sort==="move")return Math.abs(b.marketScan?.change7d||0)-Math.abs(a.marketScan?.change7d||0);
   if(sort==="value")return Number(b.marketScan?.currentMedian??b.marketValue??0)-Number(a.marketScan?.currentMedian??a.marketValue??0);
   if(sort==="confidence")return confRank(b.marketScan?.confidence)-confRank(a.marketScan?.confidence);
   return a.player.localeCompare(b.player);
  });
 },[cards,open,query,sort]);
 if(!open)return <style jsx global>{`.cs-stat-clickable{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.cs-stat-clickable:hover,.cs-stat-clickable:focus-visible{transform:translateY(-2px);border-color:rgba(95,220,255,.35)!important;box-shadow:0 14px 38px rgba(0,0,0,.22),0 0 0 1px rgba(86,218,255,.08);outline:none}`}</style>;
 const buy=open==="buy";return <><div className="cs-signal-filter-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(null)}><section className="cs-signal-filter-modal"><button className="cs-signal-filter-close" onClick={()=>setOpen(null)}>×</button><div className="cs-signal-filter-head"><span>{buy?"BUY MORE":"SELL RISK"}</span><h2>{buy?"Current Buy More Signals":"Current Sell Risk Signals"}</h2><p>Only owned cards whose latest saved market scan currently qualifies. Ranked by the unified CardSignal Score.</p></div>
 <div className="cs-signal-filter-controls"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search player, set, card #…"/><select value={sort} onChange={e=>setSort(e.target.value as SortMode)}><option value="score">Score: highest</option><option value="move">Biggest 7D move</option><option value="value">Market value: highest</option><option value="confidence">Confidence: highest</option><option value="name">Player A–Z</option></select><span>{filtered.length} cards</span></div>
 <div className="cs-signal-filter-list">{filtered.length?filtered.map(card=>{const s=card.marketScan!,sc=getCardSignalScore(card);return <article key={card.id} className={`signal-row cs-signal-filter-row ${buy?"buy":"sell"}`} data-user-card-id={card.id}><div><strong>{card.player}</strong><span>{card.meta||[card.year,card.setName,card.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(" · ")||"Saved card"}</span></div><div className={`cs-filter-score ${sc.tone}`}><small>CARDSIGNAL SCORE</small><b>{sc.score}</b><em>{sc.label}</em></div><div><small>CURRENT MEDIAN</small><b>{money(s.currentMedian)}</b></div><div><small>7D MOVE</small><b className={(s.change7d??0)<0?"negative":"positive"}>{pct(s.change7d)}</b></div><div><small>MARKET MATCHES</small><b>{s.acceptedCount}</b></div><div><small>CONFIDENCE</small><b>{s.confidence}</b></div></article>}):<div className="cs-signal-filter-empty"><b>No qualifying {buy?"Buy More":"Sell Risk"} signals match.</b><span>That is based on the latest saved scans, not a placeholder list.</span></div>}</div><div className="cs-signal-filter-foot">Click any card row to open its market terminal.</div></section></div><style jsx global>{`.cs-stat-clickable{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.cs-stat-clickable:hover,.cs-stat-clickable:focus-visible{transform:translateY(-2px);border-color:rgba(95,220,255,.35)!important;box-shadow:0 14px 38px rgba(0,0,0,.22),0 0 0 1px rgba(86,218,255,.08);outline:none}.cs-signal-filter-backdrop{position:fixed;inset:0;z-index:1560;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.86);backdrop-filter:blur(14px)}.cs-signal-filter-modal{position:relative;width:min(1120px,96vw);max-height:90vh;overflow:auto;padding:28px;border:1px solid rgba(79,201,243,.2);border-radius:18px;background:linear-gradient(155deg,#081d2e,#04111d 64%,#061821);box-shadow:0 42px 120px rgba(0,0,0,.72);color:#effaff}.cs-signal-filter-close{position:absolute;right:16px;top:14px;width:34px;height:34px;border:1px solid rgba(100,189,225,.16);border-radius:8px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-signal-filter-head>span{color:#58dcff;font-size:10px;font-weight:900;letter-spacing:.16em}.cs-signal-filter-head h2{margin:7px 0 5px;font-size:29px}.cs-signal-filter-head p{margin:0;color:#7997a7;font-size:11px}.cs-signal-filter-controls{display:grid;grid-template-columns:1fr 190px auto;gap:8px;align-items:center;margin-top:18px}.cs-signal-filter-controls input,.cs-signal-filter-controls select{height:38px;border:1px solid rgba(79,190,231,.16);border-radius:8px;background:#071724;color:#dff3fa;padding:0 11px;font-size:10px;outline:none}.cs-signal-filter-controls span{color:#7193a2;font-size:9px}.cs-signal-filter-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}.cs-signal-filter-row{display:grid!important;grid-template-columns:minmax(230px,1.4fr) 140px repeat(4,minmax(100px,.62fr));gap:12px;align-items:center;padding:14px!important;border:1px solid rgba(77,184,225,.1)!important;border-left:3px solid rgba(86,218,255,.35)!important;border-radius:10px;background:rgba(6,22,34,.72);cursor:pointer}.cs-signal-filter-row.buy{border-left-color:#54ec9f!important}.cs-signal-filter-row.sell{border-left-color:#ff7183!important}.cs-signal-filter-row>div:first-child strong,.cs-signal-filter-row>div:first-child span{display:block}.cs-signal-filter-row>div:first-child strong{font-size:14px}.cs-signal-filter-row>div:first-child span{margin-top:4px;color:#7695a4;font-size:10px}.cs-signal-filter-row small{display:block;color:#688a9a;font-size:7px;font-weight:900;letter-spacing:.08em}.cs-signal-filter-row b{display:block;margin-top:5px;font-size:12px}.cs-filter-score b{font-size:20px}.cs-filter-score em{display:block;margin-top:2px;font-size:7px;font-style:normal;font-weight:900}.cs-filter-score.buy em{color:#62efa5}.cs-filter-score.sell em{color:#ff7788}.cs-filter-score.watch em{color:#efc86e}.cs-filter-score.hold em{color:#62dfff}.cs-signal-filter-empty{padding:36px;border:1px dashed rgba(80,188,225,.14);border-radius:10px;text-align:center}.cs-signal-filter-empty b,.cs-signal-filter-empty span{display:block}.cs-signal-filter-empty span{margin-top:6px;color:#7391a0;font-size:10px}.cs-signal-filter-foot{margin-top:12px;color:#627f8f;font-size:8px;text-align:center}@media(max-width:850px){.cs-signal-filter-row{grid-template-columns:1fr 1fr}.cs-signal-filter-row>div:first-child{grid-column:1/-1}.cs-signal-filter-controls{grid-template-columns:1fr}.cs-signal-filter-controls span{text-align:left}}`}</style></>;
}
