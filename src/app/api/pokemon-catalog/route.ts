import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.tcgdex.net/v2";
const LANGS = new Set(["en","fr","es","de","it","pt-br","ja","zh-tw","id","th"]);

type Brief = { id?:string; localId?:string; name?:string; image?:string };
type CardDetail = {
  id?:string; localId?:string; name?:string; image?:string; rarity?:string;
  set?:{id?:string;name?:string;cardCount?:{official?:number;total?:number}};
  variants?:Record<string,boolean|number|string|null|undefined>;
};

function text(v:unknown){return v==null?"":String(v).trim()}
function norm(v:unknown){return text(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function safeLang(v:string){const s=v.toLowerCase();return LANGS.has(s)?s:"en"}
function variantLabel(v?:Record<string,unknown>){
  if(!v)return"";
  const labels:string[]=[];
  for(const [k,val] of Object.entries(v)){
    if(val!==true)continue;
    const label=k.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").trim();
    if(label)labels.push(label.replace(/\b\w/g,m=>m.toUpperCase()));
  }
  return labels.join(" / ");
}

async function getJson(url:string){
  const r=await fetch(url,{cache:"no-store",headers:{"User-Agent":"CardSignal/0.1 PokemonCatalog"}});
  if(!r.ok)throw new Error(`TCGdex HTTP ${r.status}`);
  return await r.json();
}

export async function GET(request:NextRequest){
  const u=new URL(request.url);
  const name=text(u.searchParams.get("name"));
  const recognizedSet=text(u.searchParams.get("set"));
  const recognizedNumber=text(u.searchParams.get("number")).replace(/^#/,"").split("/")[0];
  const lang=safeLang(text(u.searchParams.get("lang"))||"en");
  if(name.length<2)return NextResponse.json({ok:false,error:"Pokémon/card name is required"},{status:400});
  try{
    const params=new URLSearchParams();
    params.set("name",name);
    params.set("pagination:page","1");
    params.set("pagination:itemsPerPage","60");
    const briefs=await getJson(`${BASE}/${lang}/cards?${params.toString()}`) as Brief[];
    const exactName=(Array.isArray(briefs)?briefs:[]).filter(b=>norm(b.name)===norm(name));
    const pool=(exactName.length?exactName:briefs||[]).slice(0,36);
    const details=await Promise.all(pool.map(async b=>{
      try{return await getJson(`${BASE}/${lang}/cards/${encodeURIComponent(text(b.id))}`) as CardDetail}catch{return null}
    }));
    const candidates=details.filter((c):c is CardDetail=>Boolean(c?.id)).map(c=>{
      const official=Number(c.set?.cardCount?.official||0)||null;
      const total=Number(c.set?.cardCount?.total||0)||null;
      const local=text(c.localId);
      const fullNumber=official?`${local}/${official}`:local;
      let score=0;
      if(norm(c.name)===norm(name))score+=50;
      if(recognizedSet&&norm(c.set?.name)===norm(recognizedSet))score+=28;
      if(recognizedNumber&&norm(local)===norm(recognizedNumber))score+=24;
      return {id:text(c.id),name:text(c.name),setName:text(c.set?.name),setId:text(c.set?.id),localId:local,number:fullNumber,officialCount:official,totalCount:total,rarity:text(c.rarity),variant:variantLabel(c.variants as Record<string,unknown>|undefined),image:text(c.image),score};
    }).sort((a,b)=>b.score-a.score||a.setName.localeCompare(b.setName)||a.localId.localeCompare(b.localId,undefined,{numeric:true}));
    return NextResponse.json({ok:true,source:"TCGdex",language:lang,count:candidates.length,candidates:candidates.slice(0,30)});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Pokémon catalog lookup failed"},{status:502});
  }
}
