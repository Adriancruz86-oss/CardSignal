"use client";

import {useEffect,useMemo,useState} from "react";

type RawCard=Record<string,any>;
type Card={
 id:number;player:string;meta:string;mode:"owned"|"watching";marketValue:number;purchasePrice?:number;image?:string;
 change7d:number|null;acceptedCount:number;confidence:string;
};
const KEY="cardsignal-added-cards";
function num(v:any,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function readCards():Card[]{
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(raw))return[];
  return raw.map((c:RawCard,i:number)=>({
   id:num(c.id,Date.now()+i),player:String(c.player||c.playerName||"Unknown card"),meta:String(c.meta||[c.year,c.setName,c.cardNumber&&`#${c.cardNumber}`,c.variant].filter(Boolean).join(" · ")||"No metadata"),
   mode:c.mode==="owned"?"owned":"watching",marketValue:num(c.marketValue),purchasePrice:c.purchasePrice===undefined||c.purchasePrice===""?undefined:num(c.purchasePrice),image:typeof c.image==="string"?c.image:undefined,
   change7d:c.marketScan?.change7d==null?null:num(c.marketScan.change7d),acceptedCount:num(c.marketScan?.acceptedCount),confidence:String(c.marketScan?.confidence||"NO SCAN")
  }));
 }catch{return[]}
}
function save(cards:Card[]){localStorage.setItem(KEY,JSON.stringify(cards));window.dispatchEvent(new Event("cardsignal:user-cards-changed"))}
function initials(name:string){return name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()}

export default function SafePortfolioLayer(){
 const[cards,setCards]=useState<Card[]>([]),[open,setOpen]=useState(false),[tab,setTab]=useState<"owned"|"watching">("owned"),[q,setQ]=useState("");
 const refresh=()=>setCards(readCards());
 useEffect(()=>{refresh();const click=(e:MouseEvent)=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>(".nav-tabs button");if(b?.textContent?.trim()==="Portfolio"){e.preventDefault();setTab("owned");refresh();setOpen(true)}};document.addEventListener("click",click,true);const changed=()=>refresh();window.addEventListener("cardsignal:user-cards-changed",changed);return()=>{document.removeEventListener("click",click,true);window.removeEventListener("cardsignal:user-cards-changed",changed)}},[]);
 useEffect(()=>{if(!open)return;const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};window.addEventListener("keydown",esc);return()=>window.removeEventListener("keydown",esc)},[open]);
 const owned=useMemo(()=>cards.filter(c=>c.mode==="owned"),[cards]),watching=useMemo(()=>cards.filter(c=>c.mode==="watching"),[cards]);
 const shown=useMemo(()=>{const needle=q.trim().toLowerCase();return (tab==="owned"?owned:watching).filter(c=>!needle||`${c.player} ${c.meta}`.toLowerCase().includes(needle))},[tab,owned,watching,q]);
 const total=owned.reduce((s,c)=>s+c.marketValue,0),cost=owned.reduce((s,c)=>s+(c.purchasePrice||0),0);
 const move=(id:number,mode:"owned"|"watching")=>{const raw=readCards().map(c=>c.id===id?{...c,mode}:c);save(raw);setCards(raw)};
 const remove=(id:number)=>{const c=cards.find(x=>x.id===id);if(!c||!window.confirm(`Remove ${c.player} from CardSignal?`))return;const next=cards.filter(x=>x.id!==id);save(next);setCards(next)};
 if(!open)return null;
 return <div className="cs-safe-portfolio-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}>
  <section className="cs-safe-portfolio" role="dialog" aria-modal="true" aria-label="Portfolio">
   <button className="close" onClick={()=>setOpen(false)}>×</button>
   <header><div><span>MY CARDS</span><h2>Portfolio & Watchlist</h2><p>Stable portfolio view while the advanced workbench is being rebuilt.</p></div><button className="add" onClick={()=>{setOpen(false);setTimeout(()=>document.querySelector<HTMLButtonElement>(".add-card")?.click(),60)}}>＋ ADD CARD</button></header>
   <div className="stats"><div><small>OWNED VALUE</small><b>${total.toFixed(2)}</b></div><div><small>COST BASIS</small><b>${cost.toFixed(2)}</b></div><div><small>GAIN / LOSS</small><b>{total-cost>=0?"+":"-"}${Math.abs(total-cost).toFixed(2)}</b></div><div><small>WATCHING</small><b>{watching.length}</b></div></div>
   <div className="tabs"><button className={tab==="owned"?"active":""} onClick={()=>setTab("owned")}>OWNED {owned.length}</button><button className={tab==="watching"?"active":""} onClick={()=>setTab("watching")}>WATCHING {watching.length}</button></div>
   <input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search player, set, card #…"/>
   <div className="list">{shown.length===0?<div className="empty">No cards match this view.</div>:shown.map(c=><article key={c.id} className="cs-portfolio-card" data-user-card-id={c.id}>
    <div className="art">{c.image?<img src={c.image} alt={c.player}/>:<span>{initials(c.player)}</span>}</div><div className="copy"><strong>{c.player}</strong><span>{c.meta}</span><small>{c.acceptedCount?`${c.acceptedCount} accepted · ${c.confidence}`:c.mode==="owned"&&c.purchasePrice!=null?`Paid $${c.purchasePrice.toFixed(2)}`:"Not scanned yet"}</small></div>
    <div className="market"><small>MARKET</small><strong>${c.marketValue.toFixed(2)}</strong><span>{c.change7d==null?"—":`${c.change7d>=0?"+":""}${c.change7d.toFixed(1)}% 7D`}</span></div>
    <div className="actions"><button onClick={()=>move(c.id,c.mode==="owned"?"watching":"owned")}>{c.mode==="owned"?"MOVE TO WATCHLIST":"MARK AS OWNED"}</button><button className="danger" onClick={()=>remove(c.id)}>REMOVE</button></div>
   </article>)}</div>
  </section>
  <style jsx global>{`.cs-safe-portfolio-backdrop{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:22px;background:rgba(0,7,12,.94)}.cs-safe-portfolio{position:relative;width:min(1080px,96vw);max-height:92vh;overflow:auto;padding:28px;border:1px solid rgba(74,205,255,.22);border-radius:18px;background:#061522;color:#effaff}.cs-safe-portfolio .close{position:absolute;right:16px;top:14px;width:34px;height:34px;border:1px solid rgba(100,189,225,.16);border-radius:8px;background:#071724;color:#9ab7c4;font-size:24px;cursor:pointer}.cs-safe-portfolio header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding-right:44px}.cs-safe-portfolio header span{color:#5ee0ff;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-safe-portfolio h2{margin:6px 0 4px;font-size:28px}.cs-safe-portfolio p{margin:0;color:#7592a1;font-size:11px}.cs-safe-portfolio .add{height:38px;padding:0 14px;border:1px solid rgba(70,235,150,.35);border-radius:8px;background:#0a241b;color:#91f5b8;font-size:9px;font-weight:900;cursor:pointer}.cs-safe-portfolio .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:20px 0 14px}.cs-safe-portfolio .stats>div{padding:13px;border:1px solid rgba(76,188,229,.12);border-radius:9px;background:#081b29}.cs-safe-portfolio .stats small,.cs-safe-portfolio .market small{display:block;color:#678897;font-size:7px;font-weight:900;letter-spacing:.1em}.cs-safe-portfolio .stats b{display:block;margin-top:7px;font-size:19px}.cs-safe-portfolio .tabs{display:flex;gap:6px;margin-bottom:10px}.cs-safe-portfolio .tabs button{height:34px;padding:0 12px;border:1px solid rgba(80,190,225,.12);border-radius:7px;background:#071724;color:#7898a8;font-size:8px;font-weight:900;cursor:pointer}.cs-safe-portfolio .tabs button.active{color:#8ff4bd;border-color:rgba(80,235,155,.28)}.cs-safe-portfolio .search{width:100%;height:38px;padding:0 11px;margin-bottom:10px;border:1px solid rgba(78,190,232,.16);border-radius:8px;background:#071724;color:#d9edf5;outline:none}.cs-safe-portfolio .list{display:flex;flex-direction:column;gap:8px}.cs-safe-portfolio .empty{padding:35px;text-align:center;color:#708d9a}.cs-safe-portfolio .cs-portfolio-card{display:grid;grid-template-columns:58px minmax(240px,1fr) 120px 190px;gap:12px;align-items:center;padding:11px;border:1px solid rgba(78,188,226,.11);border-radius:9px;background:#071825}.cs-safe-portfolio .art{width:50px;height:68px;border-radius:6px;overflow:hidden;display:grid;place-items:center;background:#0d2432;color:#75a6b8;font-weight:900}.cs-safe-portfolio .art img{width:100%;height:100%;object-fit:cover}.cs-safe-portfolio .copy strong,.cs-safe-portfolio .copy span,.cs-safe-portfolio .copy small{display:block}.cs-safe-portfolio .copy span{margin-top:3px;color:#90a8b3;font-size:9px}.cs-safe-portfolio .copy small{margin-top:4px;color:#657f8b;font-size:8px}.cs-safe-portfolio .market strong{display:block;margin-top:5px;font-size:17px}.cs-safe-portfolio .market span{font-size:8px;color:#83c8a0}.cs-safe-portfolio .actions{display:flex;gap:6px;justify-content:flex-end}.cs-safe-portfolio .actions button{height:30px;padding:0 8px;border:1px solid rgba(80,188,225,.15);border-radius:6px;background:#071724;color:#8eb0c0;font-size:7px;font-weight:900;cursor:pointer}.cs-safe-portfolio .actions .danger{color:#ff94a0}@media(max-width:760px){.cs-safe-portfolio .stats{grid-template-columns:1fr 1fr}.cs-safe-portfolio .cs-portfolio-card{grid-template-columns:50px 1fr}.cs-safe-portfolio .market,.cs-safe-portfolio .actions{grid-column:2}.cs-safe-portfolio header{display:block}.cs-safe-portfolio .add{margin-top:10px}}`}</style>
 </div>;
}
