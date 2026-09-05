export type PerformanceLeague="MLB"|"NBA"|"WNBA"|"NFL"|"NHL"|"OTHER";
export type PerformanceDirection="SURGING"|"IMPROVING"|"STEADY"|"COOLING"|"SLUMPING"|"NO DATA";

export type PerformanceMetric={
 key:string;
 label:string;
 recent:number;
 baseline:number;
 higherIsBetter?:boolean;
 weight?:number;
 unit?:string;
};

export type PlayerPerformanceSnapshot={
 id:string;
 player:string;
 league:PerformanceLeague;
 capturedAt:string;
 source:"MANUAL"|"API";
 sourceNote?:string;
 metrics:PerformanceMetric[];
 streakLabel?:string;
 roleLabel?:string;
 eventLabel?:string;
};

export type PerformanceSignal={
 score:number;
 direction:PerformanceDirection;
 confidence:"LOW"|"MEDIUM"|"HIGH";
 positive:number;
 negative:number;
 reasons:string[];
};

export const PERFORMANCE_HISTORY_KEY="cardsignal-player-performance-history";

export function readPerformanceHistory():PlayerPerformanceSnapshot[]{
 if(typeof window==="undefined")return[];
 try{const v=JSON.parse(localStorage.getItem(PERFORMANCE_HISTORY_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}
}
export function writePerformanceHistory(rows:PlayerPerformanceSnapshot[]){
 localStorage.setItem(PERFORMANCE_HISTORY_KEY,JSON.stringify(rows.slice(0,3000)));
 window.dispatchEvent(new Event("cardsignal:performance-changed"));
}

function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}
export function performanceSignal(snapshot:PlayerPerformanceSnapshot|null):PerformanceSignal{
 if(!snapshot||!snapshot.metrics?.length)return{score:0,direction:"NO DATA",confidence:"LOW",positive:0,negative:0,reasons:[]};
 let weighted=0,totalWeight=0,positive=0,negative=0;const reasons:string[]=[];
 for(const m of snapshot.metrics){
  if(!Number.isFinite(m.recent)||!Number.isFinite(m.baseline)||m.baseline===0)continue;
  const w=Math.max(.1,m.weight||1);const raw=(m.recent-m.baseline)/Math.abs(m.baseline)*100;const adjusted=(m.higherIsBetter===false?-raw:raw);const contribution=clamp(adjusted,-60,60);
  weighted+=contribution*w;totalWeight+=w;if(contribution>=8)positive++;if(contribution<=-8)negative++;
  if(Math.abs(contribution)>=12)reasons.push(`${m.label} ${contribution>0?"above":"below"} baseline (${contribution>0?"+":""}${contribution.toFixed(0)}%)`);
 }
 if(!totalWeight)return{score:0,direction:"NO DATA",confidence:"LOW",positive:0,negative:0,reasons:[]};
 const avg=weighted/totalWeight;const score=Math.round(clamp(50+avg*.7,0,100));
 const direction:PerformanceDirection=avg>=22?"SURGING":avg>=8?"IMPROVING":avg<=-22?"SLUMPING":avg<=-8?"COOLING":"STEADY";
 const valid=snapshot.metrics.filter(m=>Number.isFinite(m.recent)&&Number.isFinite(m.baseline)&&m.baseline!==0).length;
 const confidence=valid>=4?"HIGH":valid>=2?"MEDIUM":"LOW";
 if(snapshot.streakLabel)reasons.unshift(snapshot.streakLabel);if(snapshot.roleLabel)reasons.push(snapshot.roleLabel);if(snapshot.eventLabel)reasons.push(snapshot.eventLabel);
 return{score,direction,confidence,positive,negative,reasons:reasons.slice(0,5)};
}

export function latestPerformance(history:PlayerPerformanceSnapshot[],player:string,league?:PerformanceLeague){
 return history.filter(x=>x.player.toLowerCase()===player.toLowerCase()&&(!league||x.league===league)).sort((a,b)=>new Date(b.capturedAt).getTime()-new Date(a.capturedAt).getTime())[0]||null;
}
