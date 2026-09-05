"use client";

import { useEffect, useRef, useState } from "react";

type PulseStatus="BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";
type MarketScan={scannedAt:string;acceptedCount:number;rejectedCount:number;currentMedian:number|null;recentMedian:number|null;priorMedian:number|null;change7d:number|null;recentSales:number;velocity:number|null;pulse:PulseStatus;confidence:string;elapsedMs:number};
type Identity={playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};
type Card={id:number;player:string;meta?:string;mode?:"owned"|"watching";marketValue?:number;score?:number;year?:string;setName?:string;cardNumber?:string;variant?:string;marketScan?:MarketScan;canonicalIdentity?:Identity;liveValuation?:Record<string,unknown>};
type ScanResponse={ok:boolean;error?:string;acceptedCount?:number;rejectedCount?:number;currentMedian?:number|null;recentMedian?:number|null;priorMedian?:number|null;change7d?:number|null;recentSales?:number;velocity?:number|null;pulse?:PulseStatus;confidence?:string;elapsedMs?:number};

const CARD_KEY="cardsignal-added-cards",REVIEWED_KEY="cardsignal-reviewed-actions";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function writeCards(cards:Card[]){localStorage.setItem(CARD_KEY,JSON.stringify(cards));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
function reviewedKey(card:Card){return `${card.id}|${card.marketScan?.scannedAt||"never"}`}
function makeScan(j:ScanResponse):MarketScan{return{scannedAt:new Date().toISOString(),acceptedCount:Number(j.acceptedCount||0),rejectedCount:Number(j.rejectedCount||0),currentMedian:j.currentMedian??null,recentMedian:j.recentMedian??null,priorMedian:j.priorMedian??null,change7d:j.change7d??null,recentSales:Number(j.recentSales||0),velocity:j.velocity??null,pulse:j.pulse||"NOT ENOUGH DATA",confidence:j.confidence||"LOW",elapsedMs:Number(j.elapsedMs||0)}}

export default function PortfolioWorkbenchLayer(){
 const[selected,setSelected]=useState<Set<number>>(new Set()),[queue,setQueue]=useState({active:false,done:0,total:0,label:""}),[error,setError]=useState("");
 const rowMap=useRef<Map<number,HTMLElement>>(new Map());
 const refreshChecks=()=>{for(const[id,row]of rowMap.current){const box=row.querySelector<HTMLInputElement>(".cs-batch-check");if(box)box.checked=selected.has(id)}};
 useEffect(refreshChecks,[selected]);

 useEffect(()=>{
  const decorate=()=>{
   const modal=document.querySelector<HTMLElement>(".cs-portfolio-modal");if(!modal)return;
   const controls=modal.querySelector<HTMLElement>(".cs-portfolio-controls");
   if(controls&&!modal.querySelector(".cs-batch-toolbar")){
    const bar=document.createElement("div");bar.className="cs-batch-toolbar";bar.innerHTML=`<button data-batch="visible">Select visible</button><button data-batch="clear">Clear</button><span class="cs-batch-count">0 selected</span><i></i><button data-batch="scan">Rescan selected</button><button data-batch="owned">Mark owned</button><button data-batch="watch">Move to watchlist</button><button data-batch="review">Mark reviewed</button><button class="danger" data-batch="remove">Remove</button>`;controls.insertAdjacentElement("afterend",bar);
   }
   rowMap.current.clear();
   modal.querySelectorAll<HTMLElement>(".cs-portfolio-card[data-user-card-id]").forEach(row=>{const id=Number(row.dataset.userCardId);if(!Number.isFinite(id))return;rowMap.current.set(id,row);if(!row.querySelector(".cs-batch-check")){const label=document.createElement("label");label.className="cs-batch-select";label.title="Select card";label.innerHTML=`<input class="cs-batch-check" type="checkbox" aria-label="Select card"><span></span>`;row.insertAdjacentElement("afterbegin",label);const box=label.querySelector<HTMLInputElement>("input")!;box.addEventListener("click",e=>e.stopPropagation());box.addEventListener("change",()=>setSelected(prev=>{const next=new Set(prev);box.checked?next.add(id):next.delete(id);return next}))}const box=row.querySelector<HTMLInputElement>(".cs-batch-check");if(box)box.checked=selected.has(id)});
   const count=modal.querySelector<HTMLElement>(".cs-batch-count");if(count)count.textContent=`${selected.size} selected`;
  };
  decorate();const obs=new MutationObserver(decorate);obs.observe(document.body,{childList:true,subtree:true});return()=>obs.disconnect();
 },[selected]);

 const runScan=async(ids:number[])=>{
  if(queue.active||!ids.length)return;setError("");setQueue({active:true,done:0,total:ids.length,label:"Scanning selected cards"});let current=readCards();
  for(let i=0;i<ids.length;i++){
   const card=current.find(c=>c.id===ids[i]);if(!card){setQueue(q=>({...q,done:i+1}));continue}const id=card.canonicalIdentity||{};const p=new URLSearchParams({player:id.playerName||card.player,year:id.year||card.year||"",set:id.setName||card.setName||"",cardNumber:id.cardNumber||card.cardNumber||"",variant:id.variation||card.variant||""});
   try{const r=await fetch(`/api/portfolio-scan?${p.toString()}`,{cache:"no-store"});const j=await r.json() as ScanResponse;if(!r.ok||!j.ok)throw new Error(j.error||"Scan failed");const s=makeScan(j);current=current.map(c=>c.id===card.id?{...c,marketScan:s,marketValue:s.currentMedian??c.marketValue??0,liveValuation:{...(c.liveValuation||{}),provider:"Batch Portfolio Scan",compCount:s.acceptedCount,median:s.currentMedian??undefined,confidence:s.confidence,savedAt:s.scannedAt}}:c);writeCards(current)}catch(e){setError(`${card.player}: ${e instanceof Error?e.message:"Scan failed"}`)}setQueue(q=>({...q,done:i+1}));
  }
  setQueue(q=>({...q,active:false,label:"Scan complete"}));setTimeout(()=>setQueue({active:false,done:0,total:0,label:""}),3000);
 };

 useEffect(()=>{
  const click=(e:MouseEvent)=>{const btn=(e.target as HTMLElement).closest<HTMLButtonElement>("[data-batch]");if(!btn)return;e.preventDefault();e.stopPropagation();const action=btn.dataset.batch;const cards=readCards();const ids=[...selected];
   if(action==="visible"){const visible=[...rowMap.current.entries()].filter(([,row])=>row.offsetParent!==null).map(([id])=>id);setSelected(new Set(visible));return}
   if(action==="clear"){setSelected(new Set());return}
   if(!ids.length)return;
   if(action==="scan"){runScan(ids);return}
   if(action==="owned"||action==="watch"){const mode=action==="owned"?"owned":"watching";writeCards(cards.map(c=>selected.has(c.id)?{...c,mode}:c));setSelected(new Set());return}
   if(action==="review"){let reviewed:Record<string,boolean>={};try{reviewed=JSON.parse(localStorage.getItem(REVIEWED_KEY)||"{}")||{}}catch{}for(const c of cards)if(selected.has(c.id))reviewed[reviewedKey(c)]=true;localStorage.setItem(REVIEWED_KEY,JSON.stringify(reviewed));window.dispatchEvent(new Event("cardsignal:history-changed"));setSelected(new Set());return}
   if(action==="remove"){if(!window.confirm(`Remove ${ids.length} selected card${ids.length===1?"":"s"} from CardSignal?`))return;writeCards(cards.filter(c=>!selected.has(c.id)));setSelected(new Set());return}
  };
  document.addEventListener("click",click,true);return()=>document.removeEventListener("click",click,true);
 },[selected,queue.active]);

 return <>
  {(queue.total>0||error)&&<div className="cs-scan-queue"><div><span>{queue.label||"Batch scan"}</span><b>{queue.total?`${queue.done} / ${queue.total}`:""}</b></div>{queue.total>0&&<div className="cs-scan-track"><i style={{width:`${queue.total?Math.round(queue.done/queue.total*100):0}%`}}/></div>}{error&&<small>{error}</small>}</div>}
  <style jsx global>{`
   .cs-portfolio-card{position:relative}.cs-batch-select{width:24px;height:100%;display:grid;place-items:center;align-self:stretch;cursor:pointer}.cs-batch-select input{position:absolute;opacity:0;pointer-events:none}.cs-batch-select span{width:15px;height:15px;border:1px solid rgba(90,191,229,.28);border-radius:4px;background:#061521;box-shadow:inset 0 0 0 2px #061521}.cs-batch-select input:checked+span{background:#49e99a;border-color:#63f0aa;box-shadow:inset 0 0 0 3px #061521,0 0 10px rgba(73,233,154,.35)}
   .cs-portfolio-card:has(.cs-batch-check){grid-template-columns:24px 62px minmax(220px,1fr) 120px 110px 190px}.cs-batch-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 12px;padding:9px;border:1px solid rgba(82,190,229,.12);border-radius:9px;background:rgba(5,19,30,.6)}.cs-batch-toolbar button{height:30px;padding:0 9px;border:1px solid rgba(80,188,225,.16);border-radius:7px;background:#071724;color:#8eb0c0;font-size:8px;font-weight:900;letter-spacing:.04em;cursor:pointer}.cs-batch-toolbar button:hover{border-color:rgba(80,221,255,.36);color:#d8f7ff}.cs-batch-toolbar button.danger:hover{border-color:rgba(255,95,112,.4);color:#ff8896}.cs-batch-toolbar span{color:#8cc7d8;font-size:9px;font-weight:900}.cs-batch-toolbar i{flex:1}
   .cs-scan-queue{position:fixed;right:22px;top:118px;z-index:1700;width:280px;padding:12px;border:1px solid rgba(80,201,241,.24);border-radius:10px;background:rgba(4,21,33,.97);box-shadow:0 18px 55px rgba(0,0,0,.42);color:#e9faff}.cs-scan-queue>div:first-child{display:flex;justify-content:space-between;gap:12px;align-items:center}.cs-scan-queue span{font-size:9px;font-weight:900;letter-spacing:.07em}.cs-scan-queue b{font-size:10px;color:#8df5bd}.cs-scan-track{height:5px;margin-top:8px;border-radius:999px;background:#0b2534;overflow:hidden}.cs-scan-track i{display:block;height:100%;background:#49e99a;transition:width .2s ease}.cs-scan-queue small{display:block;margin-top:7px;color:#ff8c99;font-size:8px;line-height:1.4}
   @media(max-width:850px){.cs-portfolio-card:has(.cs-batch-check){grid-template-columns:24px 52px 1fr 90px}.cs-batch-select{grid-row:1/3}.cs-scan-queue{top:88px;right:12px;width:min(280px,calc(100vw - 24px))}}
  `}</style>
 </>;
}
