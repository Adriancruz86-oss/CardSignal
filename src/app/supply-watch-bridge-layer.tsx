"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SupplyWatchPanel from "./supply-watch-panel";

type Identity={playerName?:string;year?:string;setName?:string;cardNumber?:string;variation?:string};
type Card={id:number;player:string;meta?:string;year?:string;setName?:string;cardNumber?:string;variant?:string;canonicalIdentity?:Identity;marketScan?:{currentMedian?:number|null}};
const KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function norm(v?:string){return String(v||"").trim().replace(/\s+/g," ").toLowerCase()}
function findOpenCard(){const modal=document.querySelector<HTMLElement>(".cs-detail-modal");if(!modal)return null;const player=modal.querySelector<HTMLElement>(".cs-detail-head h2")?.textContent?.trim()||"",meta=modal.querySelector<HTMLElement>(".cs-detail-head p")?.textContent?.trim()||"";if(!player)return null;const list=readCards(),exact=list.filter(c=>norm(c.player)===norm(player)&&(!meta||norm(c.meta)===norm(meta)));if(exact.length===1)return exact[0];const same=list.filter(c=>norm(c.player)===norm(player));return same.length===1?same[0]:null}

export default function SupplyWatchBridgeLayer(){
 const[host,setHost]=useState<HTMLElement|null>(null),[card,setCard]=useState<Card|null>(null);
 useEffect(()=>{const sync=()=>{const modal=document.querySelector<HTMLElement>(".cs-detail-modal");if(!modal){setHost(null);setCard(null);return}const resolved=findOpenCard();if(!resolved){setHost(null);setCard(null);return}let node=modal.querySelector<HTMLElement>(".cs-supply-watch-host");if(!node){node=document.createElement("div");node.className="cs-supply-watch-host";const sales=modal.querySelector(".cs-md-sales");if(sales)modal.insertBefore(node,sales);else modal.appendChild(node)}setHost(node);setCard(resolved)};const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});sync();window.addEventListener("cardsignal:user-cards-changed",sync);return()=>{observer.disconnect();window.removeEventListener("cardsignal:user-cards-changed",sync)}},[]);
 if(!host||!card)return null;const id=card.canonicalIdentity||{};return createPortal(<SupplyWatchPanel cardId={card.id} player={id.playerName||card.player} year={id.year||card.year} setName={id.setName||card.setName} cardNumber={id.cardNumber||card.cardNumber} variant={id.variation||card.variant} soldMedian={card.marketScan?.currentMedian??null}/>,host);
}
