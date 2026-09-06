export type SupplyState="NO DATA"|"BASELINE"|"SUPPLY TIGHTENING"|"SUPPLY RISING"|"NEUTRAL"|"IDENTITY AMBIGUOUS";
export type SupplyEvidence={scannedAt?:string;activeAccepted?:number;rawTotal?:number;lowestAsk?:number|null;medianAsk?:number|null;highestAsk?:number|null;inventoryDeltaPct?:number|null;medianAskDeltaPct?:number|null;historyCount?:number;identityConfidence?:"HIGH"|"MEDIUM"|"LOW";state?:SupplyState};
export type MarketPulse="BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA";

export function deriveSupplyState(e?:SupplyEvidence|null):SupplyState{
 if(!e?.scannedAt)return"NO DATA";
 if(e.identityConfidence==="LOW")return"IDENTITY AMBIGUOUS";
 if((e.historyCount||0)<2||e.inventoryDeltaPct==null)return"BASELINE";
 if(e.inventoryDeltaPct<=-15)return"SUPPLY TIGHTENING";
 if(e.inventoryDeltaPct>=15)return"SUPPLY RISING";
 return"NEUTRAL";
}
export function supplyScoreAdjustment(e?:SupplyEvidence|null){const s=deriveSupplyState(e);return s==="SUPPLY TIGHTENING"?6:s==="SUPPLY RISING"?-6:0}
export function effectivePulse(base:MarketPulse|undefined,change7d:number|null|undefined,e?:SupplyEvidence|null):MarketPulse{
 const pulse=base||"NOT ENOUGH DATA",state=deriveSupplyState(e);
 if(pulse==="NOT ENOUGH DATA"||!["SUPPLY TIGHTENING","SUPPLY RISING"].includes(state))return pulse;
 const move=Number(change7d||0),ask=Number(e?.medianAskDeltaPct||0);
 if(state==="SUPPLY RISING"&&move<0&&ask<=0)return"SELL RISK";
 if(state==="SUPPLY TIGHTENING"&&move>0&&ask>=0)return"BUY MORE";
 return pulse==="HOLD"?"WATCH CLOSELY":pulse;
}
