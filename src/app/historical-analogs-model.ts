import {getCardLeague,type LeagueCard} from "./card-league";
import {getCardMarketContext,type MarketContextCard} from "./card-market-context";
import type {CatalystEvent} from "./catalyst-history-model";
import type {CatalystOutcomeRow,ScanSnapshot} from "./catalyst-outcome-model";

export type AnalogCard={id:number;player:string;year?:string;setName?:string;cardNumber?:string;variant?:string;grader?:string;grade?:string;meta?:string;league?:string;sport?:string;marketScan?:{velocity?:number|null;change7d?:number|null;acceptedCount?:number}};
export type CurrentCatalyst={title:string;publishedAt?:string;category?:string;tone:"positive"|"negative"|"watch"|"neutral";impact:number};
export type AnalogHorizon="24H"|"3D"|"7D"|"30D";
export type AnalogMatch={row:CatalystOutcomeRow;similarity:number;reasons:string[];baselineVelocity:number|null;league:string;era:string;role:string;sensitivity:string;graded:boolean};
export type AnalogSummary={count:number;median:number|null;average:number|null;positiveRate:number|null;largeMoveRate:number|null;bestCase:number|null;worstCase:number|null;sample:"NO SAMPLE"|"THIN"|"BUILDING"|"USEFUL"};

function norm(v:unknown){return String(v||"").trim().toLowerCase()}
function ms(v:string){const n=new Date(v).getTime();return Number.isFinite(n)?n:0}
function median(vals:number[]){if(!vals.length)return null;const s=[...vals].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function velocityBand(v:number|null|undefined){if(v==null||!Number.isFinite(v))return"UNKNOWN";if(v>=65)return"HIGH";if(v>=30)return"MEDIUM";return"LOW"}
function nearestBaselineScan(row:CatalystOutcomeRow,scans:ScanSnapshot[]){const target=ms(row.baselineAt);return scans.filter(s=>s.cardId===row.cardId&&s.velocity!=null).sort((a,b)=>Math.abs(ms(a.scannedAt)-target)-Math.abs(ms(b.scannedAt)-target))[0]||null}

export function buildAnalogMatches(current:AnalogCard,catalyst:CurrentCatalyst,outcomes:CatalystOutcomeRow[],cards:AnalogCard[],scans:ScanSnapshot[],horizon:AnalogHorizon="7D"){
 const currentCtx=getCardMarketContext(current as MarketContextCard),currentLeague=getCardLeague(current as LeagueCard),currentVelocity=velocityBand(current.marketScan?.velocity);
 const byId=new Map(cards.map(c=>[c.id,c]));
 const matches:AnalogMatch[]=[];
 for(const row of outcomes){
  const hist=byId.get(row.cardId);if(!hist)continue;
  if(row.cardId===current.id&&norm(row.event.title)===norm(catalyst.title))continue;
  const point=row.points.find(x=>x.label===horizon);if(point?.status!=="AVAILABLE"||point.changePct==null||!Number.isFinite(point.changePct))continue;
  const histCtx=getCardMarketContext(hist as MarketContextCard),histLeague=getCardLeague(hist as LeagueCard),baseScan=nearestBaselineScan(row,scans),histVelocity=velocityBand(baseScan?.velocity);
  let score=0;const reasons:string[]=[];
  if(norm(row.event.category)===norm(catalyst.category)){score+=35;reasons.push("same catalyst category")}
  else if(norm(row.event.tone)===norm(catalyst.tone)){score+=8;reasons.push("same catalyst tone")}
  if(histLeague===currentLeague&&currentLeague!=="UNKNOWN"){score+=20;reasons.push(`same league (${currentLeague})`)}
  if(histCtx.role===currentCtx.role&&currentCtx.role!=="UNKNOWN"){score+=14;reasons.push("same card role")}
  if(histCtx.sensitivity===currentCtx.sensitivity){score+=10;reasons.push(`same sensitivity (${currentCtx.sensitivity})`)}
  if(histCtx.era===currentCtx.era&&currentCtx.era!=="UNKNOWN"){score+=8;reasons.push("same era")}
  if(histCtx.graded===currentCtx.graded){score+=5;reasons.push(currentCtx.graded?"both graded":"both raw/unspecified")}
  if(histVelocity===currentVelocity&&currentVelocity!=="UNKNOWN"){score+=8;reasons.push(`similar liquidity (${currentVelocity})`)}
  if(score<35)continue;
  matches.push({row,similarity:Math.min(100,score),reasons,baselineVelocity:baseScan?.velocity??null,league:histLeague,era:histCtx.era,role:histCtx.role,sensitivity:histCtx.sensitivity,graded:histCtx.graded});
 }
 return matches.sort((a,b)=>b.similarity-a.similarity||ms(b.row.event.firstSeenAt)-ms(a.row.event.firstSeenAt)).slice(0,40);
}

export function summarizeAnalogs(matches:AnalogMatch[],label:AnalogHorizon="7D"):AnalogSummary{
 const vals=matches.map(m=>m.row.points.find(p=>p.label===label)?.changePct).filter((v):v is number=>v!=null&&Number.isFinite(v));
 if(!vals.length)return{count:0,median:null,average:null,positiveRate:null,largeMoveRate:null,bestCase:null,worstCase:null,sample:"NO SAMPLE"};
 const count=vals.length,avg=vals.reduce((a,b)=>a+b,0)/count;
 return{count,median:median(vals),average:avg,positiveRate:vals.filter(v=>v>0).length/count*100,largeMoveRate:vals.filter(v=>Math.abs(v)>=8).length/count*100,bestCase:Math.max(...vals),worstCase:Math.min(...vals),sample:count>=20?"USEFUL":count>=8?"BUILDING":"THIN"};
}

export function currentCatalystFor(player:string,cache:Record<string,{articles?:CurrentCatalyst[]}>){
 return (cache[norm(player)]?.articles||[]).filter(a=>a.impact>=70).sort((a,b)=>b.impact-a.impact)[0]||null;
}

export type HistoricalEvent = CatalystEvent;
