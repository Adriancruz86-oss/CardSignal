import { NextRequest, NextResponse } from "next/server";

type Tone="positive"|"negative"|"watch"|"neutral";
type CatalystArticle={title:string;url:string;domain:string;publishedAt:string;category:string;tone:Tone;impact:number};

const NEG=["injury","injured","surgery","out for","disabled","il ","suspension","suspended","arrest","waived","released","demoted","optioned"];
const POS=["promoted","call-up","called up","recalled","activated","returns","returning","record","award","mvp","rookie of the","all-star","extension","contract","starting","named starter","playoff","championship"];
const WATCH=["trade","traded","rumor","rumour","deadline","free agent","free agency","prospect","debut","rotation","lineup"];

function classify(title:string){
 const t=` ${title.toLowerCase()} `;
 const neg=NEG.find(k=>t.includes(k));
 const pos=POS.find(k=>t.includes(k));
 const watch=WATCH.find(k=>t.includes(k));
 if(neg)return{category:neg.includes("injur")||neg.includes("surgery")||neg.includes("out for")?"INJURY / AVAILABILITY":"NEGATIVE EVENT",tone:"negative" as Tone,impact:90};
 if(pos)return{category:pos.includes("promot")||pos.includes("call")||pos.includes("recalled")?"CALL-UP / ROLE":"POSITIVE CATALYST",tone:"positive" as Tone,impact:75};
 if(watch)return{category:watch.includes("trade")||watch.includes("rum")?"TRADE WATCH":"ROLE / MARKET WATCH",tone:"watch" as Tone,impact:60};
 return{category:"PLAYER NEWS",tone:"neutral" as Tone,impact:35};
}

function safeDate(v:unknown){
 if(typeof v!=="string"||!v)return"";
 const compact=v.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
 if(compact){const[,y,m,d,h="00",mi="00",s="00"]=compact;const iso=`${y}-${m}-${d}T${h}:${mi}:${s}Z`;const dt=new Date(iso);if(!Number.isNaN(dt.getTime()))return dt.toISOString();}
 const dt=new Date(v);return Number.isNaN(dt.getTime())?"":dt.toISOString();
}

async function gdelt(player:string,withCatalysts=true){
 const phrase=`\"${player.replace(/\"/g,"")}\"`;
 const catalyst="(injury OR injured OR trade OR traded OR promoted OR recalled OR activated OR suspension OR contract OR record OR award OR playoff OR debut OR lineup)";
 const q=withCatalysts?`${phrase} ${catalyst}`:phrase;
 const u=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
 u.searchParams.set("query",q);u.searchParams.set("mode","artlist");u.searchParams.set("format","json");u.searchParams.set("maxrecords","20");u.searchParams.set("timespan","7d");u.searchParams.set("sort","datedesc");
 const r=await fetch(u,{headers:{"User-Agent":"CardSignal/0.1 catalyst-monitor"},next:{revalidate:900}});
 if(!r.ok)throw new Error(`News source returned ${r.status}`);
 const j=await r.json() as {articles?:Array<Record<string,unknown>>};
 return Array.isArray(j.articles)?j.articles:[];
}

export async function GET(req:NextRequest){
 const player=(req.nextUrl.searchParams.get("player")||"").trim();
 if(!player)return NextResponse.json({ok:false,error:"player is required"},{status:400});
 try{
  let raw=await gdelt(player,true);if(!raw.length)raw=await gdelt(player,false);
  const seen=new Set<string>();const articles:CatalystArticle[]=[];
  for(const a of raw){
   const title=String(a.title||"").trim(),url=String(a.url||"").trim();if(!title||!url)continue;
   const key=title.toLowerCase().replace(/\s+/g," ");if(seen.has(key))continue;seen.add(key);
   const c=classify(title);articles.push({title,url,domain:String(a.domain||"News source"),publishedAt:safeDate(a.seendate||a.date),category:c.category,tone:c.tone,impact:c.impact});
  }
  articles.sort((a,b)=>b.impact-a.impact||new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime());
  return NextResponse.json({ok:true,player,fetchedAt:new Date().toISOString(),articles:articles.slice(0,12),source:"GDELT DOC 2.0"});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:"Catalyst search failed"},{status:502});}
}
