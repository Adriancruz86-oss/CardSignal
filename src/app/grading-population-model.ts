export type GradingProvider="PSA"|"BGS"|"SGC"|"CGC"|"OTHER";

export type PopulationSnapshot={
  id:string;
  cardId:number;
  provider:GradingProvider;
  grade:string;
  totalPop:number;
  higherPop:number|null;
  capturedAt:string;
  source:"MANUAL"|"API";
  sourceNote?:string;
};

export type PopulationTrend={
  current:PopulationSnapshot|null;
  prior:PopulationSnapshot|null;
  change:number|null;
  changePct:number|null;
  days:number|null;
  dailyRatePct:number|null;
  status:"NO DATA"|"BASELINE"|"RAPID GROWTH"|"GROWING"|"STABLE"|"DECLINING";
};

export const POPULATION_HISTORY_KEY="cardsignal-grading-population-history";

export function readPopulationHistory():PopulationSnapshot[]{
  try{const v=JSON.parse(localStorage.getItem(POPULATION_HISTORY_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}
}

export function writePopulationHistory(rows:PopulationSnapshot[]){
  localStorage.setItem(POPULATION_HISTORY_KEY,JSON.stringify(rows.slice(0,2500)));
  window.dispatchEvent(new Event("cardsignal:grading-population-changed"));
}

export function populationTrend(history:PopulationSnapshot[],cardId:number,provider?:GradingProvider,grade?:string):PopulationTrend{
  const rows=history.filter(x=>x.cardId===cardId&&(!provider||x.provider===provider)&&(!grade||x.grade===grade)).sort((a,b)=>new Date(b.capturedAt).getTime()-new Date(a.capturedAt).getTime());
  const current=rows[0]||null,prior=rows[1]||null;
  if(!current)return{current:null,prior:null,change:null,changePct:null,days:null,dailyRatePct:null,status:"NO DATA"};
  if(!prior)return{current,prior:null,change:null,changePct:null,days:null,dailyRatePct:null,status:"BASELINE"};
  const change=current.totalPop-prior.totalPop;
  const changePct=prior.totalPop>0?change/prior.totalPop*100:null;
  const ms=Math.max(0,new Date(current.capturedAt).getTime()-new Date(prior.capturedAt).getTime());
  const days=Math.max(1,ms/86400000);
  const dailyRatePct=changePct==null?null:changePct/days;
  const status=changePct==null?"STABLE":changePct>=8?"RAPID GROWTH":changePct>=2?"GROWING":changePct<=-1?"DECLINING":"STABLE";
  return{current,prior,change,changePct,days,dailyRatePct,status};
}

export function nearestTrend(history:PopulationSnapshot[],cardId:number,daysAgo:number,provider?:GradingProvider,grade?:string){
  const rows=history.filter(x=>x.cardId===cardId&&(!provider||x.provider===provider)&&(!grade||x.grade===grade)).sort((a,b)=>new Date(b.capturedAt).getTime()-new Date(a.capturedAt).getTime());
  const current=rows[0];if(!current)return null;
  const target=new Date(current.capturedAt).getTime()-daysAgo*86400000;
  const prior=rows.filter(x=>new Date(x.capturedAt).getTime()<=target).sort((a,b)=>Math.abs(new Date(a.capturedAt).getTime()-target)-Math.abs(new Date(b.capturedAt).getTime()-target))[0];
  if(!prior)return null;
  const change=current.totalPop-prior.totalPop;
  const pct=prior.totalPop>0?change/prior.totalPop*100:null;
  return{days:daysAgo,change,pct};
}
