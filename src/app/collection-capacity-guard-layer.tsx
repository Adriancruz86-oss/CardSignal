"use client";

import {useEffect} from "react";

const CARD_KEY="cardsignal-added-cards";
const MAX_CARDS=500;

type SavedCard={id?:number|string;[key:string]:unknown};

function parseCards(raw:string|null):SavedCard[]{
 try{const v=JSON.parse(raw||"[]");return Array.isArray(v)?v:[]}catch{return[]}
}
function key(card:SavedCard){return String(card.id??"")}

/**
 * Temporary compatibility guard for older feature layers that still write
 * `[newCard,...cards].slice(0,100)`. It only intervenes when a write looks
 * exactly like that legacy add path: 100 incoming rows, an existing collection
 * of at least 100 rows, and a new first-card id. Deletes/edits/full 500-card
 * writers pass through untouched.
 */
export default function CollectionCapacityGuardLayer(){
 useEffect(()=>{
  const native=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k:string,value:string){
   if(this===window.localStorage&&k===CARD_KEY){
    const incoming=parseCards(value),existing=parseCards(native.call?window.localStorage.getItem(CARD_KEY):null);
    const looksLegacyAdd=incoming.length===100&&existing.length>=100&&incoming[0]&&key(incoming[0])&&!existing.some(c=>key(c)===key(incoming[0]));
    if(looksLegacyAdd){
     const seen=new Set<string>();
     const merged=[...incoming,...existing].filter(card=>{const id=key(card);if(!id)return true;if(seen.has(id))return false;seen.add(id);return true}).slice(0,MAX_CARDS);
     return native.call(this,k,JSON.stringify(merged));
    }
   }
   return native.call(this,k,value);
  };
  return()=>{Storage.prototype.setItem=native};
 },[]);
 return null;
}
