export type CatalystTone="positive"|"negative"|"watch"|"neutral";
export type CatalystArticle={title:string;url:string;domain?:string;publishedAt?:string;category?:string;tone:CatalystTone;impact:number};
export type CatalystCacheResult={player:string;fetchedAt:string;articles:CatalystArticle[]};
export type CatalystEvent={id:string;player:string;title:string;url:string;domain?:string;publishedAt?:string;firstSeenAt:string;lastSeenAt:string;category?:string;tone:CatalystTone;impact:number};
export const CATALYST_HISTORY_KEY="cardsignal-catalyst-history";

export function readCatalystHistory():CatalystEvent[]{if(typeof window==="undefined")return[];try{const v=JSON.parse(localStorage.getItem(CATALYST_HISTORY_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
export function writeCatalystHistory(rows:CatalystEvent[]){localStorage.setItem(CATALYST_HISTORY_KEY,JSON.stringify(rows.slice(0,5000)));window.dispatchEvent(new Event("cardsignal:catalyst-history-changed"));}
function key(player:string,a:CatalystArticle){return `${player.toLowerCase()}|${a.url||a.title.toLowerCase()}`}
export function mergeCatalystCache(cache:Record<string,CatalystCacheResult>,existing:CatalystEvent[]=readCatalystHistory()){
 const map=new Map(existing.map(x=>[key(x.player,x),x]));let changed=false;const now=new Date().toISOString();
 for(const result of Object.values(cache||{})){for(const a of result?.articles||[]){const k=key(result.player,a),prev=map.get(k);if(prev){const next={...prev,lastSeenAt:result.fetchedAt||now,impact:Math.max(prev.impact||0,a.impact||0),tone:a.tone||prev.tone,category:a.category||prev.category,publishedAt:a.publishedAt||prev.publishedAt};if(JSON.stringify(next)!==JSON.stringify(prev)){map.set(k,next);changed=true}}else{map.set(k,{id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,player:result.player,title:a.title,url:a.url,domain:a.domain,publishedAt:a.publishedAt,firstSeenAt:result.fetchedAt||now,lastSeenAt:result.fetchedAt||now,category:a.category,tone:a.tone,impact:Number(a.impact||0)});changed=true}}}
 const rows=[...map.values()].sort((a,b)=>new Date(b.firstSeenAt).getTime()-new Date(a.firstSeenAt).getTime());if(changed)writeCatalystHistory(rows);return rows;
}
