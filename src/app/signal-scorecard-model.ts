import {getCardLeague,type LeagueCard} from "./card-league";
import {getCardMarketContext,type MarketContextCard} from "./card-market-context";
import {latestPerformance,performanceSignal,type PerformanceLeague,type PlayerPerformanceSnapshot} from "./player-performance-model";

export type SignalType="EARLY EDGE"|"CONFIRMING"|"RISK STACK";
export type SignalDirection="UP"|"DOWN";
export type ScorecardHorizon="24H"|"3D"|"7D"|"30D";
export type ScorecardCard={id:number;player:string;meta?:string;year?:string;setName?:string;cardNumber?:string;variant?:string;grader?:string;grade?:string;league?:string;sport?:string;benchmark?:boolean;marketScan?:{scannedAt?:string;acceptedCount?:number;currentMedian?:number|null;change7d?:number|null;velocity?:number|null}};
export type ScorecardScan={cardId:number;player:string;meta?:string;scannedAt:string;acceptedCount:number;currentMedian:number|null;change7d:number|null;velocity:number|null};
export type ScorecardSupply={cardId:number;scannedAt:string;acceptedCount:number;medianAsk:number|null};
export type ScorecardCatalyst={title:string;publishedAt?:string;category?:string;tone:"positive"|"negative"|"watch"|"neutral";impact:number};
export type ScorecardCatalystCache=Record<string,{articles?:ScorecardCatalyst[]}>;
export type SignalObservation={
 id:string;cardId:number;player:string;cardMeta:string;benchmark:boolean;signalAt:string;baselineMedian:number;signalType:SignalType;direction:SignalDirection;edgeScore:number;leadScore:number;confirmScore:number;riskScore:number;catalystCategory:string;league:string;role:string;sensitivity:string;graded:boolean;
};
export type SignalOutcome={observation:SignalObservation;horizon:ScorecardHorizon;targetAt:string;scanAt:string|null;median:number|null;changePct:number|null;directionalMove:number|null;status:"PENDING"|"NO MATCH"|"RESOLVED";hit:boolean|null;meaningfulHit:boolean|null};

export const SIGNAL_OBSERVATION_KEY="cardsignal-signal-observations";
export const SCORECARD_HORIZONS:[ScorecardHorizon,number,number][]=[["24H",24,18],["3D",72,30],["7D",168,54],["30D",720,120]];

function norm(v:unknown){return String(v||"").trim().toLowerCase()}
function ms(v?:string){const n=new Date(v||"").getTime();return Number.isFinite(n)?n:0}
function ageHours(v?:string){const t=ms(v);return t?Math.max(0,Date.now()-t)/3600000:Infinity}
function latestTwo<T extends{scannedAt:string}>(rows:T[]){return [...rows].sort((a,b)=>ms(b.scannedAt)-ms(a.scannedAt)).slice(0,2)}
function topCatalyst(cache:ScorecardCatalystCache,player:string){return (cache[norm(player)]?.articles||[]).filter(a=>ageHours(a.publishedAt)<=168).sort((a,b)=>b.impact-a.impact)[0]||null}
function pct(from:number,to:number){return from>0?(to-from)/from*100:null}
function performanceLeagueFor(card:ScorecardCard){const l=getCardLeague(card as LeagueCard);return ["MLB","NBA","WNBA","NFL","NHL"].includes(l)?l as PerformanceLeague:undefined}

export function deriveScorecardSignal(card:ScorecardCard,scans:ScorecardScan[],supply:ScorecardSupply[],cache:ScorecardCatalystCache,performanceHistory:PlayerPerformanceSnapshot[]):Omit<SignalObservation,"id"|"signalAt">|null{
 const cardScans=latestTwo(scans.filter(s=>s.cardId===card.id));const current=card.marketScan||cardScans[0];
 const baselineMedian=Number(current?.currentMedian??cardScans[0]?.currentMedian);if(!Number.isFinite(baselineMedian)||baselineMedian<=0||Number(current?.acceptedCount??cardScans[0]?.acceptedCount??0)<3)return null;
 let leadScore=0,confirmScore=0,riskScore=0;const cat=topCatalyst(cache,card.player),league=getCardLeague(card as LeagueCard);
 if(cat&&cat.impact>=75){if(cat.tone==="negative")riskScore+=3;else leadScore+=cat.impact>=85?3:2}
 const perf=performanceSignal(latestPerformance(performanceHistory,card.player,performanceLeagueFor(card)));
 if(perf.direction==="SURGING")leadScore+=3;else if(perf.direction==="IMPROVING")leadScore+=2;else if(perf.direction==="SLUMPING")riskScore+=3;else if(perf.direction==="COOLING")riskScore+=2;
 if(cardScans.length>=2&&cardScans[0].velocity!=null&&cardScans[1].velocity!=null){const d=Number(cardScans[0].velocity)-Number(cardScans[1].velocity);if(d>=25)leadScore+=3;else if(d>=10)leadScore+=2;else if(d<=-25)riskScore+=3;else if(d<=-10)riskScore+=2}
 const sup=latestTwo(supply.filter(s=>s.cardId===card.id));if(sup.length>=2&&sup[1].acceptedCount>0){const d=(sup[0].acceptedCount-sup[1].acceptedCount)/sup[1].acceptedCount*100;if(d<=-30)leadScore+=3;else if(d<=-15)leadScore+=2;else if(d>=30)riskScore+=3;else if(d>=15)riskScore+=2}
 const change=current?.change7d??null;if(change!=null&&Math.abs(change)>=4){confirmScore+=Math.abs(change)>=10?3:2;if(change<0)riskScore+=1}
 let signalType:SignalType|null=null,direction:SignalDirection="UP";
 if(riskScore>=5&&riskScore>leadScore){signalType="RISK STACK";direction="DOWN"}
 else if(leadScore>=4&&confirmScore<2&&riskScore<=2){signalType="EARLY EDGE";direction="UP"}
 else if(leadScore>=3&&confirmScore>=2&&riskScore<=3){signalType="CONFIRMING";direction="UP"}
 if(!signalType)return null;
 const ctx=getCardMarketContext(card as MarketContextCard),edgeScore=Math.max(0,Math.min(100,50+leadScore*7+confirmScore*3-riskScore*8));
 return{cardId:card.id,player:card.player,cardMeta:card.meta||[card.year,card.setName,card.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(" · "),benchmark:!!card.benchmark,baselineMedian,signalType,direction,edgeScore,leadScore,confirmScore,riskScore,catalystCategory:String(cat?.category||"none").trim().toLowerCase()||"none",league,role:ctx.role,sensitivity:ctx.sensitivity,graded:ctx.graded};
}

export function observationId(card:ScorecardCard,signal:Pick<SignalObservation,"signalType">){const scanAt=card.marketScan?.scannedAt||"no-scan";return `${card.id}|${signal.signalType}|${scanAt}`}

export function mergeSignalObservations(existing:SignalObservation[],cards:ScorecardCard[],scans:ScorecardScan[],supply:ScorecardSupply[],cache:ScorecardCatalystCache,performanceHistory:PlayerPerformanceSnapshot[],now=new Date().toISOString()){
 const map=new Map(existing.map(x=>[x.id,x]));let changed=false;
 for(const card of cards){const derived=deriveScorecardSignal(card,scans,supply,cache,performanceHistory);if(!derived)continue;const id=observationId(card,derived);if(map.has(id))continue;map.set(id,{...derived,id,signalAt:card.marketScan?.scannedAt||now});changed=true}
 const rows=[...map.values()].sort((a,b)=>ms(b.signalAt)-ms(a.signalAt)).slice(0,6000);return{rows,changed};
}

export function resolveSignalOutcome(observation:SignalObservation,scans:ScorecardScan[],horizon:ScorecardHorizon,now=Date.now()):SignalOutcome{
 const cfg=SCORECARD_HORIZONS.find(x=>x[0]===horizon)!;const target=ms(observation.signalAt)+cfg[1]*3600000,targetAt=new Date(target).toISOString();if(now<target)return{observation,horizon,targetAt,scanAt:null,median:null,changePct:null,directionalMove:null,status:"PENDING",hit:null,meaningfulHit:null};
 const candidates=scans.filter(s=>s.cardId===observation.cardId&&ms(s.scannedAt)>ms(observation.signalAt)&&ms(s.scannedAt)>=target-cfg[2]*3600000&&ms(s.scannedAt)<=target+cfg[2]*3600000&&s.currentMedian!=null&&s.currentMedian>0).sort((a,b)=>Math.abs(ms(a.scannedAt)-target)-Math.abs(ms(b.scannedAt)-target));
 const match=candidates[0];if(!match||match.currentMedian==null)return{observation,horizon,targetAt,scanAt:null,median:null,changePct:null,directionalMove:null,status:"NO MATCH",hit:null,meaningfulHit:null};
 const change=pct(observation.baselineMedian,match.currentMedian),directional=change==null?null:observation.direction==="UP"?change:-change;return{observation,horizon,targetAt,scanAt:match.scannedAt,median:match.currentMedian,changePct:change,directionalMove:directional,status:"RESOLVED",hit:directional!=null?directional>0:null,meaningfulHit:directional!=null?directional>=4:null};
}

function median(vals:number[]){if(!vals.length)return null;const s=[...vals].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
export function summarizeSignalOutcomes(outcomes:SignalOutcome[]){const r=outcomes.filter(x=>x.status==="RESOLVED"&&x.directionalMove!=null),vals=r.map(x=>x.directionalMove as number);return{count:r.length,pending:outcomes.filter(x=>x.status==="PENDING").length,noMatch:outcomes.filter(x=>x.status==="NO MATCH").length,hitRate:r.length?r.filter(x=>x.hit).length/r.length*100:null,meaningfulHitRate:r.length?r.filter(x=>x.meaningfulHit).length/r.length*100:null,falsePositiveRate:r.length?r.filter(x=>!x.hit).length/r.length*100:null,medianDirectional:median(vals),averageDirectional:r.length?vals.reduce((a,b)=>a+b,0)/r.length:null,sample:r.length>=50?"STRONGER":r.length>=20?"USEFUL":r.length>=8?"BUILDING":"THIN"};}
