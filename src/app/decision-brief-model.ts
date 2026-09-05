import {getCardLeague,type LeagueCard} from "./card-league";
import {getCardMarketContext,type MarketContextCard} from "./card-market-context";
import type {CatalystOutcomeRow} from "./catalyst-outcome-model";
import type {CurrentCatalyst,AnalogCard} from "./historical-analogs-model";
import type {SignalObservation,SignalOutcome,SignalType} from "./signal-scorecard-model";

export type BriefCard=AnalogCard&{canonicalIdentity?:unknown;marketScan?:{scannedAt?:string;acceptedCount?:number;currentMedian?:number|null;change7d?:number|null;velocity?:number|null;confidence?:string};marketValue?:number};
export type EvidenceLevel="HIGH"|"MEDIUM"|"LOW"|"MISSING";
export type EvidenceConfidence={identity:EvidenceLevel;market:EvidenceLevel;catalyst:EvidenceLevel;history:EvidenceLevel;overall:EvidenceLevel;reasons:string[]};
export type PlaybookContext={category:string;league:string;role:string;sensitivity:string;count:number;median:number|null;positiveRate:number|null;largeMoveRate:number|null;sample:"NO SAMPLE"|"THIN"|"BUILDING"|"USEFUL"|"STRONGER"};

function ageHours(v?:string){const t=new Date(v||"").getTime();return Number.isFinite(t)?Math.max(0,Date.now()-t)/3600000:Infinity}
function median(vals:number[]){if(!vals.length)return null;const s=[...vals].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function norm(v:unknown){return String(v||"").trim().toLowerCase()}
function sample(n:number):PlaybookContext["sample"]{return n>=50?"STRONGER":n>=20?"USEFUL":n>=8?"BUILDING":n?"THIN":"NO SAMPLE"}

export function playbookFor(card:BriefCard,catalyst:CurrentCatalyst|null,outcomes:CatalystOutcomeRow[],cards:BriefCard[],horizon:"24H"|"3D"|"7D"|"30D"="7D"):PlaybookContext|null{
 if(!catalyst)return null;const league=getCardLeague(card as LeagueCard),ctx=getCardMarketContext(card as MarketContextCard),byId=new Map(cards.map(c=>[c.id,c])),vals:number[]=[];
 for(const row of outcomes){const hist=byId.get(row.cardId);if(!hist)continue;const hctx=getCardMarketContext(hist as MarketContextCard),hl=getCardLeague(hist as LeagueCard);if(norm(row.event.category)!==norm(catalyst.category)||hl!==league||hctx.role!==ctx.role||hctx.sensitivity!==ctx.sensitivity)continue;const p=row.points.find(x=>x.label===horizon);if(p?.status==="AVAILABLE"&&p.changePct!=null&&Number.isFinite(p.changePct))vals.push(p.changePct)}
 return{category:String(catalyst.category||"uncategorized"),league,role:ctx.role,sensitivity:ctx.sensitivity,count:vals.length,median:median(vals),positiveRate:vals.length?vals.filter(v=>v>0).length/vals.length*100:null,largeMoveRate:vals.length?vals.filter(v=>Math.abs(v)>=8).length/vals.length*100:null,sample:sample(vals.length)};
}

export function evidenceConfidence(card:BriefCard,catalyst:CurrentCatalyst|null,analogCount:number,signalOutcomes:SignalOutcome[]):EvidenceConfidence{
 const reasons:string[]=[];const exactFields=[card.year,card.setName,card.cardNumber].filter(v=>String(v||"").trim()).length;
 const identity:EvidenceLevel=card.canonicalIdentity?"HIGH":exactFields>=3?"MEDIUM":exactFields>=2?"LOW":"MISSING";reasons.push(identity==="HIGH"?"canonical card identity saved":identity==="MEDIUM"?"year, set and card number present":identity==="LOW"?"identity is only partially specified":"exact identity fields are incomplete");
 const accepted=Number(card.marketScan?.acceptedCount||0),scanAge=ageHours(card.marketScan?.scannedAt);const market:EvidenceLevel=accepted>=8&&scanAge<=24?"HIGH":accepted>=3&&scanAge<=72?"MEDIUM":accepted>=3?"LOW":"MISSING";reasons.push(market==="HIGH"?`${accepted} accepted comps from a fresh scan`:market==="MEDIUM"?`${accepted} accepted comps support the current read`:market==="LOW"?"market evidence exists but is stale":"fewer than three accepted exact comps");
 const catAge=ageHours(catalyst?.publishedAt),impact=Number(catalyst?.impact||0);const catalystLevel:EvidenceLevel=!catalyst?"MISSING":impact>=85&&catAge<=72?"HIGH":impact>=75&&catAge<=168?"MEDIUM":"LOW";reasons.push(catalystLevel==="HIGH"?"fresh high-impact catalyst":catalystLevel==="MEDIUM"?"material recent catalyst":catalystLevel==="LOW"?"catalyst is weaker or older":"no material current catalyst");
 const resolved=signalOutcomes.filter(x=>x.status==="RESOLVED").length;const historicalN=Math.max(analogCount,resolved);const history:EvidenceLevel=historicalN>=20?"HIGH":historicalN>=8?"MEDIUM":historicalN>0?"LOW":"MISSING";reasons.push(history==="HIGH"?"useful historical comparison sample":history==="MEDIUM"?"historical sample is building":history==="LOW"?"historical evidence is thin":"no resolved comparison sample yet");
 const score=[identity,market,catalystLevel,history].reduce((n,x)=>n+(x==="HIGH"?3:x==="MEDIUM"?2:x==="LOW"?1:0),0);const overall:EvidenceLevel=score>=10?"HIGH":score>=6?"MEDIUM":score>=3?"LOW":"MISSING";return{identity,market,catalyst:catalystLevel,history,overall,reasons};
}

export function signalTrackRecord(type:SignalType|null,outcomes:SignalOutcome[]){if(!type)return{count:0,hitRate:null,meaningfulRate:null,median:null};const rows=outcomes.filter(o=>o.observation.signalType===type&&o.status==="RESOLVED"&&o.directionalMove!=null),vals=rows.map(o=>o.directionalMove as number);return{count:rows.length,hitRate:rows.length?rows.filter(o=>o.hit).length/rows.length*100:null,meaningfulRate:rows.length?rows.filter(o=>o.meaningfulHit).length/rows.length*100:null,median:median(vals)};}

export function latestSignalObservation(cardId:number,observations:SignalObservation[]){return observations.filter(o=>o.cardId===cardId).sort((a,b)=>new Date(b.signalAt).getTime()-new Date(a.signalAt).getTime())[0]||null}
