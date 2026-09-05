"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type PulseStatus="BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";
type MarketScan={scannedAt:string;acceptedCount:number;rejectedCount:number;currentMedian:number|null;recentMedian:number|null;priorMedian:number|null;change7d:number|null;recentSales:number;velocity:number|null;pulse:PulseStatus;confidence:string;elapsedMs:number};
type Identity={playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};
type Card={id:number;player:string;meta?:string;year?:string;setName?:string;cardNumber?:string;variant?:string;mode?:"owned"|"watching";marketValue?:number;score?:number;marketScan?:MarketScan;canonicalIdentity?:Identity;liveValuation?:{compCount?:number;median?:number;confidence?:string;savedAt?:string}};
type ScanResponse={ok:boolean;error?:string;acceptedCount?:number;rejectedCount?:number;currentMedian?:number|null;recentMedian?:number|null;priorMedian?:number|null;change7d?:number|null;recentSales?:number;velocity?:number|null;pulse?:PulseStatus;confidence?:string;elapsedMs?:number};
type Alert={id:string;cardId:number;createdAt:string;kind:string;title:string;detail:string;read?:boolean};
type ActionKind="ACT NOW"|"REVIEW TODAY"|"NEEDS SCAN"|"NEEDS DATA"|"WATCHING";
type Action={card:Card;kind:ActionKind;why:string;detail:string;cta:string;rank:number};

const CARD_KEY="cardsignal-added-cards",ALERTS_KEY="cardsignal-alerts",REVIEWED_KEY="cardsignal-reviewed-actions";
function readJson<T>(key:string,fallback:T):T{try{const v=JSON.parse(localStorage.getItem(key)||"");return(v??fallback)as T}catch{return fallback}}
function readCards(){const v=readJson<Card[]>(CARD_KEY,[]);return Array.isArray(v)?v:[]}
function pct(v:number|null|undefined){return v==null?"—":`${v>=0?"+":""}${v.toFixed(1)}%`}
function money(v:number|null|undefined){return v==null?"—":`$${v.toLocaleString(undefined,{maximumFractionDigits:2})}`}
function ageHours(iso?:string){if(!iso)return Infinity;return Math.max(0,Date.now()-new Date(iso).getTime())/3600000}
function scoreFromScan(s:MarketScan){if(s.pulse==="BUY MORE")return Math.min(95,72+Math.round((s.change7d||0)/2)+(s.velocity||0)/10);if(s.pulse==="SELL RISK")return Math.max(20,45+Math.round((s.change7d||0)/2));if(s.pulse==="WATCH CLOSELY")return 58;if(s.pulse==="HOLD")return 64;return 0}
function reviewedKey(card:Card){return `${card.id}|${card.marketScan?.scannedAt||"never"}`}

function buildActions(cards:Card[],alerts:Alert[],reviewed:Record<string,boolean>):Action[]{
 const latestAlert=new Map<number,Alert>();
 for(const a of [...alerts].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()))if(!latestAlert.has(a.cardId))latestAlert.set(a.cardId,a);
 const out:Action[]=[];
 for(const card of cards){
  const s=card.marketScan,isReviewed=!!reviewed[reviewedKey(card)];
  if(card.mode==="watching"){out.push({card,kind:"WATCHING",why:"Monitored card",detail:s?`${s.acceptedCount} matches · ${pct(s.change7d)} 7D`:"Not scanned yet",cta:"Open card",rank:50});continue}
  if(!s){out.push({card,kind:"NEEDS SCAN",why:"No portfolio scan yet",detail:"No live market evidence has been collected for this card.",cta:"Scan now",rank:850});continue}
  if(s.acceptedCount<3){out.push({card,kind:"NEEDS DATA",why:`Only ${s.acceptedCount} accepted market match${s.acceptedCount===1?"":"es"}`,detail:"CardSignal is withholding a market signal until evidence improves.",cta:"Rescan",rank:700});continue}
  const alert=latestAlert.get(card.id),freshAlert=alert&&ageHours(alert.createdAt)<=24&&!alert.read;
  if(s.pulse==="SELL RISK"&&!isReviewed){out.push({card,kind:"ACT NOW",why:"SELL RISK",detail:`${pct(s.change7d)} 7D · ${s.acceptedCount} matches · ${s.confidence} confidence`,cta:"Review exit",rank:1200+Math.abs(s.change7d||0)});continue}
  if(s.pulse==="BUY MORE"&&!isReviewed){out.push({card,kind:"ACT NOW",why:"BUY MORE signal",detail:`${pct(s.change7d)} 7D · ${s.recentSales} recent sales · ${s.confidence} confidence`,cta:"Review buy",rank:1100+(s.change7d||0)});continue}
  if((s.pulse==="WATCH CLOSELY"||freshAlert)&&!isReviewed){out.push({card,kind:"REVIEW TODAY",why:freshAlert?alert!.title:"Meaningful market move",detail:freshAlert?alert!.detail:`${pct(s.change7d)} 7D · velocity ${s.velocity??"—"}/100`,cta:"Review",rank:900+Math.abs(s.change7d||0)});continue}
  if(ageHours(s.scannedAt)>=24){out.push({card,kind:"NEEDS SCAN",why:`Last scan ${Math.floor(ageHours(s.scannedAt))}h ago`,detail:`Last median ${money(s.currentMedian)} · ${s.acceptedCount} matches`,cta:"Refresh",rank:800});continue}
 }
 return out.sort((a,b)=>b.rank-a.rank);
}

export default function ActionCenterLayer(){
 const[mount,setMount]=useState<HTMLElement|null>(null),[cards,setCards]=useState<Card[]>([]),[alerts,setAlerts]=useState<Alert[]>([]),[reviewed,setReviewed]=useState<Record<string,boolean>>({}),[scanning,setScanning]=useState<number|null>(null),[error,setError]=useState("");
 const refresh=()=>{setCards(readCards());setAlerts(readJson<Alert[]>(ALERTS_KEY,[]));setReviewed(readJson<Record<string,boolean>>(REVIEWED_KEY,{}));};
 useEffect(()=>{const stat=document.querySelector<HTMLElement>(".stat-grid");if(!stat)return;let host=document.querySelector<HTMLElement>("#cardsignal-action-center-host");if(!host){host=document.createElement("div");host.id="cardsignal-action-center-host";stat.insertAdjacentElement("afterend",host)}setMount(host);refresh();const h=()=>refresh();window.addEventListener("cardsignal:user-cards-changed",h);window.addEventListener("cardsignal:history-changed",h);window.addEventListener("storage",h);return()=>{window.removeEventListener("cardsignal:user-cards-changed",h);window.removeEventListener("cardsignal:history-changed",h);window.removeEventListener("storage",h)}},[]);
 const actions=useMemo(()=>buildActions(cards,alerts,reviewed),[cards,alerts,reviewed]);
 const counts=useMemo(()=>({act:actions.filter(a=>a.kind==="ACT NOW").length,review:actions.filter(a=>a.kind==="REVIEW TODAY").length,scan:actions.filter(a=>a.kind==="NEEDS SCAN").length,data:actions.filter(a=>a.kind==="NEEDS DATA").length}),[actions]);
 const markReviewed=(card:Card)=>{const next={...reviewed,[reviewedKey(card)]:true};localStorage.setItem(REVIEWED_KEY,JSON.stringify(next));setReviewed(next)};
 const rescan=async(card:Card)=>{if(scanning)return;setScanning(card.id);setError("");const id=card.canonicalIdentity||{};const p=new URLSearchParams({player:id.playerName||card.player,year:id.year||card.year||"",set:id.setName||card.setName||"",cardNumber:id.cardNumber||card.cardNumber||"",variant:id.variation||card.variant||""});try{const r=await fetch(`/api/portfolio-scan?${p.toString()}`,{cache:"no-store"});const j=await r.json() as ScanResponse;if(!r.ok||!j.ok)throw new Error(j.error||"Scan failed");const scan:MarketScan={scannedAt:new Date().toISOString(),acceptedCount:Number(j.acceptedCount||0),rejectedCount:Number(j.rejectedCount||0),currentMedian:j.currentMedian??null,recentMedian:j.recentMedian??null,priorMedian:j.priorMedian??null,change7d:j.change7d??null,recentSales:Number(j.recentSales||0),velocity:j.velocity??null,pulse:j.pulse||"NOT ENOUGH DATA",confidence:j.confidence||"LOW",elapsedMs:Number(j.elapsedMs||0)};const next=readCards().map(c=>c.id===card.id?{...c,marketScan:scan,marketValue:scan.currentMedian??c.marketValue??0,score:Math.round(scoreFromScan(scan)),liveValuation:{...(c.liveValuation||{}),provider:"Action Center Scan",compCount:scan.acceptedCount,median:scan.currentMedian??undefined,confidence:scan.confidence,savedAt:scan.scannedAt}}:c);localStorage.setItem(CARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}catch(e){setError(e instanceof Error?e.message:"Scan failed")}finally{setScanning(null)}};
 if(!mount)return null;
 const visible=actions.slice(0,6);
 return createPortal(<section className="panel cs-action-center">
  <div className="cs-ac-head"><div><span>ACTION CENTER</span><h2>What deserves attention today</h2><p>Highest-priority cards first. Open a card for the full market terminal.</p></div><div className="cs-ac-counts"><b className="danger">{counts.act} act now</b><b>{counts.review} review</b><b>{counts.scan} stale</b><b>{counts.data} need data</b></div></div>
  {error&&<div className="cs-ac-error">{error}</div>}
  <div className="cs-ac-list">{visible.length?visible.map(a=><article key={`${a.card.id}-${a.kind}`} className={`signal-row cs-ac-row ${a.kind.toLowerCase().replaceAll(" ","-")}`} data-user-card-id={a.card.id}>
   <div className="cs-ac-priority"><span>{a.kind}</span></div>
   <div className="cs-ac-card"><strong>{a.card.player}</strong><span>{a.card.meta||[a.card.year,a.card.setName,a.card.cardNumber&&`#${a.card.cardNumber}`].filter(Boolean).join(" · ")||"Saved card"}</span></div>
   <div className="cs-ac-why"><strong>{a.why}</strong><span>{a.detail}</span></div>
   <div className="cs-ac-actions"><button className="open">{a.cta}</button>{a.kind!=="WATCHING"&&<button onClick={e=>{e.stopPropagation();rescan(a.card)}} disabled={scanning===a.card.id}>{scanning===a.card.id?"Scanning…":"Rescan"}</button>}{(a.kind==="ACT NOW"||a.kind==="REVIEW TODAY")&&<button onClick={e=>{e.stopPropagation();markReviewed(a.card)}}>Reviewed</button>}</div>
  </article>):<div className="cs-ac-empty"><b>No immediate actions</b><span>Your scanned portfolio has no urgent or stale items right now.</span></div>}</div>
  {actions.length>visible.length&&<div className="cs-ac-more">Showing top {visible.length} of {actions.length} actions. Lower-priority items remain available in Portfolio Pulse.</div>}
  <style jsx global>{`
  .cs-action-center{margin:0 0 22px;padding:22px 24px;border-color:rgba(79,202,244,.16)!important;background:linear-gradient(145deg,rgba(7,27,42,.95),rgba(4,18,29,.92))!important}
  .cs-ac-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid rgba(77,184,225,.12)}
  .cs-ac-head>div:first-child>span{color:#59ddff;font-size:11px;font-weight:900;letter-spacing:.16em}.cs-ac-head h2{margin:7px 0 5px;font-size:22px;line-height:1.2}.cs-ac-head p{margin:0;color:#7d9dac;font-size:12px;line-height:1.45}
  .cs-ac-counts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:520px}.cs-ac-counts b{padding:7px 10px;border:1px solid rgba(81,190,230,.16);border-radius:7px;color:#93b9c8;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.cs-ac-counts b.danger{color:#ff98a4;border-color:rgba(255,103,123,.28)}
  .cs-ac-list{display:flex;flex-direction:column}.cs-ac-row{display:grid!important;grid-template-columns:110px minmax(220px,.9fr) minmax(320px,1.3fr) minmax(250px,auto);gap:18px;align-items:center;padding:15px 0!important;border-bottom:1px solid rgba(78,183,224,.09)}.cs-ac-row:last-child{border-bottom:0}
  .cs-ac-priority span{display:inline-block;padding:7px 9px;border-radius:7px;border:1px solid rgba(85,202,241,.22);color:#83e6fb;font-size:10px;font-weight:900;letter-spacing:.05em;line-height:1.1}.cs-ac-row.act-now .cs-ac-priority span{color:#ff9aa6;border-color:rgba(255,103,123,.35);background:rgba(180,45,62,.10)}.cs-ac-row.review-today .cs-ac-priority span{color:#f4cf79;border-color:rgba(240,201,110,.3)}.cs-ac-row.needs-data .cs-ac-priority span{color:#c0afff;border-color:rgba(160,135,255,.28)}
  .cs-ac-card strong,.cs-ac-card span,.cs-ac-why strong,.cs-ac-why span{display:block}.cs-ac-card strong{font-size:14px;color:#edf9fd;line-height:1.25}.cs-ac-card span{margin-top:4px;color:#7897a7;font-size:11px;line-height:1.35}.cs-ac-why strong{font-size:13px;color:#c2d7df;line-height:1.25}.cs-ac-why span{margin-top:5px;color:#809eac;font-size:11px;line-height:1.4}
  .cs-ac-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}.cs-ac-actions button{height:36px;padding:0 13px;border:1px solid rgba(78,191,231,.2);border-radius:7px;background:#071a27;color:#9ad1e4;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.cs-ac-actions button.open{border-color:rgba(64,235,151,.3);color:#a4f8c7;background:rgba(43,191,120,.09)}.cs-ac-actions button:disabled{opacity:.45}
  .cs-ac-error{margin:12px 0 0;padding:10px;border:1px solid rgba(255,103,123,.22);border-radius:7px;color:#ffabb6;font-size:11px}.cs-ac-empty{padding:30px;text-align:center}.cs-ac-empty b{font-size:14px}.cs-ac-empty b,.cs-ac-empty span{display:block}.cs-ac-empty span{margin-top:6px;color:#7898a6;font-size:11px}.cs-ac-more{padding-top:12px;color:#678997;font-size:10px;text-align:right}
  @media(max-width:1100px){.cs-ac-head{flex-direction:column}.cs-ac-counts{justify-content:flex-start}.cs-ac-row{grid-template-columns:100px 1fr}.cs-ac-why{grid-column:2}.cs-ac-actions{grid-column:1/-1;justify-content:flex-start}}
  `}</style>
 </section>,mount);
}
