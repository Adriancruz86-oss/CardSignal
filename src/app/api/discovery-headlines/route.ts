import { NextResponse } from "next/server";

type Tone="positive"|"negative"|"watch"|"neutral";
type Headline={title:string;url:string;domain:string;publishedAt:string;category:string;tone:Tone;impact:number};

const NEG=["injury","injured","surgery","out for","disabled","suspension","suspended","arrest","waived","released","demoted","optioned"];
const POS=["promoted","call-up","called up","recalled","activated","returns","returning","record","award","mvp","rookie of the","all-star","extension","contract","starting","named starter","playoff","championship","career high","breakout"];
const WATCH=["trade","traded","rumor","rumour","deadline","free agent","free agency","prospect","debut","rotation","lineup"];

function classify(title:string){const t=` ${title.toLowerCase()} `;const neg=NEG.find(k=>t.includes(k));const pos=POS.find(k=>t.includes(k));const watch=WATCH.find(k=>t.includes(k));if(neg)return{category:neg.includes("injur")||neg.includes("surgery")||neg.includes("out for")?"INJURY / AVAILABILITY":"NEGATIVE EVENT",tone:"negative" as Tone,impact:90};if(pos)return{category:pos.includes("promot")||pos.includes("call")||pos.includes("recalled")?"CALL-UP / ROLE":"POSITIVE CATALYST",tone:"positive" as Tone,impact:80};if(watch)return{category:watch.includes("trade")||watch.includes("rum")?"TRADE WATCH":"ROLE / MARKET WATCH",tone:"watch" as Tone,impact:65};return{category:"PLAYER NEWS",tone:"neutral" as Tone,impact:35}}
function safeDate(v:unknown){if(typeof v!=="string"||!v)return"";const compact=v.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);if(compact){const[,y,m,d,h="00",mi="00",s="00"]=compact;const dt=new Date(`${y}-${m}-${d}T${h}:${mi}:${s}Z`);if(!Number.isNaN(dt.getTime()))return dt.toISOString()}const dt=new Date(v);return Number.isNaN(dt.getTime())?"":dt.toISOString()}

export async function GET(){
 try{
  const q='(injury OR injured OR traded OR trade OR promoted OR recalled OR activated OR award OR mvp OR record OR playoff OR debut OR breakout) (NBA OR WNBA OR NFL OR MLB OR NHL OR basketball OR football OR baseball OR hockey)';
  const u=new URL("https://api.gdeltproject.org/api/v2/doc/doc");u.searchParams.set("query",q);u.searchParams.set("mode","artlist");u.searchParams.set("format","json");u.searchParams.set("maxrecords","50");u.searchParams.set("timespan","24h");u.searchParams.set("sort","datedesc");
  const r=await fetch(u,{headers:{"User-Agent":"CardSignal/0.1 market-discovery"},next:{revalidate:600}});if(!r.ok)throw new Error(`News source returned ${r.status}`);
  const j=await r.json() as {articles?:Array<Record<string,unknown>>};const seen=new Set<string>();const out:Headline[]=[];
  for(const a of Array.isArray(j.articles)?j.articles:[]){const title=String(a.title||"").trim(),url=String(a.url||"").trim();if(!title||!url)continue;const k=title.toLowerCase().replace(/\s+/g," ");if(seen.has(k))continue;seen.add(k);const c=classify(title);if(c.impact<60)continue;out.push({title,url,domain:String(a.domain||"News source"),publishedAt:safeDate(a.seendate||a.date),category:c.category,tone:c.tone,impact:c.impact})}
  out.sort((a,b)=>b.impact-a.impact||new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime());
  return NextResponse.json({ok:true,fetchedAt:new Date().toISOString(),headlines:out.slice(0,30),source:"GDELT DOC 2.0"});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Market headline scan failed"},{status:502})}
}
