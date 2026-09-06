import type {CatalystEvent} from "./catalyst-history-model";

export type ScanSnapshot={id:string;cardId:number;player:string;meta:string;scannedAt:string;acceptedCount:number;currentMedian:number|null;change7d:number|null;velocity:number|null;pulse:string;confidence:string};
export type CatalystOutcomePoint={label:"24H"|"3D"|"7D"|"30D";targetAt:string;scanAt:string|null;median:number|null;changePct:number|null;status:"AVAILABLE"|"PENDING"|"NO MATCH"};
export type CatalystOutcomeRow={event:CatalystEvent;cardId:number;cardMeta:string;baselineAt:string;baselineMedian:number;points:CatalystOutcomePoint[]};

export const OUTCOME_HORIZONS=[{label:"24H" as const,hours:24,toleranceHours:18},{label:"3D" as const,hours:72,toleranceHours:30},{label:"7D" as const,hours:168,toleranceHours:54},{label:"30D" as const,hours:720,toleranceHours:120}];
const BASELINE_BEFORE_HOURS=36,BASELINE_AFTER_HOURS=12;

function ms(iso:string){const v=new Date(iso).getTime();return Number.isFinite(v)?v:0}
function pct(from:number,to:number){return from>0?(to-from)/from*100:null}

export function correlateCatalystEvent(event:CatalystEvent,history:ScanSnapshot[],now=Date.now()):CatalystOutcomeRow[]{
 const eventAt=ms(event.firstSeenAt);if(!eventAt)return[];
 const playerRows=history.filter(x=>x.player.trim().toLowerCase()===event.player.trim().toLowerCase()&&x.currentMedian!=null&&x.currentMedian>0);
 const cardIds=[...new Set(playerRows.map(x=>x.cardId))];
 const out:CatalystOutcomeRow[]=[];
 for(const cardId of cardIds){
  const rows=playerRows.filter(x=>x.cardId===cardId).sort((a,b)=>ms(a.scannedAt)-ms(b.scannedAt));
  const before=rows.filter(x=>{const t=ms(x.scannedAt);return t<=eventAt&&t>=eventAt-BASELINE_BEFORE_HOURS*3600000}).sort((a,b)=>ms(b.scannedAt)-ms(a.scannedAt))[0];
  const afterNear=rows.filter(x=>{const t=ms(x.scannedAt);return t>eventAt&&t<=eventAt+BASELINE_AFTER_HOURS*3600000}).sort((a,b)=>ms(a.scannedAt)-ms(b.scannedAt))[0];
  const baseline=before||afterNear;if(!baseline||baseline.currentMedian==null||baseline.currentMedian<=0)continue;
  const points:CatalystOutcomePoint[]=OUTCOME_HORIZONS.map(h=>{
   const target=eventAt+h.hours*3600000;const targetAt=new Date(target).toISOString();
   if(now<target)return{label:h.label,targetAt,scanAt:null,median:null,changePct:null,status:"PENDING"};
   const candidates=rows.filter(x=>{const t=ms(x.scannedAt);return t>=target-h.toleranceHours*3600000&&t<=target+h.toleranceHours*3600000&&t>ms(baseline.scannedAt)&&x.currentMedian!=null&&x.currentMedian>0}).sort((a,b)=>Math.abs(ms(a.scannedAt)-target)-Math.abs(ms(b.scannedAt)-target));
   const match=candidates[0];if(!match||match.currentMedian==null)return{label:h.label,targetAt,scanAt:null,median:null,changePct:null,status:"NO MATCH"};
   return{label:h.label,targetAt,scanAt:match.scannedAt,median:match.currentMedian,changePct:pct(baseline.currentMedian!,match.currentMedian),status:"AVAILABLE"};
  });
  out.push({event,cardId,cardMeta:baseline.meta||`Card ${cardId}`,baselineAt:baseline.scannedAt,baselineMedian:baseline.currentMedian,points});
 }
 return out;
}

export function correlateCatalysts(events:CatalystEvent[],history:ScanSnapshot[],now=Date.now()){
 return events.flatMap(e=>correlateCatalystEvent(e,history,now)).sort((a,b)=>ms(b.event.firstSeenAt)-ms(a.event.firstSeenAt));
}

export function outcomeSummary(rows:CatalystOutcomeRow[],label:CatalystOutcomePoint["label"]){
 const vals=rows.map(r=>r.points.find(p=>p.label===label)?.changePct).filter((v):v is number=>v!=null&&Number.isFinite(v));
 if(!vals.length)return{count:0,average:null,median:null,positiveRate:null};
 const sorted=[...vals].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);const median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
 return{count:vals.length,average:vals.reduce((a,b)=>a+b,0)/vals.length,median,positiveRate:vals.filter(v=>v>0).length/vals.length*100};
}
