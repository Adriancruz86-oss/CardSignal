"use client";

import {useEffect} from "react";

type Identity={playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};
type Card={id:number;player:string;year?:string;setName?:string;cardNumber?:string;variant?:string;image?:string;frontImage?:string;catalogImage?:string;catalogImageSource?:string;canonicalIdentity?:Identity};
const KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function queryFor(card:Card){const c=card.canonicalIdentity||{};return [c.playerName||card.player,c.year||card.year,c.setName||card.setName,(c.cardNumber||card.cardNumber)?`#${c.cardNumber||card.cardNumber}`:"",c.variation||card.variant].filter(Boolean).join(" ")}
const cache=new Map<string,Promise<{imageUrl:string;source:string}>>();
async function lookup(q:string){const key=q.trim().toLowerCase();if(!key)return{imageUrl:"",source:"none"};if(!cache.has(key))cache.set(key,fetch(`/api/sports-card-image?q=${encodeURIComponent(q)}`,{cache:"no-store"}).then(async r=>{const j=await r.json().catch(()=>({}));return{imageUrl:r.ok&&j.ok?String(j.imageUrl||""):"",source:String(j.source||"none")}}).catch(()=>({imageUrl:"",source:"none"})));return cache.get(key)!}

export default function SportsCatalogImageLayer(){
 useEffect(()=>{
  let stopped=false,running=false;
  const enrich=async()=>{if(running||stopped)return;running=true;try{const cards=readCards();let changed=false;const next=[...cards];for(let i=0;i<next.length;i++){const card=next[i];if(card.catalogImage)continue;const q=queryFor(card);if(q.length<3)continue;const hit=await lookup(q);if(stopped)return;if(hit.imageUrl){next[i]={...card,catalogImage:hit.imageUrl,catalogImageSource:hit.source,image:hit.imageUrl,frontImage:card.frontImage||card.image||undefined};changed=true}}
   if(changed){localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event("cardsignal:catalog-images-changed"));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
  }finally{running=false}};
  const decorate=()=>{document.querySelectorAll<HTMLElement>(".cs-add-suggestions button").forEach(btn=>{if(btn.dataset.catalogImageChecked)return;btn.dataset.catalogImageChecked="1";const title=btn.querySelector("b")?.textContent?.trim()||"",meta=btn.querySelector("span")?.textContent?.trim()||"";const q=[title,meta].filter(Boolean).join(" ");if(q.length<3)return;void lookup(q).then(hit=>{if(stopped||!hit.imageUrl||!btn.isConnected)return;const img=document.createElement("img");img.src=hit.imageUrl;img.alt="";img.className="cs-sports-catalog-thumb";btn.prepend(img)})})};
  void enrich();decorate();
  const refresh=()=>{void enrich();setTimeout(decorate,50)};
  window.addEventListener("cardsignal:user-cards-changed",refresh);
  const obs=new MutationObserver(decorate);obs.observe(document.body,{childList:true,subtree:true});
  return()=>{stopped=true;obs.disconnect();window.removeEventListener("cardsignal:user-cards-changed",refresh)};
 },[]);
 return <style jsx global>{`.cs-add-suggestions button:has(.cs-sports-catalog-thumb){display:grid!important;grid-template-columns:42px 1fr!important;grid-template-rows:auto auto auto!important;column-gap:9px!important;align-items:center!important;text-align:left!important}.cs-sports-catalog-thumb{grid-row:1/4;width:36px;height:50px;object-fit:contain;border:1px solid rgba(112,202,235,.14);border-radius:4px;background:#03101a}.cs-add-suggestions button:has(.cs-sports-catalog-thumb)>b,.cs-add-suggestions button:has(.cs-sports-catalog-thumb)>span,.cs-add-suggestions button:has(.cs-sports-catalog-thumb)>small{grid-column:2}`}</style>
}
