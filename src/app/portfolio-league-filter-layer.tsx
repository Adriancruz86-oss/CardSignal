"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {CARD_LEAGUES,getCardLeague,type CardLeague,type LeagueCard} from "./card-league";

type Card=LeagueCard&{id:number;mode?:"owned"|"watching"};
const CARD_KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}

export default function PortfolioLeagueFilterLayer(){
 const[host,setHost]=useState<HTMLElement|null>(null),[league,setLeague]=useState<"ALL"|CardLeague>("ALL"),[version,setVersion]=useState(0);
 useEffect(()=>{
  const apply=()=>{
   const modal=document.querySelector<HTMLElement>(".cs-portfolio-modal");
   if(!modal){setHost(null);return}
   const controls=modal.querySelector<HTMLElement>(".cs-portfolio-controls");
   if(controls){let h=controls.querySelector<HTMLElement>("#cs-league-filter-host");if(!h){h=document.createElement("div");h.id="cs-league-filter-host";controls.insertBefore(h,controls.lastElementChild||null)}setHost(h)}
   const cards=readCards();
   modal.querySelectorAll<HTMLElement>(".cs-portfolio-card[data-user-card-id]").forEach(row=>{const id=Number(row.dataset.userCardId);const card=cards.find(c=>c.id===id);const l=card?getCardLeague(card):"UNKNOWN";row.dataset.league=l;row.style.display=league==="ALL"||l===league?"":"none"});
  };
  apply();const obs=new MutationObserver(apply);obs.observe(document.body,{childList:true,subtree:true});
  const refresh=()=>{setVersion(v=>v+1);window.setTimeout(apply,0)};window.addEventListener("cardsignal:user-cards-changed",refresh);window.addEventListener("storage",refresh);
  return()=>{obs.disconnect();window.removeEventListener("cardsignal:user-cards-changed",refresh);window.removeEventListener("storage",refresh)};
 },[league]);
 useEffect(()=>{void version;window.setTimeout(()=>{const modal=document.querySelector<HTMLElement>(".cs-portfolio-modal");if(!modal)return;const cards=readCards();modal.querySelectorAll<HTMLElement>(".cs-portfolio-card[data-user-card-id]").forEach(row=>{const card=cards.find(c=>c.id===Number(row.dataset.userCardId));const l=card?getCardLeague(card):"UNKNOWN";row.style.display=league==="ALL"||l===league?"":"none"})},0)},[version,league]);
 if(!host)return null;
 return createPortal(<label className="cs-league-filter"><span>LEAGUE</span><select value={league} onChange={e=>setLeague(e.target.value as "ALL"|CardLeague)}><option value="ALL">All leagues</option>{CARD_LEAGUES.map(l=><option key={l} value={l}>{l}</option>)}</select></label><style jsx global>{`.cs-league-filter{display:block;min-width:118px}.cs-league-filter>span{display:block;margin-bottom:3px;color:#5f7d8c;font-size:6px;font-weight:900;letter-spacing:.08em}.cs-league-filter select{width:100%;height:36px;padding:0 9px;border:1px solid rgba(79,190,229,.14);border-radius:7px;background:#061724;color:#cfe6ef;font-size:8px;outline:none}.cs-league-filter select:focus{border-color:rgba(83,218,255,.34)}`}</style>,host)
}
