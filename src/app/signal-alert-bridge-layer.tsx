"use client";

import {useEffect} from "react";
import {SIGNAL_OBSERVATION_KEY,type SignalObservation} from "./signal-scorecard-model";

type Alert={id:string;cardId:number;player:string;meta:string;createdAt:string;kind:"buy"|"sell"|"watch"|"info"|"resolved";title:string;detail:string;read?:boolean};
const ALERTS_KEY="cardsignal-alerts";
function read<T>(k:string,f:T):T{try{const v=JSON.parse(localStorage.getItem(k)||"");return(v??f)as T}catch{return f}}

export default function SignalAlertBridgeLayer(){
 useEffect(()=>{const sync=()=>{const observations=read<SignalObservation[]>(SIGNAL_OBSERVATION_KEY,[]),alerts=read<Alert[]>(ALERTS_KEY,[]);const ids=new Set(alerts.map(a=>a.id));const fresh:Alert[]=[];for(const o of observations){const id=`edge-${o.id}`;if(ids.has(id))continue;const kind=o.signalType==="RISK STACK"?"sell":o.signalType==="EARLY EDGE"?"watch":"info";const title=o.signalType==="EARLY EDGE"?"Early Edge detected":o.signalType==="CONFIRMING"?"Edge now confirming":"Risk Stack detected";fresh.push({id,cardId:o.cardId,player:o.player,meta:o.cardMeta,createdAt:o.signalAt,kind,title,detail:`Edge ${o.edgeScore} · leading ${o.leadScore} · confirming ${o.confirmScore} · risk ${o.riskScore}. ${o.catalystCategory!=="none"?`${o.catalystCategory.toUpperCase()} catalyst in the evidence stack.`:"No strong current catalyst recorded."}`,read:false})}if(!fresh.length)return;localStorage.setItem(ALERTS_KEY,JSON.stringify([...fresh,...alerts].slice(0,800)));window.dispatchEvent(new Event("cardsignal:history-changed"));};sync();window.addEventListener("cardsignal:signal-observations-changed",sync);window.addEventListener("cardsignal:cloud-restored",sync);return()=>{window.removeEventListener("cardsignal:signal-observations-changed",sync);window.removeEventListener("cardsignal:cloud-restored",sync)}},[]);
 return null;
}
