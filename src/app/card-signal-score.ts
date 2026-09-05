export type ScorePulse="BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";
export type ScoreScan={scannedAt?:string;acceptedCount?:number;change7d?:number|null;velocity?:number|null;pulse?:ScorePulse;confidence?:string};
export type ScoreCard={marketScan?:ScoreScan;marketValue?:number;player?:string};

export type CardSignalScore={
  score:number;
  label:"STRONG BUY SETUP"|"POSITIVE SETUP"|"NEUTRAL / WATCH"|"CAUTION"|"EXIT RISK"|"NEEDS DATA"|"UNSCANNED";
  tone:"buy"|"hold"|"watch"|"sell"|"data";
  components:{price:number;velocity:number;evidence:number;confidence:number;freshness:number};
};

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function ageHours(iso?:string){if(!iso)return Infinity;const t=new Date(iso).getTime();return Number.isFinite(t)?Math.max(0,Date.now()-t)/3600000:Infinity}

export function getCardSignalScore(card:ScoreCard):CardSignalScore{
  const s=card.marketScan;
  if(!s)return{score:0,label:"UNSCANNED",tone:"data",components:{price:0,velocity:0,evidence:0,confidence:0,freshness:0}};
  const accepted=Math.max(0,Number(s.acceptedCount||0));
  if(accepted<3)return{score:Math.min(49,18+accepted*8),label:"NEEDS DATA",tone:"data",components:{price:0,velocity:0,evidence:Math.round(clamp(accepted/10,0,1)*20),confidence:0,freshness:0}};

  const change=s.change7d==null?0:Number(s.change7d);
  const price=Math.round(clamp(15+clamp(change,-20,20)*0.75,0,30));
  const velocity=Math.round(clamp(Number(s.velocity||0),0,100)*0.20);
  const evidence=Math.round(clamp(accepted/20,0,1)*20);
  const c=(s.confidence||"").toUpperCase();
  const confidence=c.includes("HIGH")?15:c.includes("MODERATE")?10:c.includes("LOW")?5:6;
  const age=ageHours(s.scannedAt);
  const freshness=age<=24?15:age<=72?10:age<=168?5:0;
  let score=clamp(price+velocity+evidence+confidence+freshness,0,100);

  if(s.pulse==="BUY MORE")score=Math.max(score,66);
  if(s.pulse==="SELL RISK")score=Math.min(score,34);
  if(s.pulse==="WATCH CLOSELY")score=clamp(score,35,64);
  if(s.pulse==="HOLD")score=clamp(score,45,69);
  score=Math.round(score);

  if(s.pulse==="SELL RISK"||score<35)return{score,label:"EXIT RISK",tone:"sell",components:{price,velocity,evidence,confidence,freshness}};
  if(score>=80)return{score,label:"STRONG BUY SETUP",tone:"buy",components:{price,velocity,evidence,confidence,freshness}};
  if(score>=65)return{score,label:"POSITIVE SETUP",tone:"buy",components:{price,velocity,evidence,confidence,freshness}};
  if(score>=50)return{score,label:"NEUTRAL / WATCH",tone:"hold",components:{price,velocity,evidence,confidence,freshness}};
  return{score,label:"CAUTION",tone:"watch",components:{price,velocity,evidence,confidence,freshness}};
}
