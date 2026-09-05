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
 const[ready,setReady]=useState(false),[open,setOpen]=useState(false),[cards,setCards]=useState<Card[]>([]),[alerts,setAlerts]=useState<Alert[]>([]),[reviewed,setReviewed]=useState<Record<string,boolean>>({}),[scanning,setScanning]=useState<number|null>(null),[error,setError]=useState("");
 const refresh=()=>{setCards(readCards());setAlerts(readJson<Alert[]>(ALERTS_KEY,[]));setReviewed(readJson<Record<string,boolean>>(REVIEWED_KEY,{}));};
 useEffect(()=>{setReady(true);refresh();const h=()=>refresh();window.addEventListener("cardsignal:user-cards-changed",h);window.addEventListener("cardsignal:history-changed",h);window.addEventListener("storage",h);return()=>{window.removeEventListener("cardsignal:user-cards-changed",h);window.removeEventListener("cardsignal:history-changed",h);window.removeEventListener("storage",h)}},[]);
 useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[open]);
 const actions=useMemo(()=>buildActions(cards,alerts,reviewed),[cards,alerts,reviewed]);
 const counts=useMemo(()=>({act:actions.filter(a=>a.kind==="ACT NOW").length,review:actions.filter(a=>a.kind==="REVIEW TODAY").length,scan:actions.filter(a=>a.kind==="NEEDS SCAN").length,data:actions.filter(a=>a.kind==="NEEDS DATA").length}),[actions]);
 const attention=counts.act+counts.review;
 const markReviewed=(card:Card)=>{const next={...reviewed,[reviewedKey(card)]:true};localStorage.setItem(REVIEWED_KEY,JSON.stringify(next));setReviewed(next)};
 const rescan=async(card:Card)=>{if(scanning)return;setScanning(card.id);setError("");const id=card.canonicalIdentity||{};const p=new URLSearchParams({player:id.playerName||card.player,year:id.year||card.year||"",set:id.setName||card.setName||"",cardNumber:id.cardNumber||card.cardNumber||"",variant:id.variation||card.variant||""});try{const r=await fetch(`/api/portfolio-scan?${p.toString()}`,{cache:"no-store"});const j=await r.json() as ScanResponse;if(!r.ok||!j.ok)throw new Error(j.error||"Scan failed");const scan:MarketScan={scannedAt:new Date().toISOString(),acceptedCount:Number(j.acceptedCount||0),rejectedCount:Number(j.rejectedCount||0),currentMedian:j.currentMedian??null,recentMedian:j.recentMedian??null,priorMedian:j.priorMedian??null,change7d:j.change7d??null,recentSales:Number(j.recentSales||0),velocity:j.velocity??null,pulse:j.pulse||"NOT ENOUGH DATA",confidence:j.confidence||"LOW",elapsedMs:Number(j.elapsedMs||0)};const next=readCards().map(c=>c.id===card.id?{...c,marketScan:scan,marketValue:scan.currentMedian??c.marketValue??0,score:Math.round(scoreFromScan(scan)),liveValuation:{...(c.liveValuation||{}),provider:"Action Center Scan",compCount:scan.acceptedCount,median:scan.currentMedian??undefined,confidence:scan.confidence,savedAt:scan.scannedAt}}:c);localStorage.setItem(CARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}catch(e){setError(e instanceof Error?e.message:"Scan failed")}finally{setScanning(null)}};
 if(!ready)return null;
 return createPortal(<>
  <button className="cs-ac-launch" onClick={()=>setOpen(true)}><span>⚡</span><b>ACTION CENTER</b>{attention>0&&<i>{attention}</i>}</button>
  {open&&<div className="cs-ac-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><aside className="cs-ac-drawer" role="dialog" aria-modal="true" aria-label="Action Center">
   <button className="cs-ac-close" onClick={()=>setOpen(false)}>×</button>
   <div className="cs-ac-drawer-head"><span>ACTION CENTER</span><h2>What deserves attention today</h2><p>Highest-priority cards first. Tap a card to open its full market terminal.</p></div>
   <div className="cs-ac-counts"><b className="danger">{counts.act} act now</b><b>{counts.review} review</b><b>{counts.scan} stale</b><b>{counts.data} need data</b></div>
   {error&&<div className="cs-ac-error">{error}</div>}
   <div className="cs-ac-list">{actions.length?actions.slice(0,20).map(a=><article key={`${a.card.id}-${a.kind}`} className={`signal-row cs-ac-row ${a.kind.toLowerCase().replaceAll(" ","-")}`} data-user-card-id={a.card.id} onClick={()=>setOpen(false)}>
    <div className="cs-ac-row-top"><span className="cs-ac-priority">{a.kind}</span><div className="cs-ac-card"><strong>{a.card.player}</strong><span>{a.card.meta||[a.card.year,a.card.setName,a.card.cardNumber&&`#${a.card.cardNumber}`].filter(Boolean).join(" · ")||"Saved card"}</span></div></div>
    <div className="cs-ac-why"><strong>{a.why}</strong><span>{a.detail}</span></div>
    <div className="cs-ac-actions">{a.kind!=="WATCHING"&&<button onClick={e=>{e.stopPropagation();rescan(a.card)}} disabled={scanning===a.card.id}>{scanning===a.card.id?"Scanning…":"Rescan"}</button>}{(a.kind==="ACT NOW"||a.kind==="REVIEW TODAY")&&<button onClick={e=>{e.stopPropagation();markReviewed(a.card)}}>Mark reviewed</button>}<button className="open">Open card →</button></div>
   </article>):<div className="cs-ac-empty"><b>No immediate actions</b><span>Your scanned portfolio has no urgent or stale items right now.</span></div>}</div>
   {actions.length>20&&<div className="cs-ac-more">Showing top 20 of {actions.length} actions. Lower-priority items remain available in Portfolio Pulse.</div>}
  </aside></div>}
  <style jsx global>{`
  .cs-ac-launch{position:fixed;right:24px;bottom:74px;z-index:920;height:42px;display:flex;align-items:center;gap:8px;padding:0 14px;border:1px solid rgba(89,218,255,.28);border-radius:10px;background:rgba(6,30,46,.95);color:#9be9ff;font-size:9px;font-weight:900;letter-spacing:.09em;box-shadow:0 12px 35px rgba(0,0,0,.28);cursor:pointer}.cs-ac-launch span{font-size:13px}.cs-ac-launch i{min-width:20px;height:20px;display:grid;place-items:center;padding:0 5px;border-radius:999px;background:#ff667a;color:white;font-size:9px;font-style:normal;letter-spacing:0}
  .cs-ac-backdrop{position:fixed;inset:0;z-index:1580;background:rgba(0,7,12,.55);backdrop-filter:blur(7px)}.cs-ac-drawer{position:absolute;right:0;top:0;width:min(520px,94vw);height:100%;overflow:auto;padding:28px 24px 24px;border-left:1px solid rgba(82,198,240,.2);background:linear-gradient(160deg,#081d2e,#04111d 68%,#061821);box-shadow:-30px 0 80px rgba(0,0,0,.5);color:#eefaff}.cs-ac-close{position:absolute;right:16px;top:14px;width:34px;height:34px;border:1px solid rgba(95,190,226,.16);border-radius:8px;background:#071724;color:#8eb1c1;font-size:24px;cursor:pointer}
  .cs-ac-drawer-head{padding-right:42px}.cs-ac-drawer-head>span{color:#59ddff;font-size:10px;font-weight:900;letter-spacing:.16em}.cs-ac-drawer-head h2{margin:7px 0 5px;font-size:23px;line-height:1.2}.cs-ac-drawer-head p{margin:0;color:#7e9dac;font-size:11px;line-height:1.5}
  .cs-ac-counts{display:flex;flex-wrap:wrap;gap:7px;margin:17px 0 12px}.cs-ac-counts b{padding:6px 8px;border:1px solid rgba(81,190,230,.16);border-radius:7px;color:#93b9c8;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.cs-ac-counts b.danger{color:#ff98a4;border-color:rgba(255,103,123,.28)}
  .cs-ac-list{display:flex;flex-direction:column;gap:8px}.cs-ac-row{display:block!important;padding:14px!important;border:1px solid rgba(78,183,224,.11)!important;border-radius:10px;background:rgba(5,20,32,.64);cursor:pointer}.cs-ac-row:hover{background:rgba(10,35,52,.82)}.cs-ac-row-top{display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:start}.cs-ac-priority{display:inline-block;width:max-content;max-width:88px;padding:6px 7px;border-radius:6px;border:1px solid rgba(85,202,241,.22);color:#83e6fb;font-size:9px;font-weight:900;letter-spacing:.04em;line-height:1.1}.cs-ac-row.act-now .cs-ac-priority{color:#ff9aa6;border-color:rgba(255,103,123,.35);background:rgba(180,45,62,.10)}.cs-ac-row.review-today .cs-ac-priority{color:#f4cf79;border-color:rgba(240,201,110,.3)}.cs-ac-row.needs-data .cs-ac-priority{color:#c0afff;border-color:rgba(160,135,255,.28)}
  .cs-ac-card strong,.cs-ac-card span,.cs-ac-why strong,.cs-ac-why span{display:block}.cs-ac-card strong{font-size:14px;color:#edf9fd;line-height:1.2}.cs-ac-card span{margin-top:3px;color:#7796a6;font-size:10px;line-height:1.35}.cs-ac-why{margin:11px 0 10px;padding-top:10px;border-top:1px solid rgba(78,183,224,.08)}.cs-ac-why strong{font-size:12px;color:#c7dae2}.cs-ac-why span{margin-top:4px;color:#819eac;font-size:10px;line-height:1.45}
  .cs-ac-actions{display:flex;gap:7px;flex-wrap:wrap}.cs-ac-actions button{height:32px;padding:0 10px;border:1px solid rgba(78,191,231,.2);border-radius:7px;background:#071a27;color:#9ad1e4;font-size:10px;font-weight:800;cursor:pointer}.cs-ac-actions button.open{margin-left:auto;border-color:rgba(64,235,151,.28);color:#a4f8c7;background:rgba(43,191,120,.08)}.cs-ac-actions button:disabled{opacity:.45}.cs-ac-error{margin:10px 0;padding:9px;border:1px solid rgba(255,103,123,.22);border-radius:7px;color:#ffabb6;font-size:10px}.cs-ac-empty{padding:34px;text-align:center;border:1px dashed rgba(78,183,224,.12);border-radius:10px}.cs-ac-empty b,.cs-ac-empty span{display:block}.cs-ac-empty b{font-size:13px}.cs-ac-empty span{margin-top:5px;color:#7898a6;font-size:10px}.cs-ac-more{padding-top:12px;color:#678997;font-size:9px;text-align:center}
  @media(max-width:700px){.cs-ac-launch{right:14px;bottom:72px}.cs-ac-drawer{width:100%;padding:24px 18px}.cs-ac-actions button.open{margin-left:0}}
  `}</style>
 </>,document.body);
}
