"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Tool={label:string;selector:string;icon:string};
const CORE:Tool[]=[
 {label:"Decision Brief",selector:".cs-decision-brief-launch",icon:"◆"},
 {label:"Portfolio Pulse",selector:".cs-pulse-launch",icon:"◉"},
 {label:"Edge Stack",selector:".cs-edge-stack-launch",icon:"⌁"},
 {label:"Live Market",selector:".cs-live-launch",icon:"◎"},
 {label:"Collection",selector:".cs-organizer-launch",icon:"▦"},
 {label:"Sell Prep",selector:".cs-sell-prep-launch",icon:"↗"},
 {label:"Discovery",selector:".cs-discovery-launch",icon:"⌖"},
 {label:"Action Center",selector:".cs-ac-launch",icon:"⚡"},
 {label:"Pokémon",selector:".cs-pokemon-launch",icon:"◓"},
];
const LAB:Tool[]=[
 {label:"Historical Analogs",selector:".cs-analogs-launch",icon:"≋"},
 {label:"Pattern Playbooks",selector:".cs-playbook-launch",icon:"▧"},
 {label:"Signal Scorecard",selector:".cs-scorecard-launch",icon:"✓"},
 {label:"Signal Lab",selector:".cs-signal-lab-launch",icon:"⌁"},
 {label:"Data Sources",selector:".cs-sources-launch",icon:"●"},
 {label:"Catalysts",selector:".cs-catalyst-launch",icon:"✦"},
 {label:"Catalyst History",selector:".cs-cat-history-launch",icon:"◫"},
 {label:"Outcomes",selector:".cs-outcome-launch",icon:"◒"},
 {label:"Cohorts",selector:".cs-validation-cohort-launch",icon:"◩"},
 {label:"Market Scout",selector:".cs-market-scout-launch",icon:"◈"},
 {label:"Performance",selector:".cs-performance-watch-launch",icon:"▲"},
 {label:"Population",selector:".cs-pop-alert-launch",icon:"▥"},
 {label:"Segments",selector:".cs-segment-launch",icon:"▦"},
 {label:"Benchmark",selector:".cs-benchmark-launch",icon:"▣"},
 {label:"Bench Health",selector:".cs-benchmark-health-launch",icon:"▤"},
 {label:"Scan Ready",selector:".cs-benchmark-readiness-launch",icon:"◷"},
 {label:"Opportunities",selector:".cs-opportunity-launch",icon:"◇"},
 {label:"Journal",selector:".cs-journal-launch",icon:"▤"},
];
function scrollTo(selector:string){const el=document.querySelector<HTMLElement>(selector);if(!el)return;const y=el.getBoundingClientRect().top+window.scrollY-124;window.scrollTo({top:Math.max(0,y),behavior:"smooth"});el.classList.add("cs-nav-flash");window.setTimeout(()=>el.classList.remove("cs-nav-flash"),900)}
export default function TopToolsNavLayer(){
 const[mount,setMount]=useState<HTMLElement|null>(null),[labOpen,setLabOpen]=useState(false);
 useEffect(()=>{const topbar=document.querySelector<HTMLElement>(".v2-topbar");if(!topbar)return;let host=document.querySelector<HTMLElement>("#cardsignal-top-tools");if(!host){host=document.createElement("div");host.id="cardsignal-top-tools";topbar.insertAdjacentElement("afterend",host)}setMount(host);const navHandler=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>(".nav-tabs button");if(!button)return;const label=button.textContent?.trim()||"";document.querySelectorAll(".nav-tabs button").forEach(b=>b.classList.remove("active"));button.classList.add("active");if(label==="Dashboard"){event.preventDefault();window.scrollTo({top:0,behavior:"smooth"})}else if(label==="Buy Radar"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(1)")}else if(label==="Sell Radar"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(2)")}else if(label==="Watchlist"){event.preventDefault();scrollTo(".triple-grid .radar-panel:nth-child(3)")}};document.addEventListener("click",navHandler,true);const viewAllHandler=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>(".radar-panel .section-title button");if(!button)return;const panel=button.closest<HTMLElement>(".radar-panel");const panels=[...document.querySelectorAll<HTMLElement>(".triple-grid .radar-panel")];const idx=panels.indexOf(panel!);if(idx<0)return;event.preventDefault();const labels=["Buy Radar","Sell Radar","Watchlist"];const nav=[...document.querySelectorAll<HTMLButtonElement>(".nav-tabs button")].find(b=>b.textContent?.trim()===labels[idx]);nav?.click()};document.addEventListener("click",viewAllHandler,true);return()=>{document.removeEventListener("click",navHandler,true);document.removeEventListener("click",viewAllHandler,true)}},[]);
 const openTool=(selector:string)=>{document.querySelector<HTMLButtonElement>(selector)?.click();setLabOpen(false)};
 if(!mount)return null;
 return createPortal(<><div className="cs-top-tools-inner"><span className="cs-top-tools-label">CARDSIGNAL</span>{CORE.map(t=><button key={t.label} onClick={()=>openTool(t.selector)}><i>{t.icon}</i>{t.label}</button>)}<div className="cs-lab-wrap"><button className={labOpen?"lab active":"lab"} onClick={()=>setLabOpen(v=>!v)}><i>▤</i>Research Lab <b>{labOpen?"▲":"▼"}</b></button>{labOpen&&<div className="cs-lab-menu"><div><span>VALIDATION & RESEARCH</span><small>Advanced tools are kept here so the everyday workflow stays focused.</small></div>{LAB.map(t=><button key={t.label} onClick={()=>openTool(t.selector)}><i>{t.icon}</i><span>{t.label}</span></button>)}</div>}</div></div><style jsx global>{`.cs-decision-brief-launch,.cs-pulse-launch,.cs-edge-stack-launch,.cs-analogs-launch,.cs-playbook-launch,.cs-scorecard-launch,.cs-organizer-launch,.cs-sell-prep-launch,.cs-signal-lab-launch,.cs-sources-launch,.cs-live-launch,.cs-catalyst-launch,.cs-cat-history-launch,.cs-outcome-launch,.cs-validation-cohort-launch,.cs-discovery-launch,.cs-market-scout-launch,.cs-performance-watch-launch,.cs-pop-alert-launch,.cs-segment-launch,.cs-pokemon-launch,.cs-benchmark-launch,.cs-benchmark-health-launch,.cs-benchmark-readiness-launch,.cs-opportunity-launch,.cs-journal-launch,.cs-ac-launch{display:none!important}#cardsignal-top-tools{position:relative;z-index:140;background:rgba(3,14,23,.98);border-bottom:1px solid rgba(78,190,230,.12)}.cs-top-tools-inner{max-width:1360px;margin:0 auto;min-height:42px;padding:6px 24px;display:flex;align-items:center;gap:7px}.cs-top-tools-label{margin-right:4px;color:#567786;font-size:8px;font-weight:900;letter-spacing:.15em;flex:0 0 auto}.cs-top-tools-inner>button,.cs-lab-wrap>button{height:30px;padding:0 10px;display:flex;align-items:center;gap:6px;border:1px solid rgba(74,188,228,.16);border-radius:7px;background:rgba(7,27,41,.78);color:#8ebccd;font-size:9px;font-weight:800;letter-spacing:.035em;cursor:pointer;white-space:nowrap}.cs-top-tools-inner>button:first-of-type{border-color:rgba(89,235,159,.3);color:#a2f5c4}.cs-top-tools-inner button:hover{border-color:rgba(80,220,255,.34);color:#d9f7ff;background:rgba(10,38,56,.9)}.cs-top-tools-inner button i{font-style:normal;color:#57dcff}.cs-top-tools-inner>button:first-of-type i{color:#68efa9}.cs-lab-wrap{position:relative;margin-left:auto}.cs-lab-wrap>button.active{border-color:rgba(102,224,255,.34);color:#d8f7ff}.cs-lab-wrap>button b{font-size:6px;color:#668a99}.cs-lab-menu{position:absolute;right:0;top:36px;width:430px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;border:1px solid rgba(80,199,239,.2);border-radius:11px;background:rgba(4,18,29,.99);box-shadow:0 24px 70px rgba(0,0,0,.7)}.cs-lab-menu>div{grid-column:1/-1;padding:4px 4px 8px;border-bottom:1px solid rgba(80,190,225,.08)}.cs-lab-menu>div span,.cs-lab-menu>div small{display:block}.cs-lab-menu>div span{color:#68dcff;font-size:7px;font-weight:900;letter-spacing:.12em}.cs-lab-menu>div small{margin-top:3px;color:#678796;font-size:7px}.cs-lab-menu>button{height:34px;padding:0 9px;display:flex;align-items:center;gap:7px;border:1px solid rgba(75,187,225,.1);border-radius:7px;background:rgba(7,27,41,.75);color:#89aebb;font-size:8px;font-weight:800;text-align:left;cursor:pointer}.cs-lab-menu>button i{width:14px;text-align:center;color:#5edcff;font-style:normal}.cs-nav-flash{animation:csNavFlash .9s ease}@keyframes csNavFlash{0%,100%{box-shadow:0 0 0 rgba(79,218,255,0)}35%{box-shadow:0 0 0 2px rgba(79,218,255,.24),0 0 30px rgba(79,218,255,.12)}}@media(max-width:1120px){.cs-top-tools-inner{overflow-x:auto}.cs-lab-wrap{margin-left:0;position:static}.cs-lab-menu{position:fixed;left:16px;right:16px;top:104px;width:auto;max-height:70vh;overflow:auto}.cs-top-tools-label{display:none}}@media(max-width:620px){.cs-lab-menu{grid-template-columns:1fr}}`}</style></>,mount)}
