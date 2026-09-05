"use client";

import { useEffect, useState } from "react";

type Pulse="BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";
type Card={id:number;player:string;meta?:string;year?:string;setName?:string;cardNumber?:string;variant?:string;mode?:"owned"|"watching";marketValue?:number;canonicalIdentity?:{playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};marketScan?:{scannedAt?:string;acceptedCount?:number;rejectedCount?:number;currentMedian?:number|null;recentMedian?:number|null;priorMedian?:number|null;change7d?:number|null;recentSales?:number;velocity?:number|null;pulse?:Pulse;confidence?:string;elapsedMs?:number;acceptedSales?:unknown[]}};
type Entry={id:string;cardId:number;player:string;meta?:string;createdAt:string;action:"BUY CANDIDATE"|"SELL CANDIDATE"|"REVIEWED"|"DISMISSED"|"WATCHLIST"|"OWNED";reason?:string;note?:string;marketValue?:number;score?:number;change7d?:number|null;kind?:string};
const CARD_KEY="cardsignal-added-cards",JOURNAL_KEY="cardsignal-decision-journal",DISMISS_KEY="cardsignal-opportunity-dismissed";
function read<T>(key:string,fallback:T):T{try{return(JSON.parse(localStorage.getItem(key)||"")??fallback) as T}catch{return fallback}}
function cards(){const v=read<Card[]>(CARD_KEY,[]);return Array.isArray(v)?v:[]}
function saveCards(v:Card[]){localStorage.setItem(CARD_KEY,JSON.stringify(v));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
function findCard(row:HTMLElement){const list=cards();const player=row.querySelector<HTMLElement>(".cs-op-title strong")?.textContent?.trim()||"";const meta=row.querySelector<HTMLElement>(".cs-op-title small")?.textContent?.trim()||"";return list.find(c=>c.player===player&&(!meta||c.meta===meta))||list.find(c=>c.player===player)||null}
function log(card:Card,action:Entry["action"],row:HTMLElement,note?:string){const all=read<Entry[]>(JOURNAL_KEY,[]);const scoreText=row.querySelector<HTMLElement>(".cs-op-metrics>div:first-child b")?.textContent?.trim();const kind=row.querySelector<HTMLElement>(".cs-op-title>span")?.textContent?.trim();const why=row.querySelector<HTMLElement>(".cs-op-main>p")?.textContent?.trim();const entry:Entry={id:`${card.id}-${Date.now()}-${action}`,cardId:card.id,player:card.player,meta:card.meta,createdAt:new Date().toISOString(),action,reason:why,note,marketValue:card.marketValue,score:Number(scoreText)||undefined,change7d:card.marketScan?.change7d,kind};localStorage.setItem(JOURNAL_KEY,JSON.stringify([entry,...(Array.isArray(all)?all:[])].slice(0,1000)));window.dispatchEvent(new Event("cardsignal:journal-changed"))}
function dismissMap(){return read<Record<string,string>>(DISMISS_KEY,{})}

export default function OpportunityActionsLayer(){
 const[,setTick]=useState(0);
 useEffect(()=>{
  let busy=false;
  const decorate=()=>{
   if(busy)return;busy=true;
   try{
    const dismissed=dismissMap(),now=Date.now();
    document.querySelectorAll<HTMLElement>(".cs-op-row").forEach(row=>{
     const card=findCard(row);if(!card)return;row.dataset.userCardId=String(card.id);
     const until=dismissed[String(card.id)]?new Date(dismissed[String(card.id)]).getTime():0;
     row.style.display=until>now?"none":"";
     if(row.querySelector(".cs-op-actionbar"))return;
     const host=document.createElement("div");host.className="cs-op-actionbar";host.innerHTML='<button data-act="rescan">↻ RESCAN</button><button data-act="watch">WATCHLIST</button><button data-act="buy">＋ BUY CANDIDATE</button><button data-act="sell">− SELL CANDIDATE</button><button data-act="review">✓ REVIEWED</button><button data-act="note">NOTE</button><button data-act="dismiss">DISMISS 24H</button>';
     const main=row.querySelector(".cs-op-main");main?.appendChild(host);
    });
   }finally{busy=false}
  };
  const obs=new MutationObserver(decorate);obs.observe(document.body,{childList:true,subtree:true});decorate();
  const click=async(e:MouseEvent)=>{
   const b=(e.target as HTMLElement).closest<HTMLButtonElement>(".cs-op-actionbar button");if(!b)return;e.preventDefault();e.stopPropagation();const row=b.closest<HTMLElement>(".cs-op-row");if(!row)return;const card=findCard(row);if(!card)return;const act=b.dataset.act;
   if(act==="buy"||act==="sell"||act==="review"){const action=act==="buy"?"BUY CANDIDATE":act==="sell"?"SELL CANDIDATE":"REVIEWED";log(card,action,row);b.textContent=act==="buy"?"✓ BUY FLAGGED":act==="sell"?"✓ SELL FLAGGED":"✓ REVIEWED";return}
   if(act==="note"){const note=window.prompt(`Note for ${card.player}:`,"");if(note?.trim())log(card,"REVIEWED",row,note.trim());return}
   if(act==="watch"){const next=cards().map(c=>c.id===card.id?{...c,mode:c.mode==="watching"?"owned":"watching"}:c);const updated=next.find(c=>c.id===card.id)!;saveCards(next);log(updated,updated.mode==="watching"?"WATCHLIST":"OWNED",row);b.textContent=updated.mode==="watching"?"✓ WATCHING":"✓ OWNED";return}
   if(act==="dismiss"){const until=new Date(Date.now()+24*3600000).toISOString();const d={...dismissMap(),[String(card.id)]:until};localStorage.setItem(DISMISS_KEY,JSON.stringify(d));log(card,"DISMISSED",row);row.style.display="none";setTick(v=>v+1);return}
   if(act==="rescan"){
    if(b.disabled)return;b.disabled=true;const old=b.textContent;b.textContent="SCANNING…";const id=card.canonicalIdentity||{};const p=new URLSearchParams({player:id.playerName||card.player,year:id.year||card.year||"",set:id.setName||card.setName||"",cardNumber:id.cardNumber||card.cardNumber||"",variant:id.variation||card.variant||""});
    try{const r=await fetch(`/api/portfolio-scan?${p.toString()}`,{cache:"no-store"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Scan failed");const scannedAt=new Date().toISOString();const next=cards().map(c=>c.id===card.id?{...c,marketScan:{scannedAt,acceptedCount:Number(j.acceptedCount||0),rejectedCount:Number(j.rejectedCount||0),currentMedian:j.currentMedian??null,recentMedian:j.recentMedian??null,priorMedian:j.priorMedian??null,change7d:j.change7d??null,recentSales:Number(j.recentSales||0),velocity:j.velocity??null,pulse:j.pulse||"NOT ENOUGH DATA",confidence:j.confidence||"LOW",elapsedMs:Number(j.elapsedMs||0),acceptedSales:Array.isArray(j.acceptedSales)?j.acceptedSales:[]},marketValue:j.currentMedian??c.marketValue??0}:c);saveCards(next);b.textContent="✓ RESCANNED";window.setTimeout(()=>{b.textContent=old||"↻ RESCAN"},1400)}catch(err){b.textContent=err instanceof Error?"SCAN FAILED":"SCAN FAILED";window.setTimeout(()=>{b.textContent=old||"↻ RESCAN"},1800)}finally{b.disabled=false}
   }
  };
  document.addEventListener("click",click,true);return()=>{obs.disconnect();document.removeEventListener("click",click,true)}
 },[]);
 return <style jsx global>{`
 .cs-op-actionbar{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;padding-top:7px;border-top:1px solid rgba(76,184,224,.07)}.cs-op-actionbar button{height:26px;padding:0 7px;border:1px solid rgba(76,184,224,.14);border-radius:6px;background:rgba(7,27,41,.72);color:#89adbd;font-size:6px;font-weight:900;letter-spacing:.035em;cursor:pointer}.cs-op-actionbar button:hover{color:#e2f8ff;border-color:rgba(83,211,249,.35)}.cs-op-actionbar button[data-act="buy"]{color:#71e9a8;border-color:rgba(83,235,156,.22)}.cs-op-actionbar button[data-act="sell"]{color:#ff8c99;border-color:rgba(255,112,130,.22)}.cs-op-actionbar button[data-act="dismiss"]{color:#9e8fba}.cs-op-actionbar button:disabled{opacity:.45}
 `}</style>
}
