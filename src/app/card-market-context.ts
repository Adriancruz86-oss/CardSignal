export type MarketContextCard={
  year?:string;
  setName?:string;
  variant?:string;
  cardNumber?:string;
  grader?:string;
  grade?:string;
  meta?:string;
};

export type CardEra="VINTAGE"|"MODERN"|"ULTRA-MODERN"|"UNKNOWN";
export type CardRole="ROOKIE / PROSPECT"|"VETERAN / BASE"|"UNKNOWN";
export type SupplyHint="SCARCITY CLUES"|"COMMON / UNSPECIFIED";

export type CardMarketContext={
  era:CardEra;
  role:CardRole;
  supplyHint:SupplyHint;
  graded:boolean;
  sensitivity:"HIGH"|"ELEVATED"|"STANDARD";
  reasons:string[];
};

function norm(v:unknown){return String(v||"").toLowerCase().replace(/[–—]/g,"-");}
function yearNumber(v?:string){const m=String(v||"").match(/\b((?:18|19|20)\d{2})\b/);return m?Number(m[1]):null;}
function text(card:MarketContextCard){return norm([card.setName,card.variant,card.cardNumber,card.grader,card.grade,card.meta].filter(Boolean).join(" "));}

const ROOKIE=["rookie"," rc ","rookie card","1st bowman","bowman 1st","first bowman","prospect","debut"];
const SCARCE=["/1","1/1","/5","/10","/15","/20","/25","/49","/50","/75","/99","superfractor","logoman","logo man","gold vinyl","finite","ssp","sp ","short print","auto","autograph","patch","relic"];
const PARALLEL=["refractor","x-fractor","xfractor","sapphire","silver","holo","prizm","wave","shimmer","cracked ice","scope","mojo","sepia","negative","pink","purple","blue","green","red","orange","gold","black","aqua","raywave","ray wave"];

export function getCardMarketContext(card:MarketContextCard):CardMarketContext{
  const t=` ${text(card)} `;
  const y=yearNumber(card.year);
  const era:CardEra=y==null?"UNKNOWN":y<=1989?"VINTAGE":y<=2015?"MODERN":"ULTRA-MODERN";
  const rookie=ROOKIE.some(k=>t.includes(k));
  const scarce=SCARCE.some(k=>t.includes(k))||/\b\d{1,3}\s*\/\s*(?:1|5|10|15|20|25|49|50|75|99)\b/.test(t);
  const parallel=PARALLEL.some(k=>t.includes(k));
  const graded=!!String(card.grader||"").trim()||/\b(psa|bgs|sgc|cgc)\s*(?:10|9(?:\.5)?|8(?:\.5)?|7(?:\.5)?)?\b/.test(t);
  const reasons:string[]=[];
  if(rookie)reasons.push("rookie/prospect identity clue");
  if(scarce)reasons.push("numbered / auto / SSP scarcity clue");
  else if(parallel)reasons.push("parallel identity clue");
  if(graded)reasons.push("graded card");
  if(era!=="UNKNOWN")reasons.push(era.toLowerCase().replace("-"," ")+" era");
  const sensitivity=scarce&&rookie?"HIGH":rookie||scarce||parallel?"ELEVATED":"STANDARD";
  return{era,role:rookie?"ROOKIE / PROSPECT":t.trim()?"VETERAN / BASE":"UNKNOWN",supplyHint:scarce?"SCARCITY CLUES":"COMMON / UNSPECIFIED",graded,sensitivity,reasons};
}
