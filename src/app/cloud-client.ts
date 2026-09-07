"use client";

export type CloudUser={id:string;email:string;username:string};
export type CloudSession={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};

const URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/$/,"");
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"";
const SESSION_KEY="cardsignal-cloud-session";

export function cloudConfigured(){return Boolean(URL&&KEY)}
function headers(token?:string){return{apikey:KEY,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})}}
function saveSession(s:CloudSession|null){if(typeof window==="undefined")return;if(s)localStorage.setItem(SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(SESSION_KEY)}
export function readSession():CloudSession|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{return null}}

async function auth(path:string,body?:unknown,token?:string){
 const r=await fetch(`${URL}/auth/v1/${path}`,{method:body?"POST":"GET",headers:headers(token),body:body?JSON.stringify(body):undefined,cache:"no-store"});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(j?.msg||j?.error_description||j?.message||"Authentication failed"));return j;
}
export async function signUp(email:string,password:string,username:string){const j=await auth("signup",{email,password,data:{username}});if(j.access_token)saveSession(j as CloudSession);return j}
export async function signIn(email:string,password:string){const j=await auth("token?grant_type=password",{email,password}) as CloudSession;saveSession(j);return j}
export async function signOut(){const s=readSession();try{if(s)await auth("logout",{},s.access_token)}catch{}saveSession(null)}
export async function refreshSession(){const s=readSession();if(!s)return null;if(s.expires_at*1000>Date.now()+60000)return s;const j=await auth("token?grant_type=refresh_token",{refresh_token:s.refresh_token}) as CloudSession;saveSession(j);return j}

async function rest(path:string,opts:{method?:string;body?:unknown;token:string;prefer?:string}):Promise<any>{
 const r=await fetch(`${URL}/rest/v1/${path}`,{method:opts.method||"GET",headers:{...headers(opts.token),...(opts.prefer?{Prefer:opts.prefer}:{})},body:opts.body?JSON.stringify(opts.body):undefined,cache:"no-store"});
 const text=await r.text();const j=text?JSON.parse(text):null;if(!r.ok)throw new Error(String(j?.message||j?.hint||`Cloud request failed (${r.status})`));return j;
}
export async function getProfile(token:string,userId:string){const rows=await rest(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,email`,{token});return Array.isArray(rows)?rows[0]||null:null}
export async function ensureProfile(token:string,user:{id:string;email?:string},username?:string){const current=await getProfile(token,user.id);if(current)return current;const row={id:user.id,email:user.email||"",username:(username||user.email?.split("@")[0]||"collector").slice(0,32)};const rows=await rest("profiles?on_conflict=id",{method:"POST",body:row,token,prefer:"resolution=merge-duplicates,return=representation"});return Array.isArray(rows)?rows[0]||row:row}
export async function readCloudState(token:string){const rows=await rest("user_state?select=payload,updated_at&limit=1",{token});return Array.isArray(rows)?rows[0]||null:null}
export async function writeCloudState(token:string,userId:string,payload:Record<string,unknown>){return rest("user_state?on_conflict=user_id",{method:"POST",body:{user_id:userId,payload,updated_at:new Date().toISOString()},token,prefer:"resolution=merge-duplicates,return=minimal"})}

export async function readCardIntelligence(token:string,cardId:number){
 const id=encodeURIComponent(String(cardId));
 const [snapshots,news,signals]=await Promise.all([
  rest(`market_snapshots?client_card_id=eq.${id}&select=id,scanned_at,accepted_count,rejected_count,current_median,change_7d,recent_sales,velocity,pulse,confidence,source_status&order=scanned_at.desc&limit=20`,{token}),
  rest(`news_events?client_card_id=eq.${id}&select=id,title,url,domain,published_at,first_seen_at,last_seen_at,category,tone,impact,provider&order=published_at.desc.nullslast&limit=30`,{token}),
  rest(`signal_events?client_card_id=eq.${id}&select=id,created_at,signal_type,confidence,score,explanation,evidence&order=created_at.desc&limit=20`,{token}),
 ]);
 return{snapshots:Array.isArray(snapshots)?snapshots:[],news:Array.isArray(news)?news:[],signals:Array.isArray(signals)?signals:[]};
}
