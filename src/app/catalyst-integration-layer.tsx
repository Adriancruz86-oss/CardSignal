"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Article={title:string;url:string;domain:string;publishedAt:string;category:string;tone:"positive"|"negative"|"watch"|"neutral";impact:number};
type Result={player:string;fetchedAt:string;articles:Article[];source?:string;error?:string};
type Card={id:number;player:string;meta?:string};

const CACHE_KEY="cardsignal-catalysts",CARD_KEY="cardsignal-added-cards";
function readCache():Record<string,Result>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||"{}")||{}}catch{return{}}}
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(CARD_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function strongArticles(result?:Result){return (result?.articles||[]).filter(a=>Number(a.impact)>=80).sort((a,b)=>b.impact-a.impact)}
function ageLabel(iso?:string){if(!iso)return"";const ms=Math.max(0,Date.now()-new Date(iso).getTime());if(ms<3600000)return`${Math.max(1,Math.round(ms/60000))}m ago`;if(ms<86400000)return`${Math.round(ms/3600000)}h ago`;return`${Math.round(ms/86400000)}d ago`}
function toneClass(t:Article["tone"]){return t==="negative"?"negative":t==="positive"?"positive":t==="watch"?"watch":"neutral"}

export default function CatalystIntegrationLayer(){
 const[cache,setCache]=useState<Record<string,Result>>({}),[detailHost,setDetailHost]=useState<HTMLElement|null>(null),[detailPlayer,setDetailPlayer]=useState(""),[actionHost,setActionHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  let last="";
  const refresh=()=>{const raw=localStorage.getItem(CACHE_KEY)||"{}";if(raw!==last){last=raw;setCache(readCache())}};
  const attach=()=>{
   const modal=document.querySelector<HTMLElement>(".cs-detail-modal");
   if(modal){
    const player=modal.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim()||"";
    setDetailPlayer(player);
    let host=modal.querySelector<HTMLElement>("#cs-detail-catalyst-host");
    if(!host){host=document.createElement("div");host.id="cs-detail-catalyst-host";const sales=modal.querySelector(".cs-md-sales");if(sales)modal.insertBefore(host,sales);else modal.appendChild(host)}
    setDetailHost(host);
   }else{setDetailHost(null);setDetailPlayer("")}
   const drawer=document.querySelector<HTMLElement>(".cs-ac-drawer");
   if(drawer){
    let host=drawer.querySelector<HTMLElement>("#cs-action-catalyst-host");
    if(!host){host=document.createElement("div");host.id="cs-action-catalyst-host";const counts=drawer.querySelector(".cs-ac-counts");counts?.insertAdjacentElement("afterend",host)}
    setActionHost(host);
   }else setActionHost(null);
  };
  refresh();attach();
  const obs=new MutationObserver(attach);obs.observe(document.body,{childList:true,subtree:true});
  const interval=window.setInterval(refresh,1000);
  const storage=()=>refresh();window.addEventListener("storage",storage);
  return()=>{obs.disconnect();window.clearInterval(interval);window.removeEventListener("storage",storage)};
 },[]);

 const detailArticles=useMemo(()=>strongArticles(cache[detailPlayer.toLowerCase()]).slice(0,4),[cache,detailPlayer]);
 const actionItems=useMemo(()=>{
  const cards=readCards();const byPlayer=new Map(cards.map(c=>[c.player.toLowerCase(),c]));const rows:{card:Card;article:Article;fetchedAt:string}[]=[];
  for(const [key,result] of Object.entries(cache)){
   const card=byPlayer.get(key);if(!card)continue;
   for(const article of strongArticles(result).slice(0,1))rows.push({card,article,fetchedAt:result.fetchedAt});
  }
  return rows.sort((a,b)=>b.article.impact-a.article.impact).slice(0,5);
 },[cache]);

 const openCard=(id:number)=>{
  const rows=[...document.querySelectorAll<HTMLElement>(`.signal-row[data-user-card-id="${id}"],.cs-pulse-row[data-user-card-id="${id}"]`)];
  const row=rows.find(r=>!r.closest(".cs-ac-drawer"))||rows[0];
  document.querySelector<HTMLButtonElement>(".cs-ac-close")?.click();
  window.setTimeout(()=>row?.click(),40);
 };

 return <>
  {detailHost&&createPortal(<article className="cs-detail-catalysts"><div className="cs-cat-int-head"><div><span>CATALYST WATCH</span><b>Strong recent player news</b></div><small>{detailArticles.length?`${detailArticles.length} high-impact headline${detailArticles.length===1?"":"s"}`:"No high-impact catalyst cached"}</small></div>{detailArticles.length?<div className="cs-cat-int-list">{detailArticles.map((a,i)=><div key={`${a.url}-${i}`} className={`cs-cat-int-row ${toneClass(a.tone)}`}><div className="cs-cat-int-score"><b>{a.impact}</b><span>{a.category}</span></div><div><strong>{a.title}</strong><span>{a.domain} · {a.publishedAt?ageLabel(a.publishedAt):"recent"}</span><a href={a.url} target="_blank" rel="noreferrer">Open source ↗</a></div></div>)}</div>:<div className="cs-cat-int-empty">Run Catalyst Tracking to check recent player news. Weak/noisy headlines stay out of the card terminal.</div>}</article>,detailHost)}
  {actionHost&&actionItems.length>0&&createPortal(<section className="cs-ac-catalysts"><div className="cs-ac-cat-title"><span>STRONG CATALYSTS</span><b>News worth reviewing</b></div>{actionItems.map(({card,article,fetchedAt})=><button key={`${card.id}-${article.url}`} onClick={()=>openCard(card.id)} className={toneClass(article.tone)}><div><strong>{card.player}</strong><span>{article.category} · impact {article.impact} · {ageLabel(fetchedAt)}</span></div><p>{article.title}</p></button>)}</section>,actionHost)}
  <style jsx global>{`
   .cs-detail-catalysts{margin:14px 0;padding:14px;border:1px solid rgba(91,204,244,.13);border-radius:11px;background:rgba(5,20,32,.58)}.cs-cat-int-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:8px}.cs-cat-int-head span,.cs-cat-int-head b{display:block}.cs-cat-int-head span{color:#5edfff;font-size:8px;font-weight:900;letter-spacing:.14em}.cs-cat-int-head b{margin-top:3px;font-size:12px}.cs-cat-int-head small{color:#6e8f9f;font-size:8px}.cs-cat-int-list{display:flex;flex-direction:column}.cs-cat-int-row{display:grid;grid-template-columns:76px 1fr;gap:11px;padding:10px 0;border-top:1px solid rgba(76,183,223,.08)}.cs-cat-int-row:first-child{border-top:0}.cs-cat-int-score b,.cs-cat-int-score span{display:block}.cs-cat-int-score b{font-size:20px;color:#7bdff6}.cs-cat-int-row.positive .cs-cat-int-score b{color:#61efa5}.cs-cat-int-row.negative .cs-cat-int-score b{color:#ff8090}.cs-cat-int-row.watch .cs-cat-int-score b{color:#efc86e}.cs-cat-int-score span{margin-top:2px;color:#6a8998;font-size:7px;font-weight:900}.cs-cat-int-row>div:last-child strong,.cs-cat-int-row>div:last-child span,.cs-cat-int-row a{display:block}.cs-cat-int-row>div:last-child strong{font-size:10px;line-height:1.4}.cs-cat-int-row>div:last-child span{margin-top:3px;color:#6d8c9b;font-size:8px}.cs-cat-int-row a{margin-top:5px;color:#6ddfff;font-size:8px;text-decoration:none}.cs-cat-int-empty{padding:15px;border:1px dashed rgba(80,188,225,.12);border-radius:8px;color:#718f9e;font-size:9px;line-height:1.45}
   .cs-ac-catalysts{margin:0 0 12px;padding:10px;border:1px solid rgba(238,200,110,.15);border-radius:10px;background:rgba(41,32,12,.12)}.cs-ac-cat-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:7px}.cs-ac-cat-title span{color:#efc86e;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-ac-cat-title b{color:#93adba;font-size:8px;font-weight:700}.cs-ac-catalysts>button{width:100%;display:grid;grid-template-columns:150px 1fr;gap:10px;text-align:left;padding:9px;border:0;border-top:1px solid rgba(95,185,219,.08);background:transparent;color:#dcecf2;cursor:pointer}.cs-ac-catalysts>button:first-of-type{border-top:0}.cs-ac-catalysts>button:hover{background:rgba(14,39,53,.55)}.cs-ac-catalysts strong,.cs-ac-catalysts span,.cs-ac-catalysts p{display:block}.cs-ac-catalysts strong{font-size:10px}.cs-ac-catalysts span{margin-top:3px;color:#708f9f;font-size:7px}.cs-ac-catalysts p{margin:0;color:#9fb6c1;font-size:9px;line-height:1.35}.cs-ac-catalysts>button.negative strong{color:#ff8997}.cs-ac-catalysts>button.positive strong{color:#6befaa}.cs-ac-catalysts>button.watch strong{color:#efc86e}@media(max-width:680px){.cs-ac-catalysts>button{grid-template-columns:1fr}.cs-cat-int-row{grid-template-columns:60px 1fr}}
  `}</style>
 </>;
}
