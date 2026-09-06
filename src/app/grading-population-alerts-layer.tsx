"use client";

import {useEffect} from "react";
import {populationTrend,readPopulationHistory,type GradingProvider} from "./grading-population-model";

type Card={id:number;player:string;meta?:string};
type Alert={id:string;cardId:number;player:string;meta:string;createdAt:string;kind:string;title:string;detail:string;read?:boolean};
const CARD_KEY="cardsignal-added-cards",ALERT_KEY="cardsignal-alerts";
function read<T>(key:string,fallback:T):T{try{const v=JSON.parse(localStorage.getItem(key)||"");return(v??fallback) as T}catch{return fallback}}
function run(){
 const cards=read<Card[]>(CARD_KEY,[]),history=readPopulationHistory();if(!cards.length||!history.length)return;
 const cardMap=new Map(cards.map(c=>[c.id,c]));const existing=read<Alert[]>(ALERT_KEY,[]);const existingIds=new Set(existing.map(a=>a.id));const additions:Alert[]=[];const combos=new Set(history.map(x=>`${x.cardId}|${x.provider}|${x.grade}`));
 for(const combo of combos){const[cardIdText,provider,grade]=combo.split("|"),cardId=Number(cardIdText),card=cardMap.get(cardId);if(!card)continue;const trend=populationTrend(history,cardId,provider as GradingProvider,grade);if(trend.status!=="RAPID GROWTH"||!trend.current||trend.changePct==null)continue;const id=`population-${cardId}-${provider}-${grade}-${trend.current.capturedAt}`;if(existingIds.has(id))continue;additions.push({id,cardId,player:card.player,meta:card.meta||"",createdAt:trend.current.capturedAt,kind:"population",title:`${provider} ${grade} population accelerating`,detail:`Exact-card population is up ${trend.changePct.toFixed(1)}% versus the prior same-provider, same-grade snapshot. Review demand and sales velocity before treating supply growth as price pressure.`,read:false})}
 if(!additions.length)return;localStorage.setItem(ALERT_KEY,JSON.stringify([...additions,...existing].slice(0,2000)));window.dispatchEvent(new Event("cardsignal:alerts-changed"));
}
export default function GradingPopulationAlertsLayer(){useEffect(()=>{run();const h=()=>run();window.addEventListener("cardsignal:grading-population-changed",h);window.addEventListener("cardsignal:user-cards-changed",h);window.addEventListener("storage",h);return()=>{window.removeEventListener("cardsignal:grading-population-changed",h);window.removeEventListener("cardsignal:user-cards-changed",h);window.removeEventListener("storage",h)}},[]);return null}
