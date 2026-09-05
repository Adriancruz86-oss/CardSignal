import type {ScorecardCard,ScorecardScan,SignalObservation,SignalDirection} from "./signal-scorecard-model";

export type MissedMove={cardId:number;player:string;cardMeta:string;scannedAt:string;change7d:number;direction:SignalDirection;acceptedCount:number;reason:string};
function ms(v:string){const n=new Date(v).getTime();return Number.isFinite(n)?n:0}

export function findMissedMoves(cards:ScorecardCard[],scans:ScorecardScan[],observations:SignalObservation[],threshold=8):MissedMove[]{
 const byId=new Map(cards.map(c=>[c.id,c]));const candidates=scans.filter(s=>s.acceptedCount>=3&&s.change7d!=null&&Math.abs(s.change7d)>=threshold).sort((a,b)=>ms(b.scannedAt)-ms(a.scannedAt));const out:MissedMove[]=[];const seen=new Set<number>();
 for(const scan of candidates){if(seen.has(scan.cardId))continue;const card=byId.get(scan.cardId);if(!card)continue;const direction:SignalDirection=(scan.change7d||0)>0?"UP":"DOWN",end=ms(scan.scannedAt),start=end-7*86400000;const prior=observations.filter(o=>o.cardId===scan.cardId&&o.direction===direction&&ms(o.signalAt)>=start&&ms(o.signalAt)<=end);if(prior.length)continue;seen.add(scan.cardId);out.push({cardId:scan.cardId,player:card.player,cardMeta:card.meta||[card.year,card.setName,card.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(" · "),scannedAt:scan.scannedAt,change7d:scan.change7d as number,direction,acceptedCount:scan.acceptedCount,reason:`${Math.abs(scan.change7d as number).toFixed(1)}% 7D move reached the ${threshold}% audit threshold without a same-direction saved Edge signal in the preceding 7 days.`})}
 return out.slice(0,100);
}
