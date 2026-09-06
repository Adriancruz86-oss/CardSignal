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
 * Compatibility guard for older add-card paths that still truncate a new
 * collection write to 100 rows. It only intervenes when the incoming write
 * looks like a legacy add: exactly 100 rows and a new first-card id. Normal
 * edits, deletes, resets and full 500-card writers pass through untouched.
 */
export default function CollectionCapacityGuardLayer(){
 useEffect(()=>{
  const nativeSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k:string,value:string){
   if(this===window.localStorage&&k===CARD_KEY){
    const incoming=parseCards(value);
    const existing=parseCards(window.localStorage.getItem(CARD_KEY));
    const newFirstId=incoming[0]?key(incoming[0]):"";
    const looksLegacyAdd=incoming.length===100&&existing.length>=100&&!!newFirstId&&!existing.some(c=>key(c)===newFirstId);
    if(looksLegacyAdd){
     const seen=new Set<string>();
     const merged=[...incoming,...existing].filter(card=>{
      const id=key(card);
      if(!id)return true;
      if(seen.has(id))return false;
      seen.add(id);
      return true;
     }).slice(0,MAX_CARDS);
     return nativeSetItem.call(this,k,JSON.stringify(merged));
    }
   }
   return nativeSetItem.call(this,k,value);
  };
  return()=>{Storage.prototype.setItem=nativeSetItem};
 },[]);
 return null;
}
