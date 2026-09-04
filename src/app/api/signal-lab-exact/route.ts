import { NextRequest, NextResponse } from "next/server";

type Sale = { source: "SoldComps" | "The Card API"; id: string; title: string; price: number | null; date: string; marketplace: string; grader?: string; grade?: string; url?: string; image?: string };
type Identity = { year?: string; setName?: string; manufacturer?: string; cardNumber?: string; playerName?: string; variation?: string; sport?: string; url?: string };
type Canonical = { player: string; year: string; setName: string; cardNumber: string; variant: string; grader: string; grade: string };

const VARIANTS = ["logofractor","refractor","x-fractor","xfractor","superfractor","cosmic chrome","cosmic","sapphire","silver","holo","hyper","wave","shimmer","cracked ice","ice","scope","mojo","sepia","negative","pink","purple","blue","green","red","orange","gold","black","aqua","raywave","ray wave"];
const FAMILY_EXCLUDES: Record<string,string[]> = {
  "topps chrome": ["topps chrome update","cosmic chrome","logofractor","sapphire"],
  "prizm": ["mosaic","select","optic"],
};

function normalize(v: string) { return v.toLowerCase().replace(/[–—]/g,"-").replace(/[^a-z0-9#/.+-]+/g," ").replace(/\s+/g," ").trim(); }
function phraseIn(text: string, phrase: string) { const t=` ${normalize(text)} `; const p=` ${normalize(phrase)} `; return t.includes(p); }
function num(v: unknown) { const n=typeof v === "number" ? v : Number.parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : null; }
function median(values:number[]){ if(!values.length)return null; const s=[...values].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function stats(sales:Sale[]){ const p=sales.map(s=>s.price).filter((v):v is number=>v!=null); if(!p.length)return{count:0,median:null,average:null,low:null,high:null}; return{count:p.length,median:median(p),average:p.reduce((a,b)=>a+b,0)/p.length,low:Math.min(...p),high:Math.max(...p)}; }
function extractNumber(title:string){ return normalize(title).match(/#\s*([a-z0-9-]+)/)?.[1] ?? ""; }
function isSerial(title:string){ return /(?:^|\s)\/\d{2,4}\b/.test(normalize(title)); }
function dedupe(sales:Sale[]){ const seen=new Set<string>(); return sales.filter(s=>{ const key=s.id?`${s.source}|${s.id}`:`${normalize(s.title).slice(0,100)}|${s.price}|${s.date.slice(0,10)}`; if(seen.has(key))return false; seen.add(key); return true; }); }

function matchSale(c:Canonical,sale:Sale){
  const title=normalize(sale.title);
  const playerTokens=normalize(c.player).split(" ").filter(t=>t.length>1);
  if(playerTokens.length && !playerTokens.every(t=>title.includes(t))) return false;
  if(c.year){ const y=title.match(/\b((?:19|20)\d{2})\b/)?.[1]??""; if(y && y!==c.year.slice(0,4)) return false; }
  if(c.setName && !phraseIn(title,c.setName)) return false;
  const family=normalize(c.setName); for(const [base,ex] of Object.entries(FAMILY_EXCLUDES)){ if(family===base && ex.some(x=>phraseIn(title,x))) return false; }
  if(c.cardNumber){ const n=extractNumber(title); if(n && normalize(n)!==normalize(c.cardNumber)) return false; }
  if(c.variant){ if(!phraseIn(title,c.variant)) return false; } else { const unexpected=VARIANTS.find(v=>phraseIn(title,v)); if(unexpected) return false; }
  if(!c.variant && isSerial(title)) return false;
  if(c.grader){ const gf=normalize(sale.grader??""); if(!phraseIn(title,c.grader) && gf!==normalize(c.grader)) return false; }
  if(c.grade){ const field=normalize(sale.grade??""); const titleGrade=new RegExp(`\\b${c.grader || "(?:psa|bgs|sgc|cgc)"}\\s*${c.grade.replace(".","\\.")}\\b`,`i`).test(sale.title); if(!titleGrade && field!==normalize(c.grade)) return false; }
  return true;
}

async function soldComps(query:string){ const key=process.env.SOLD_COMPS_API_KEY?.trim(); if(!key)return{ok:false,sales:[] as Sale[],error:"Missing SOLD_COMPS_API_KEY"}; try{ const r=await fetch(`https://api.sold-comps.com/v1/scrape?keyword=${encodeURIComponent(query)}&count=40&exactMatch=false`,{headers:{Accept:"application/json",Authorization:`Bearer ${key}`,"User-Agent":"CardSignal/0.1"},cache:"no-store"}); const text=await r.text(); let p:Record<string,unknown>={}; try{p=JSON.parse(text)}catch{} if(!r.ok)return{ok:false,sales:[] as Sale[],error:String(p.error??p.message??text.slice(0,180))}; const items=Array.isArray(p.items)?p.items as Record<string,unknown>[]:[]; return{ok:true,sales:items.map(i=>({source:"SoldComps" as const,id:String(i.itemId??""),title:String(i.title??""),price:num(i.soldPrice),date:String(i.endedAt??""),marketplace:String(i.marketplace??"eBay"),url:String(i.url??""),image:String(i.thumbnailUrl??"")}))}; }catch(e){return{ok:false,sales:[] as Sale[],error:e instanceof Error?e.message:"SoldComps failed"};} }
async function cardApi(query:string){ const key=process.env.CARD_API_KEY?.trim(); if(!key)return{ok:false,sales:[] as Sale[],error:"Missing CARD_API_KEY"}; try{ const r=await fetch(`https://thecardapi.com/api/v1/market/sales?q=${encodeURIComponent(query)}&limit=40`,{headers:{Accept:"application/json","x-market-api-key":key},cache:"no-store"}); const text=await r.text(); let p:Record<string,unknown>={}; try{p=JSON.parse(text)}catch{} if(!r.ok)return{ok:false,sales:[] as Sale[],error:String(p.error??p.message??text.slice(0,180))}; const rows=Array.isArray(p.data)?p.data as Record<string,unknown>[]:[]; return{ok:true,sales:rows.map(i=>({source:"The Card API" as const,id:String(i.id??""),title:String(i.title??""),price:num(i.price??i.sale_price),date:String(i.sale_date??i.sold_at??""),marketplace:String(i.platform??"eBay"),grader:String(i.grader??i.grading_company??""),grade:String(i.grade??""),url:String(i.listing_url??""),image:String(i.thumbnail_url??i.image_url??"")}))}; }catch(e){return{ok:false,sales:[] as Sale[],error:e instanceof Error?e.message:"Card API failed"};} }
async function tcdb(c:Canonical){ const key=process.env.PARSE_API_KEY?.trim(); if(!key)return{ok:false,identities:[] as Identity[],error:"Missing PARSE_API_KEY"}; const qs=new URLSearchParams({query:c.player}); if(c.year)qs.set("year",c.year); if(c.setName)qs.set("set_name",c.setName); try{ const r=await fetch(`https://api.parse.bot/scraper/123aeda8-4611-4871-a592-2109a3f6434f/search_cards?${qs.toString()}`,{headers:{Accept:"application/json","X-API-Key":key},cache:"no-store"}); const text=await r.text(); let p:Record<string,unknown>={}; try{p=JSON.parse(text)}catch{} if(!r.ok)return{ok:false,identities:[] as Identity[],error:String(p.error??p.message??text.slice(0,180))}; const root=(p.data&&typeof p.data==="object")?p.data as Record<string,unknown>:p; const rows=Array.isArray(root.results)?root.results as Record<string,unknown>[]:Array.isArray(root.cards)?root.cards as Record<string,unknown>[]:[]; const ids=rows.map(row=>({year:String(row.year??""),setName:String(row.set_name??row.setName??""),manufacturer:String(row.manufacturer??""),cardNumber:String(row.card_number??row.number??""),playerName:String(row.player_name??row.name??""),variation:String(row.parallel_variation??row.variation??""),sport:String(row.sport??""),url:String(row.url??"")})).filter(id=>(!c.year||!id.year||id.year.startsWith(c.year))&&(!c.setName||!id.setName||normalize(id.setName).includes(normalize(c.setName)))&&(!c.cardNumber||!id.cardNumber||normalize(id.cardNumber)===normalize(c.cardNumber))); return{ok:true,identities:ids.slice(0,12)}; }catch(e){return{ok:false,identities:[] as Identity[],error:e instanceof Error?e.message:"TCDB failed"};} }

export async function GET(request:NextRequest){
  const sp=new URL(request.url).searchParams; const q=sp.get("q")?.trim()??""; const player=sp.get("player")?.trim()??""; if(!q||!player)return NextResponse.json({ok:false,error:"Exact card selection required"},{status:400});
  const grader=normalize(q).match(/\b(psa|bgs|sgc|cgc)\b/)?.[1]??""; const grade=grader?normalize(q).match(new RegExp(`\\b${grader}\\s*(10|9(?:\\.5)?|8(?:\\.5)?|7(?:\\.5)?)\\b`))?.[1]??"":"";
  const canonical:Canonical={player,year:sp.get("year")?.trim()??"",setName:sp.get("set")?.trim()??"",cardNumber:sp.get("cardNumber")?.trim()??"",variant:sp.get("variant")?.trim()??"",grader,grade};
  const exactQuery=[canonical.player,canonical.year,canonical.setName,canonical.cardNumber?`#${canonical.cardNumber}`:"",canonical.variant,canonical.grader?`${canonical.grader.toUpperCase()} ${canonical.grade}`:""].filter(Boolean).join(" ");
  const started=Date.now(); const [sold,card,catalog]=await Promise.all([soldComps(exactQuery),cardApi(exactQuery),tcdb(canonical)]);
  const soldAccepted=sold.sales.filter(s=>matchSale(canonical,s)); const cardAccepted=card.sales.filter(s=>matchSale(canonical,s)); const merged=dedupe([...soldAccepted,...cardAccepted]); const ss=stats(soldAccepted); const cs=stats(cardAccepted); const ms=stats(merged); const med=[ss.median,cs.median].filter((v):v is number=>v!=null&&v>0); const diff=med.length===2?Math.abs(med[0]-med[1])/((med[0]+med[1])/2)*100:null; const agreement=diff==null?"Single source":diff<=12?"High":diff<=25?"Moderate":"Low";
  return NextResponse.json({ok:sold.ok||card.ok||catalog.ok,query:q,canonical,elapsedMs:Date.now()-started,identity:{provider:"TCDB / Parse",ok:catalog.ok,error:catalog.error??null,candidates:catalog.identities},market:{merged:ms,sourceAgreement:agreement,disagreementPct:diff==null?null:Math.round(diff*10)/10,sources:{soldComps:{ok:sold.ok,error:sold.error??null,rawCount:sold.sales.length,rejected:sold.sales.length-soldAccepted.length,...ss},cardApi:{ok:card.ok,error:card.error??null,rawCount:card.sales.length,rejected:card.sales.length-cardAccepted.length,...cs}},sales:merged.slice(0,40)}});
}
