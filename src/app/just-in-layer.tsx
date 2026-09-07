"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { refreshSession } from "./cloud-client";
import "./just-in.css";

type Action={type:string;label:string;cardId?:number|null;confirmationRequired:boolean;reason:string};
type Reply={title:string;answer:string;observations:string[];evidenceQuality:"STRONG"|"MIXED"|"LIMITED"|"MISSING";proposedActions:Action[]};
type Message={id:string;role:"user"|"assistant";text:string;reply?:Reply};
const SUGGESTIONS=["Which cards need my attention today?","Explain my strongest buy and sell signals.","Which cards need better data or a fresh scan?","How should I organize this collection?"];

function currentCard(){return Number(document.querySelector<HTMLElement>(".cs-detail-modal")?.dataset.userCardId||0)||undefined}
function runAction(action:Action){
 if(action.cardId&&["OPEN_CARD","RESCAN_CARD"].includes(action.type)){window.dispatchEvent(new CustomEvent("cardsignal:open-card-detail",{detail:{cardId:action.cardId}}));return}
 const selector:Record<string,string>={OPEN_PORTFOLIO:".portfolio-btn",OPEN_WATCHLIST:".nav-tabs button:nth-child(4)",OPEN_BUY_SIGNALS:".stat-card:nth-child(3)",OPEN_SELL_RISKS:".stat-card:nth-child(4)",OPEN_CATALYSTS:".cs-catalyst-launch",ORGANIZE_COLLECTION:".cs-organizer-launch"};
 document.querySelector<HTMLButtonElement>(selector[action.type]||"")?.click();
}

export default function JustInLayer(){
 const[ready,setReady]=useState(false),[open,setOpen]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const end=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{setReady(true);const h=()=>setOpen(true);window.addEventListener("cardsignal:open-just-in",h);return()=>window.removeEventListener("cardsignal:open-just-in",h)},[]);
 useEffect(()=>{if(open)fetch("/api/copilot",{cache:"no-store"}).then(r=>r.json()).then(j=>setConfigured(Boolean(j.configured))).catch(()=>setConfigured(false))},[open]);
 useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,busy]);
 const ask=async(preset?:string)=>{const question=(preset||input).trim();if(!question||busy)return;setBusy(true);setError("");setInput("");setMessages(v=>[...v,{id:`u${Date.now()}`,role:"user",text:question}]);try{const session=await refreshSession();if(!session)throw new Error("Sign in to ask Just-In about your private collection.");const response=await fetch("/api/copilot",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({message:question,selectedCardId:currentCard()}),cache:"no-store"});const json=await response.json();if(!response.ok||!json.ok)throw new Error(json.error||"Just-In could not answer.");setMessages(v=>[...v,{id:`a${Date.now()}`,role:"assistant",text:json.result.answer,reply:json.result}])}catch(e){setError(e instanceof Error?e.message:"Just-In could not answer.")}finally{setBusy(false)}};
 const submit=(e:FormEvent)=>{e.preventDefault();void ask()};
 if(!ready)return null;
 return createPortal(<><button className="cs-justin-launch" onClick={()=>setOpen(true)}><span className="cs-justin-face"><i/><i/></span> JUST-IN</button>{open&&<div className="cs-justin-shell" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><aside className="cs-justin-drawer"><header><div className="cs-justin-pet"><i/><i/></div><div><small>CARDSIGNAL COPILOT</small><h2>Just-In</h2><p>Collection guide · evidence interpreter · market assistant</p></div><button onClick={()=>setOpen(false)}>×</button></header><div className="cs-justin-status"><i className={configured?"on":""}/>{configured===null?"Checking Gemini…":configured?"Gemini connected · private collection context":"Waiting for Gemini API configuration"}</div><main>{!messages.length&&<section className="cs-justin-welcome"><b>What should we look at?</b><p>I can explain CardSignal, organize your collection, find weak evidence, and prioritize cards that deserve attention.</p>{SUGGESTIONS.map(q=><button key={q} onClick={()=>ask(q)} disabled={!configured||busy}>{q}</button>)}<small>I use CardSignal evidence. I do not invent prices or silently change your collection.</small></section>}{messages.map(m=><article key={m.id} className={m.role}><small>{m.role==="user"?"YOU":"JUST-IN"}</small>{m.reply?.title&&<b>{m.reply.title}</b>}<p>{m.text}</p>{m.reply?.observations?.length?<ul>{m.reply.observations.map((x,i)=><li key={i}>{x}</li>)}</ul>:null}{m.reply&&<em className={m.reply.evidenceQuality.toLowerCase()}>{m.reply.evidenceQuality} EVIDENCE</em>}{m.reply?.proposedActions?.filter(a=>a.type!=="NONE").map((a,i)=><button className="cs-justin-action" key={i} onClick={()=>runAction(a)} title={a.reason}>{a.confirmationRequired?"REVIEW: ":""}{a.label}</button>)}</article>)}{busy&&<article className="assistant"><small>JUST-IN</small><p>● Reading your CardSignal evidence…</p></article>}{error&&<div className="cs-justin-error">{error}</div>}<div ref={end}/></main><form onSubmit={submit}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void ask()}}} maxLength={1200} disabled={!configured||busy} placeholder={configured?"Ask about your collection, a signal, or what to do next…":"Add GEMINI_API_KEY in Vercel, then redeploy."}/><div><span>{input.length}/1200</span><button disabled={!configured||busy||!input.trim()}>{busy?"THINKING…":"ASK JUST-IN →"}</button></div></form><footer>Decision support only—never guaranteed outcomes or financial advice.</footer></aside></div>}</>,document.body)
}
