"use client";

import { useEffect } from "react";
import { getCardSignalScore } from "./card-signal-score";

type Card={id:number;player:string;meta?:string;marketValue?:number;marketScan?:{scannedAt?:string;acceptedCount?:number;change7d?:number|null;velocity?:number|null;pulse?:"BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";confidence?:string}};
const KEY="cardsignal-added-cards";
function cards():Card[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function norm(v?:string){return String(v||"").trim().replace(/\s+/g," ").toLowerCase()}
function findByText(player?:string,meta?:string){if(!player)return null;const all=cards(),exact=all.filter(c=>norm(c.player)===norm(player)&&(!meta||norm(c.meta)===norm(meta)));if(exact.length===1)return exact[0];const same=all.filter(c=>norm(c.player)===norm(player));return same.length===1?same[0]:null}
function findForModal(modal:HTMLElement){const id=Number(modal.dataset.userCardId||0);if(id){const byId=cards().find(c=>c.id===id);if(byId)return byId}return findByText(modal.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim(),modal.querySelector<HTMLElement>(".cs-detail-head p")?.textContent?.trim())}
function safe(v:string){return v.replace(/[<>]/g,"")}

export default function CardSignalScoreLayer(){
 useEffect(()=>{
  let queued=false;
  const apply=()=>{
   queued=false;
   const hero=document.querySelector<HTMLElement>(".top-signal");
   if(hero){
    const player=hero.querySelector<HTMLElement>(".panel-heading h2")?.textContent?.trim();
    const meta=hero.querySelector<HTMLElement>(".panel-heading p")?.textContent?.trim();
    const card=findByText(player,meta);
    if(card){
      const sc=getCardSignalScore(card);
      const label=hero.querySelector<HTMLElement>(".signal-primary .label");
      const value=hero.querySelector<HTMLElement>(".massive-score");
      const scoreText=sc.score?String(sc.score):"—";
      if(label&&label.textContent!=="CARDSIGNAL SCORE")label.textContent="CARDSIGNAL SCORE";
      if(value&&value.textContent!==scoreText)value.textContent=scoreText;
    }
   }
   const modal=document.querySelector<HTMLElement>(".cs-detail-modal");
   if(modal){
    const card=findForModal(modal);
    if(card){
     const sc=getCardSignalScore(card);let strip=modal.querySelector<HTMLElement>(".cs-unified-score");
     if(!strip){strip=document.createElement("div");strip.className="cs-unified-score";modal.querySelector(".cs-detail-head")?.insertAdjacentElement("afterend",strip)}
     if(strip){const c=sc.components;const cls=`cs-unified-score ${sc.tone}`;const html=`<div class="cs-us-main"><small>CARDSIGNAL SCORE</small><strong>${sc.score||"—"}</strong><span>${safe(sc.label)}</span></div><div class="cs-us-components"><p><span>Price direction</span><b>${c.price}/30</b></p><p><span>Sales velocity</span><b>${c.velocity}/20</b></p><p><span>Market evidence</span><b>${c.evidence}/20</b></p><p><span>Confidence</span><b>${c.confidence}/15</b></p><p><span>Freshness</span><b>${c.freshness}/15</b></p></div>`;if(strip.className!==cls)strip.className=cls;if(strip.innerHTML!==html)strip.innerHTML=html;}
    }
   }
  };
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(apply)};
  apply();
  const obs=new MutationObserver(schedule);obs.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("cardsignal:user-cards-changed",schedule);
  return()=>{obs.disconnect();window.removeEventListener("cardsignal:user-cards-changed",schedule)};
 },[]);
 return <style jsx global>{`
 .cs-unified-score{display:grid;grid-template-columns:170px 1fr;gap:14px;align-items:center;margin:16px 0 4px;padding:13px 14px;border:1px solid rgba(84,204,244,.14);border-left:3px solid #62dfff;border-radius:10px;background:rgba(5,21,33,.65)}.cs-unified-score.buy{border-left-color:#58eda1}.cs-unified-score.sell{border-left-color:#ff7082}.cs-unified-score.watch{border-left-color:#efc86e}.cs-unified-score.data{border-left-color:#a89cdf}.cs-us-main small,.cs-us-main strong,.cs-us-main span{display:block}.cs-us-main small{color:#6c8d9d;font-size:7px;font-weight:900;letter-spacing:.12em}.cs-us-main strong{margin:3px 0;font-size:28px}.cs-us-main span{font-size:8px;font-weight:900;color:#8fdff5}.cs-unified-score.buy .cs-us-main span{color:#62efa5}.cs-unified-score.sell .cs-us-main span{color:#ff8291}.cs-unified-score.watch .cs-us-main span{color:#efc86e}.cs-unified-score.data .cs-us-main span{color:#b7a9ff}.cs-us-components{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.cs-us-components p{margin:0;padding:8px;border:1px solid rgba(78,188,226,.08);border-radius:7px;background:rgba(6,24,37,.72)}.cs-us-components span,.cs-us-components b{display:block}.cs-us-components span{color:#6d8d9c;font-size:6px}.cs-us-components b{margin-top:3px;font-size:9px;color:#cce1e9}@media(max-width:720px){.cs-unified-score{grid-template-columns:1fr}.cs-us-components{grid-template-columns:repeat(2,1fr)}}
 `}</style>;
}
