"use client";

import {useEffect} from "react";

type Identity={playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};
type Card={id:number;player:string;year?:string;setName?:string;cardNumber?:string;variant?:string;image?:string;frontImage?:string;catalogImage?:string;catalogImageSource?:string;canonicalIdentity?:Identity};
const KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function queryFor(card:Card){const c=card.canonicalIdentity||{};return [c.playerName||card.player,c.year||card.year,c.setName||card.setName,(c.cardNumber||card.cardNumber)?`#${c.cardNumber||card.cardNumber}`:"",c.variation||card.variant].filter(Boolean).join(" ")}
function norm(v:string){return v.toLowerCase().replace(/[^a-z0-9#/.+-]+/g," ").replace(/\s+/g," ").trim()}
const cache=new Map<string,Promise<{imageUrl:string;source:string}>>();
async function lookup(q:string){const key=q.trim().toLowerCase();if(!key)return{imageUrl:"",source:"none"};if(!cache.has(key))cache.set(key,fetch(`/api/sports-card-image?q=${encodeURIComponent(q)}`,{cache:"no-store"}).then(async r=>{const j=await r.json().catch(()=>({}));return{imageUrl:r.ok&&j.ok?String(j.imageUrl||""):"",source:String(j.source||"none")}}).catch(()=>({imageUrl:"",source:"none"})));return cache.get(key)!}

export default function SportsCatalogImageLayer(){
 useEffect(()=>{
  let stopped=false,running=false;
  const enrich=async()=>{if(running||stopped)return;running=true;try{const cards=readCards();let changed=false;const next=[...cards];for(let i=0;i<next.length;i++){const card=next[i];if(card.catalogImage)continue;const q=queryFor(card);if(q.length<3)continue;const hit=await lookup(q);if(stopped)return;if(hit.imageUrl){next[i]={...card,catalogImage:hit.imageUrl,catalogImageSource:hit.source,image:hit.imageUrl,frontImage:card.frontImage||card.image||undefined};changed=true}}
   if(changed){localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event("cardsignal:catalog-images-changed"));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
  }finally{running=false}};

  const decorate=()=>{
   document.querySelectorAll<HTMLElement>(".cs-add-suggestions").forEach(list=>{
    const buttons=[...list.querySelectorAll<HTMLButtonElement>("button")];
    const seen=new Set<string>();
    buttons.forEach(btn=>{
      const title=btn.querySelector("b")?.textContent?.trim()||"";
      const meta=btn.querySelector("span")?.textContent?.trim()||"";
      const small=btn.querySelector("small")?.textContent?.trim()||"";
      const identityKey=norm(`${title}|${meta}`);
      if(identityKey&&seen.has(identityKey)){btn.style.display="none";btn.dataset.catalogDuplicate="1";return}
      if(identityKey)seen.add(identityKey);
      if(btn.dataset.catalogImageChecked)return;
      btn.dataset.catalogImageChecked="1";
      btn.classList.add("cs-sports-candidate");
      const parts=meta.split("·").map(x=>x.trim()).filter(Boolean);
      const variation=parts.length>=4?parts.at(-1)||"":"";
      if(variation&&!btn.querySelector(".cs-sports-variant-pill")){
        const pill=document.createElement("em");pill.className="cs-sports-variant-pill";pill.textContent=variation;btn.appendChild(pill);
      }
      const q=[title,meta].filter(Boolean).join(" ");if(q.length<3)return;
      void lookup(q).then(hit=>{if(stopped||!hit.imageUrl||!btn.isConnected)return;const img=document.createElement("img");img.src=hit.imageUrl;img.alt=`${title} catalog card`;img.className="cs-sports-catalog-thumb";btn.prepend(img);btn.dataset.catalogImageSource=hit.source})
    });
    const visible=buttons.filter(b=>b.style.display!=="none").length;
    const header=list.querySelector<HTMLElement>(":scope > div");
    if(header&&visible>0)header.textContent=`SELECT THE EXACT CARD · ${visible} UNIQUE MATCH${visible===1?"":"ES"}`;
   });
  };

  void enrich();decorate();
  const refresh=()=>{void enrich();setTimeout(decorate,50)};
  window.addEventListener("cardsignal:user-cards-changed",refresh);
  const obs=new MutationObserver(decorate);obs.observe(document.body,{childList:true,subtree:true});
  return()=>{stopped=true;obs.disconnect();window.removeEventListener("cardsignal:user-cards-changed",refresh)};
 },[]);
 return <style jsx global>{`
 .cs-add-suggestions{max-height:460px!important;overflow:auto!important}
 .cs-add-suggestions .cs-sports-candidate{position:relative!important;min-height:94px!important;padding:10px 12px!important;border-bottom:1px solid rgba(112,202,235,.10)!important}
 .cs-add-suggestions .cs-sports-candidate:has(.cs-sports-catalog-thumb){display:grid!important;grid-template-columns:58px minmax(0,1fr)!important;grid-template-rows:auto auto auto auto!important;column-gap:12px!important;align-items:center!important;text-align:left!important}
 .cs-sports-catalog-thumb{grid-row:1/5;width:54px;height:76px;object-fit:contain;border:1px solid rgba(112,202,235,.16);border-radius:5px;background:#03101a}
 .cs-add-suggestions .cs-sports-candidate:has(.cs-sports-catalog-thumb)>b,.cs-add-suggestions .cs-sports-candidate:has(.cs-sports-catalog-thumb)>span,.cs-add-suggestions .cs-sports-candidate:has(.cs-sports-catalog-thumb)>small,.cs-add-suggestions .cs-sports-candidate:has(.cs-sports-catalog-thumb)>.cs-sports-variant-pill{grid-column:2}
 .cs-add-suggestions .cs-sports-candidate>b{font-size:13px!important;line-height:1.2!important}
 .cs-add-suggestions .cs-sports-candidate>span{margin-top:3px!important;color:#8aa8b8!important}
 .cs-add-suggestions .cs-sports-candidate>small{margin-top:3px!important;color:#5f7e8f!important}
 .cs-sports-variant-pill{justify-self:start;margin-top:5px;padding:3px 6px;border:1px solid rgba(102,239,168,.18);border-radius:4px;background:rgba(61,170,115,.06);color:#7de4ac;font-size:7px;font-style:normal;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
 `}</style>
}
