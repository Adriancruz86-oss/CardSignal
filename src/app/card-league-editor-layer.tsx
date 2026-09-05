"use client";

import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {CARD_LEAGUES,getCardLeague,type CardLeague} from "./card-league";

type Card={id:number;player:string;meta?:string;league?:string;sport?:string;setName?:string;variant?:string};
const CARD_KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function writeCards(cards:Card[]){localStorage.setItem(CARD_KEY,JSON.stringify(cards));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
export default function CardLeagueEditorLayer(){
 const[host,setHost]=useState<HTMLElement|null>(null),[player,setPlayer]=useState(""),[version,setVersion]=useState(0);
 useEffect(()=>{const attach=()=>{const modal=document.querySelector<HTMLElement>(".cs-detail-modal");if(!modal){setHost(null);setPlayer("");return}setPlayer(modal.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim()||"");let h=modal.querySelector<HTMLElement>("#cs-league-editor-host");if(!h){h=document.createElement("div");h.id="cs-league-editor-host";const perf=modal.querySelector("#cs-performance-host");if(perf)perf.insertAdjacentElement("beforebegin",h);else modal.appendChild(h)}setHost(h)};attach();const obs=new MutationObserver(attach);obs.observe(document.body,{childList:true,subtree:true});const r=()=>setVersion(v=>v+1);window.addEventListener("cardsignal:user-cards-changed",r);return()=>{obs.disconnect();window.removeEventListener("cardsignal:user-cards-changed",r)}},[]);
 const card=useMemo(()=>{void version;return readCards().find(c=>c.player.toLowerCase()===player.toLowerCase())||null},[player,version]);
 const inferred=card?getCardLeague(card):"UNKNOWN";
 const save=(league:CardLeague)=>{if(!card)return;const cards=readCards().map(c=>c.id===card.id?{...c,league}:c);writeCards(cards);setVersion(v=>v+1)};
 if(!host||!card)return null;
 return createPortal(<div className="cs-league-editor"><div><span>LEAGUE</span><b>{card.league?"Explicit league":"Inferred league"}</b></div><select value={(card.league?.toUpperCase() as CardLeague)||inferred} onChange={e=>save(e.target.value as CardLeague)}>{CARD_LEAGUES.filter(x=>x!=="UNKNOWN").map(x=><option key={x}>{x}</option>)}<option>UNKNOWN</option></select><small>{card.league?"Saved directly on this card. Portfolio and performance filters use this value first.":`Currently inferred as ${inferred}. Choose a league to make it explicit.`}</small><style jsx global>{`.cs-league-editor{margin:10px 0;padding:10px 12px;display:grid;grid-template-columns:120px 130px 1fr;gap:10px;align-items:center;border:1px solid rgba(82,216,255,.09);border-radius:9px;background:rgba(6,22,34,.46)}.cs-league-editor span,.cs-league-editor b{display:block}.cs-league-editor span{color:#5fdcff;font-size:7px;font-weight:900;letter-spacing:.1em}.cs-league-editor b{margin-top:2px;color:#708b99;font-size:7px}.cs-league-editor select{height:31px;padding:0 8px;border:1px solid rgba(82,216,255,.13);border-radius:6px;background:#071724;color:#d9edf5;font-size:8px}.cs-league-editor small{color:#6d8795;font-size:7px;line-height:1.4}@media(max-width:650px){.cs-league-editor{grid-template-columns:1fr}.cs-league-editor select{width:100%}}`}</style></div>,host)
}
