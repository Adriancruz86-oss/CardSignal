"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Tool={label:string;selector:string;icon:string};
const TOOLS:Tool[]=[
 {label:"Portfolio Pulse",selector:".cs-pulse-launch",icon:"◉"},
 {label:"Signal Lab",selector:".cs-signal-lab-launch",icon:"⌁"},
 {label:"Data Sources",selector:".cs-sources-launch",icon:"●"},
 {label:"Live Market",selector:".cs-live-launch",icon:"◎"},
 {label:"Catalysts",selector:".cs-catalyst-launch",icon:"✦"},
 {label:"Action Center",selector:".cs-ac-launch",icon:"⚡"},
];

function scrollTo(selector:string){
 const el=document.querySelector<HTMLElement>(selector);
 if(!el)return;
 const y=el.getBoundingClientRect().top+window.scrollY-124;
 window.scrollTo({top:Math.max(0,y),behavior:"smooth"});
 el.classList.add("cs-nav-flash");
 window.setTimeout(()=>el.classList.remove("cs-nav-flash"),900);
}

export default function TopToolsNavLayer(){
 const[mount,setMount]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  const topbar=document.querySelector<HTMLElement>(".v2-topbar");
  if(!topbar)return;
  let host=document.querySelector<HTMLElement>("#cardsignal-top-tools");
  if(!host){host=document.createElement("div");host.id="cardsignal-top-tools";topbar.insertAdjacentElement("afterend",host)}
  setMount(host);

  const navHandler=(event:MouseEvent)=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>(".nav-tabs button");
   if(!button)return;
   const label=button.textContent?.trim()||"";
   document.querySelectorAll(".nav-tabs button").forEach(b=>b.classList.remove("active"));
   button.classList.add("active");
   if(label==="Dashboard"){event.preventDefault();window.scrollTo({top:0,behavior:"smooth"});}
   else if(label==="Buy Radar"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(1)");}
   else if(label==="Sell Radar"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(2)");}
   else if(label==="Watchlist"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(3)");}
  };
  document.addEventListener("click",navHandler,true);

  const viewAllHandler=(event:MouseEvent)=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>(".radar-panel .section-title button");
   if(!button)return;
   const panel=button.closest<HTMLElement>(".radar-panel");
   const panels=[...document.querySelectorAll<HTMLElement>(".triple-grid .radar-panel")];
   const idx=panels.indexOf(panel!);
   if(idx<0)return;
   event.preventDefault();
   const labels=["Buy Radar","Sell Radar","Watchlist"];
   const nav=[...document.querySelectorAll<HTMLButtonElement>(".nav-tabs button")].find(b=>b.textContent?.trim()===labels[idx]);
   nav?.click();
  };
  document.addEventListener("click",viewAllHandler,true);
  return()=>{document.removeEventListener("click",navHandler,true);document.removeEventListener("click",viewAllHandler,true)};
 },[]);

 const openTool=(selector:string)=>document.querySelector<HTMLButtonElement>(selector)?.click();
 if(!mount)return null;
 return createPortal(<>
  <div className="cs-top-tools-inner"><span className="cs-top-tools-label">TOOLS</span>{TOOLS.map(t=><button key={t.label} onClick={()=>openTool(t.selector)}><i>{t.icon}</i>{t.label}</button>)}</div>
  <style jsx global>{`
   .cs-pulse-launch,.cs-signal-lab-launch,.cs-sources-launch,.cs-live-launch,.cs-catalyst-launch,.cs-ac-launch{display:none!important}
   #cardsignal-top-tools{position:relative;z-index:40;background:rgba(3,14,23,.98);border-bottom:1px solid rgba(78,190,230,.12)}
   .cs-top-tools-inner{max-width:1360px;margin:0 auto;min-height:42px;padding:6px 24px;display:flex;align-items:center;justify-content:flex-end;gap:7px}
   .cs-top-tools-label{margin-right:auto;color:#567786;font-size:8px;font-weight:900;letter-spacing:.15em}
   .cs-top-tools-inner button{height:30px;padding:0 10px;display:flex;align-items:center;gap:6px;border:1px solid rgba(74,188,228,.16);border-radius:7px;background:rgba(7,27,41,.78);color:#8ebccd;font-size:9px;font-weight:800;letter-spacing:.035em;cursor:pointer;white-space:nowrap}
   .cs-top-tools-inner button:hover{border-color:rgba(80,220,255,.34);color:#d9f7ff;background:rgba(10,38,56,.9)}
   .cs-top-tools-inner button i{font-style:normal;color:#57dcff}.cs-top-tools-inner button:first-of-type i,.cs-top-tools-inner button:last-of-type i{color:#59efa1}
   .cs-nav-flash{animation:csNavFlash .9s ease}@keyframes csNavFlash{0%,100%{box-shadow:0 0 0 rgba(79,218,255,0)}35%{box-shadow:0 0 0 2px rgba(79,218,255,.24),0 0 30px rgba(79,218,255,.12)}}
   @media(max-width:920px){.cs-top-tools-inner{overflow-x:auto;justify-content:flex-start}.cs-top-tools-label{display:none}.cs-top-tools-inner button{flex:0 0 auto}}
  `}</style>
 </>,mount);
}
