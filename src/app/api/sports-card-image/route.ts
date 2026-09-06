import { NextRequest, NextResponse } from "next/server";

type AnyRecord = Record<string, unknown>;
function obj(v: unknown): AnyRecord { return v && typeof v === "object" && !Array.isArray(v) ? v as AnyRecord : {}; }
function text(v: unknown) { return v == null ? "" : String(v).trim(); }
function normalize(v: string) { return v.toLowerCase().replace(/[^a-z0-9#/.+-]+/g," ").replace(/\s+/g," ").trim(); }
function imageFrom(row: AnyRecord) {
  const card = obj(row.card && typeof row.card === "object" ? row.card : row);
  const image = obj(card.image ?? row.image);
  const images = obj(card.images ?? row.images);
  const candidates = [
    card.imageUrl, card.image_url, card.frontImage, card.front_image, card.thumbnail, card.thumbnailUrl, card.thumbnail_url,
    image.url, image.large, image.medium, image.small, image.front,
    images.front, images.large, images.medium, images.small,
    row.imageUrl, row.image_url, row.front_image, row.thumbnail, row.thumbnail_url,
  ];
  return candidates.map(text).find(v=>/^https?:\/\//i.test(v)) || "";
}
function collect(payload: AnyRecord) {
  const out: AnyRecord[]=[]; const seen=new Set<unknown>();
  const visit=(value:unknown,depth=0)=>{if(depth>5||value==null||seen.has(value))return;if(typeof value==="object")seen.add(value);if(Array.isArray(value)){value.forEach(v=>visit(v,depth+1));return}if(!value||typeof value!=="object")return;const row=value as AnyRecord;const im=imageFrom(row);if(im)out.push(row);for(const [k,v] of Object.entries(row)){if(["metadata","pagination","facets","stats"].includes(k))continue;visit(v,depth+1)}};
  visit(payload); return out;
}
function label(row:AnyRecord){const c=obj(row.card&&typeof row.card==="object"?row.card:row);return normalize([c.playerName,c.player_name,c.subject,c.name,c.year,c.releaseName,c.release_name,c.setName,c.set_name,c.number,c.cardNumber,c.card_number,c.parallelName,c.parallel_name].map(text).filter(Boolean).join(" "))}
function score(q:string,row:AnyRecord){const qq=normalize(q),hay=label(row),tokens=qq.split(" ").filter(x=>x.length>1);return tokens.reduce((s,t)=>s+(hay.includes(t)?10:0),0)+(hay.includes(qq)?50:0)}

export async function GET(request: NextRequest){
  const q=new URL(request.url).searchParams.get("q")?.trim()||"";
  if(q.length<3)return NextResponse.json({ok:true,imageUrl:"",source:"none"});
  const key=process.env.CARDSIGHT_API_KEY?.trim()||"";
  if(key){
    const headers={Accept:"application/json","X-API-Key":key};
    for(const url of [`https://api.cardsight.ai/v1/catalog/search?q=${encodeURIComponent(q)}&limit=20`,`https://api.cardsight.ai/v1/catalog/cards?q=${encodeURIComponent(q)}&limit=20`]){
      try{const r=await fetch(url,{headers,cache:"no-store"});if(!r.ok)continue;const p=await r.json() as AnyRecord;const rows=collect(p).sort((a,b)=>score(q,b)-score(q,a));const imageUrl=rows.map(imageFrom).find(Boolean)||"";if(imageUrl)return NextResponse.json({ok:true,imageUrl,source:"CardSight"})}catch{}
    }
  }
  const parseKey=process.env.PARSE_API_KEY?.trim()||"";
  if(parseKey){
    try{const qs=new URLSearchParams({query:q});const r=await fetch(`https://api.parse.bot/scraper/123aeda8-4611-4871-a592-2109a3f6434f/search_cards?${qs.toString()}`,{headers:{Accept:"application/json","X-API-Key":parseKey},cache:"no-store"});if(r.ok){const p=await r.json() as AnyRecord;const root=Object.keys(obj(p.data)).length?obj(p.data):p;const rows=(Array.isArray(root.results)?root.results:Array.isArray(root.cards)?root.cards:[]) as AnyRecord[];const imageUrl=rows.map(imageFrom).find(Boolean)||"";if(imageUrl)return NextResponse.json({ok:true,imageUrl,source:"TCDB"})}}catch{}
  }
  return NextResponse.json({ok:true,imageUrl:"",source:"none"});
}
