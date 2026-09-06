import { NextRequest, NextResponse } from "next/server";

type Sale = { source:"SoldComps"|"The Card API"; id:string; title:string; price:number|null; date:string; marketplace:string };
type Canonical = { player:string; year:string; setName:string; cardNumber:string; variant:string; grader:string; grade:string };

const VARIANTS=["logofractor","refractor","x-fractor","xfractor","superfractor","cosmic chrome","cosmic","sapphire","silver","holo","hyper","wave","shimmer","cracked ice","ice","scope","mojo","sepia","negative","pink","purple","blue","green","red","orange","gold","black","aqua","raywave","ray wave"];
const SET_NOISE=new Set(["base","card","cards","football","baseball","basketball","hockey","trading"]);
const LOT_WORDS=["lot","bundle","collection","repack","you pick","pick your"];
const GRADERS=["psa","bgs","sgc","cgc","beckett","graded","slab"];
function normalize(v:string){return v.toLowerCase().replace(/[–—]/g,"-").replace(/[^a-z0-9#/.+-]+/g," ").replace(/\s+/g," ").trim()}
function phraseIn(text:string,phrase:string){return ` ${normalize(text)} `.includes(` ${normalize(phrase)} `)}
function num(v:unknown){const n=typeof v==="number"?v:Number.parseFloat(String(v??""));return Number.isFinite(n)?n:null}
function median(v:number[]){if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function extractNumber(t:string){return normalize(t).match(/#\s*([a-z0-9-]+)/)?.[1]??""}
function setTokens(v:string){return normalize(v).split(" ").filter(x=>x.length>2&&!SET_NOISE.has(x))}
function gradeMatch(c:Canonical,title:string){const t=normalize(title),grader=normalize(c.grader),grade=normalize(c.grade);if(grader==="raw")return !GRADERS.some(x=>phraseIn(t,x))&&!/\b(?:authentic|gem mint|near mint mint)\b/.test(t);if(!grader||!grade)return false;const expected=grader==="beckett"?"bgs":grader;if(!phraseIn(t,expected))return false;const escaped=grade.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return new RegExp(`\\b${expected}\\s*${escaped}(?:\\.0)?\\b`,"i").test(t)}
function exactMatch(c:Canonical,s:Sale){const t=normalize(s.title);if(LOT_WORDS.some(x=>phraseIn(t,x)))return false;const pt=normalize(c.player).split(" ").filter(x=>x.length>1);if(pt.length&&!pt.every(x=>t.includes(x)))return false;if(c.year){const years=[...t.matchAll(/\b((?:19|20)\d{2})\b/g)].map(x=>x[1]);if(!years.includes(c.year.slice(0,4)))return false}if(c.setName){const required=setTokens(c.setName);if(required.length&&!required.every(x=>t.includes(x)))return false}if(c.cardNumber){const n=extractNumber(t);if(!n||normalize(n)!==normalize(c.cardNumber))return false}if(c.variant&&!phraseIn(t,c.variant))return false;if(!c.variant&&VARIANTS.some(v=>phraseIn(s.title,v)))return false;return gradeMatch(c,s.title)}
function dedupe(sales:Sale[]){const seen=new Set<string>();return sales.filter(s=>{const k=s.id?`${s.source}|${s.id}`:`${normalize(s.title).slice(0,100)}|${s.price}|${s.date.slice(0,10)}`;if(seen.has(k))return false;seen.add(k);return true})}
async function soldComps(q:string){const k=process.env.SOLD_COMPS_API_KEY?.trim();if(!k)return{ok:false,sales:[] as Sale[],error:"Missing SOLD_COMPS_API_KEY"};try{const r=await fetch(`https://api.sold-comps.com/v1/scrape?keyword=${encodeURIComponent(q)}&count=40&exactMatch=false`,{headers:{Accept:"application/json",Authorization:`Bearer ${k}`,"User-Agent":"CardSignal/0.1"},cache:"no-store"});const text=await r.text();let p:Record<string,unknown>={};try{p=JSON.parse(text)}catch{}if(!r.ok)return{ok:false,sales:[] as Sale[],error:String(p.error??p.message??text.slice(0,180))};const rows=Array.isArray(p.items)?p.items as Record<string,unknown>[]:[];return{ok:true,sales:rows.map(i=>({source:"SoldComps" as const,id:String(i.itemId??""),title:String(i.title??""),price:num(i.soldPrice),date:String(i.endedAt??""),marketplace:String(i.marketplace??"eBay")}))}}catch(e){return{ok:false,sales:[] as Sale[],error:e instanceof Error?e.message:"SoldComps failed"}}}
async function cardApi(q:string){const k=process.env.CARD_API_KEY?.trim();if(!k)return{ok:false,sales:[] as Sale[],error:"Missing CARD_API_KEY"};try{const r=await fetch(`https://thecardapi.com/api/v1/market/sales?q=${encodeURIComponent(q)}&limit=40`,{headers:{Accept:"application/json","x-market-api-key":k},cache:"no-store"});const text=await r.text();let p:Record<string,unknown>={};try{p=JSON.parse(text)}catch{}if(!r.ok)return{ok:false,sales:[] as Sale[],error:String(p.error??p.message??text.slice(0,180))};const rows=Array.isArray(p.data)?p.data as Record<string,unknown>[]:[];return{ok:true,sales:rows.map(i=>({source:"The Card API" as const,id:String(i.id??""),title:String(i.title??""),price:num(i.price??i.sale_price),date:String(i.sale_date??i.sold_at??""),marketplace:String(i.platform??"eBay")}))}}catch(e){return{ok:false,sales:[] as Sale[],error:e instanceof Error?e.message:"Card API failed"}}}
function dateMs(v:string){const t=Date.parse(v);return Number.isFinite(t)?t:null}

export async function GET(request:NextRequest){
  const sp=new URL(request.url).searchParams;
  const c:Canonical={player:sp.get("player")?.trim()??"",year:sp.get("year")?.trim()??"",setName:sp.get("set")?.trim()??"",cardNumber:sp.get("cardNumber")?.trim()??"",variant:sp.get("variant")?.trim()??"",grader:sp.get("grader")?.trim()??"",grade:sp.get("grade")?.trim()??""};
  if(!c.player)return NextResponse.json({ok:false,error:"Player is required"},{status:400});
  const conditionComplete=normalize(c.grader)==="raw"||Boolean(c.grader&&c.grade);
  const identityConfidence=c.year&&c.setName&&c.cardNumber&&conditionComplete?"HIGH":"LOW";
  const q=[c.player,c.year,c.setName,c.cardNumber?`#${c.cardNumber}`:"",c.variant,c.grader&&normalize(c.grader)!=="raw"?c.grader:"",c.grade].filter(Boolean).join(" ");
  const started=Date.now();
  const[sold,card]=await Promise.all([soldComps(q),cardApi(q)]);
  const raw=dedupe([...sold.sales,...card.sales]);
  const accepted=identityConfidence==="HIGH"?raw.filter(s=>exactMatch(c,s)&&s.price!=null&&s.price>0):[];
  const prices=accepted.map(s=>s.price as number);
  const currentMedian=median(prices);
  const now=Date.now(),day=86400000;
  const dated=accepted.map(s=>({sale:s,ms:dateMs(s.date)})).filter((x):x is {sale:Sale;ms:number}=>x.ms!=null);
  const recent=dated.filter(x=>x.ms>=now-7*day).map(x=>x.sale.price as number);
  const prior=dated.filter(x=>x.ms<now-7*day&&x.ms>=now-30*day).map(x=>x.sale.price as number);
  const recentMedian=median(recent),priorMedian=median(prior);
  const change7d=recentMedian!=null&&priorMedian!=null&&priorMedian>0&&recent.length>=2&&prior.length>=2?((recentMedian-priorMedian)/priorMedian)*100:null;
  const recentSales=recent.length;
  const velocity=accepted.length>=3?Math.min(100,Math.round(recentSales*14+accepted.length*2)):null;
  let pulse:"BUY MORE"|"HOLD"|"WATCH CLOSELY"|"SELL RISK"|"NOT ENOUGH DATA"="NOT ENOUGH DATA";
  if(accepted.length>=3&&change7d!=null){if(change7d<=-8&&recentSales>=2)pulse="SELL RISK";else if(change7d>=8&&recentSales>=3)pulse="BUY MORE";else if(Math.abs(change7d)>=4)pulse="WATCH CLOSELY";else pulse="HOLD";}
  const confidence=accepted.length>=10&&recent.length>=3&&prior.length>=3?"HIGH":accepted.length>=5&&recent.length>=2&&prior.length>=2?"MODERATE":"LOW";
  const acceptedSales=[...accepted].sort((a,b)=>(dateMs(b.date)??0)-(dateMs(a.date)??0)).slice(0,12);
  return NextResponse.json({ok:sold.ok||card.ok,matchingVersion:3,query:q,identityConfidence,conditionConfidence:conditionComplete?"HIGH":"LOW",identityWarning:identityConfidence==="LOW"?"Confirm year, set, card number, and raw or exact grading details before CardSignal accepts market matches.":null,elapsedMs:Date.now()-started,acceptedCount:accepted.length,rejectedCount:raw.length-accepted.length,currentMedian,recentMedian,priorMedian,change7d:change7d==null?null:Math.round(change7d*10)/10,recentSales,velocity,pulse,confidence,acceptedSales,sources:{soldComps:{ok:sold.ok,error:sold.error??null,rawCount:sold.sales.length},cardApi:{ok:card.ok,error:card.error??null,rawCount:card.sales.length}}});
}
