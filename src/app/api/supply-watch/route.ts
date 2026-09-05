import { NextRequest, NextResponse } from "next/server";

type Canonical = { player:string; year:string; setName:string; cardNumber:string; variant:string };
type EbayItem = { itemId?:string; title?:string; price?:{value?:string;currency?:string}; itemWebUrl?:string; condition?:string; buyingOptions?:string[] };
type Listing = { id:string; title:string; price:number|null; currency:string; url:string; condition:string; buyingOptions:string[] };

const VARIANTS=["logofractor","refractor","x-fractor","xfractor","superfractor","cosmic chrome","cosmic","sapphire","silver","holo","hyper","wave","shimmer","cracked ice","ice","scope","mojo","sepia","negative","pink","purple","blue","green","red","orange","gold","black","aqua","raywave","ray wave"];
let tokenCache:{token:string;expiresAt:number}|null=null;

function normalize(v:string){return v.toLowerCase().replace(/[–—]/g,"-").replace(/[^a-z0-9#/.+-]+/g," ").replace(/\s+/g," ").trim()}
function phraseIn(text:string,phrase:string){return ` ${normalize(text)} `.includes(` ${normalize(phrase)} `)}
function extractNumber(t:string){return normalize(t).match(/#\s*([a-z0-9-]+)/)?.[1]??""}
function num(v:unknown){const n=Number.parseFloat(String(v??""));return Number.isFinite(n)?n:null}
function median(v:number[]){if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function matches(c:Canonical,title:string){const t=normalize(title);const pt=normalize(c.player).split(" ").filter(x=>x.length>1);if(pt.length&&!pt.every(x=>t.includes(x)))return false;if(c.year){const y=t.match(/\b((?:19|20)\d{2})\b/)?.[1]??"";if(y&&y!==c.year.slice(0,4))return false}if(c.setName&&!phraseIn(t,c.setName))return false;if(c.cardNumber){const n=extractNumber(t);if(n&&normalize(n)!==normalize(c.cardNumber))return false}if(c.variant&&!phraseIn(t,c.variant))return false;if(!c.variant&&VARIANTS.some(v=>phraseIn(title,v)))return false;return true}

async function getToken(){
  const clientId=process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret=process.env.EBAY_CLIENT_SECRET?.trim();
  if(!clientId||!clientSecret)throw new Error("eBay Browse is not configured. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to .env.local.");
  if(tokenCache&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.token;
  const basic=Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body=new URLSearchParams({grant_type:"client_credentials",scope:"https://api.ebay.com/oauth/api_scope"});
  const r=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{method:"POST",headers:{Authorization:`Basic ${basic}`,"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  const text=await r.text();let j:Record<string,unknown>={};try{j=JSON.parse(text)}catch{}
  if(!r.ok)throw new Error(String(j.error_description??j.error??text.slice(0,220)??`eBay OAuth HTTP ${r.status}`));
  const token=String(j.access_token??"");const expires=Number(j.expires_in??7200);if(!token)throw new Error("eBay OAuth returned no access token.");
  tokenCache={token,expiresAt:Date.now()+Math.max(300,expires)*1000};return token;
}

export async function GET(request:NextRequest){
  const sp=new URL(request.url).searchParams;
  const c:Canonical={player:sp.get("player")?.trim()??"",year:sp.get("year")?.trim()??"",setName:sp.get("set")?.trim()??"",cardNumber:sp.get("cardNumber")?.trim()??"",variant:sp.get("variant")?.trim()??""};
  if(!c.player)return NextResponse.json({ok:false,error:"Player is required"},{status:400});
  const query=[c.player,c.year,c.setName,c.cardNumber?`#${c.cardNumber}`:"",c.variant].filter(Boolean).join(" ");
  try{
    const token=await getToken();
    const qs=new URLSearchParams({q:query,limit:"200",filter:"buyingOptions:{FIXED_PRICE|AUCTION}"});
    const r=await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${qs.toString()}`,{headers:{Authorization:`Bearer ${token}`,"X-EBAY-C-MARKETPLACE-ID":"EBAY_US",Accept:"application/json"},cache:"no-store"});
    const text=await r.text();let j:Record<string,unknown>={};try{j=JSON.parse(text)}catch{}
    if(!r.ok)return NextResponse.json({ok:false,error:String(j.errors??j.message??text.slice(0,240)??`eBay Browse HTTP ${r.status}`)},{status:r.status});
    const rows=Array.isArray(j.itemSummaries)?j.itemSummaries as EbayItem[]:[];
    const raw:Listing[]=rows.map(item=>({id:String(item.itemId??""),title:String(item.title??""),price:num(item.price?.value),currency:String(item.price?.currency??"USD"),url:String(item.itemWebUrl??""),condition:String(item.condition??""),buyingOptions:Array.isArray(item.buyingOptions)?item.buyingOptions:[]}));
    const accepted=raw.filter(item=>matches(c,item.title));
    const prices=accepted.map(x=>x.price).filter((v):v is number=>v!=null&&v>0);
    return NextResponse.json({ok:true,provider:"eBay Browse API",query,scannedAt:new Date().toISOString(),rawTotal:Number(j.total??raw.length),fetchedCount:raw.length,acceptedCount:accepted.length,rejectedCount:raw.length-accepted.length,lowestAsk:prices.length?Math.min(...prices):null,medianAsk:median(prices),highestAsk:prices.length?Math.max(...prices):null,listings:accepted.slice(0,20)});
  }catch(e){const message=e instanceof Error?e.message:"Supply scan failed";return NextResponse.json({ok:false,configured:!message.includes("not configured"),error:message},{status:message.includes("not configured")?503:500});}
}
