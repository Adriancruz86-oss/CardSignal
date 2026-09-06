"use client";

import { useEffect } from "react";

type PulseStatus = "BUY MORE" | "HOLD" | "WATCH CLOSELY" | "SELL RISK" | "NOT ENOUGH DATA";
type MarketScan = { matchingVersion?:number; scannedAt:string; acceptedCount:number; rejectedCount:number; currentMedian:number|null; recentMedian:number|null; priorMedian:number|null; change7d:number|null; recentSales:number; velocity:number|null; pulse:PulseStatus; confidence:string; elapsedMs:number };
type CanonicalIdentity = { cardId?:string; playerName?:string; year?:string; setName?:string; cardNumber?:string; variation?:string };
type Card = { id:number; player:string; meta?:string; year?:string; setName?:string; cardNumber?:string; variant?:string; mode?:"owned"|"watching"; marketValue?:number; score?:number; move?:string; tone?:"buy"|"hold"|"sell"; image?:string; demo?:boolean; catalogConfirmed?:boolean; catalogSource?:string; catalogCardId?:string; canonicalIdentity?:CanonicalIdentity; marketScan?:MarketScan; liveValuation?:{compCount?:number;median?:number;confidence?:string;savedAt?:string} };

const KEY="cardsignal-added-cards";
function readCards():Card[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function money(v:number){return `$${v.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`}
function pct(v:number|null){return v==null?"—":`${v>=0?"+":""}${v.toFixed(1)}%`}
function initials(name:string){return name.split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function safe(v:string){return v.replace(/[<>&]/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[m]!))}
function pulseTone(s?:PulseStatus){return s==="BUY MORE"?"buy":s==="SELL RISK"?"sell":"hold"}
function priority(card:Card){const s=card.marketScan;if(!s)return-999;if(s.pulse==="BUY MORE")return 1000+(s.change7d||0)*10+(s.velocity||0);if(s.pulse==="SELL RISK")return 900+Math.abs(s.change7d||0)*10+(s.velocity||0);if(s.pulse==="WATCH CLOSELY")return 600+Math.abs(s.change7d||0)*10;return 100+s.acceptedCount}
function setText(selector:string,value:string){const el=document.querySelector<HTMLElement>(selector);if(el)el.textContent=value}
function setHTML(selector:string,value:string){const el=document.querySelector<HTMLElement>(selector);if(el)el.innerHTML=value}
function watchKey(card:Card){return card.catalogCardId||card.canonicalIdentity?.cardId||[card.player,card.year||card.canonicalIdentity?.year,card.setName||card.canonicalIdentity?.setName,card.cardNumber||card.canonicalIdentity?.cardNumber,card.variant||card.canonicalIdentity?.variation].filter(Boolean).join("|").toLowerCase()}
function dedupeCards(cards:Card[]){const seen=new Set<string>();return cards.filter(card=>{const k=watchKey(card);if(seen.has(k))return false;seen.add(k);return true})}
function grading(meta=""){const m=meta.match(/\b(PSA|BGS|SGC|CGC)\s*(10|9(?:\.5)?|8(?:\.5)?|7(?:\.5)?)\b/i);return m?{company:m[1].toUpperCase(),grade:m[2]}:null}
function signalColor(scan?:MarketScan){if(scan?.pulse==="SELL RISK")return"#ff6f82";if(scan?.pulse==="BUY MORE")return"#55efa2";return"#62d9f7"}

export default function DashboardLiveLayer(){
 useEffect(()=>{
  const render=()=>{
   const cards=readCards();
   const owned=cards.filter(c=>c.mode!=="watching");
   const watching=dedupeCards(cards.filter(c=>c.mode==="watching"));
   const scanned=owned.filter(c=>c.marketScan);
   const enough=scanned.filter(c=>(c.marketScan?.acceptedCount||0)>=3);
   const needs=owned.filter(c=>!c.marketScan||(c.marketScan.acceptedCount||0)<3);
   const priced=owned.filter(c=>(Number(c.marketValue)||0)>0&&(!c.marketScan||Number(c.marketScan.matchingVersion||0)>=3));
   const buy=enough.filter(c=>c.marketScan?.pulse==="BUY MORE");
   const sell=enough.filter(c=>c.marketScan?.pulse==="SELL RISK");
   const hold=enough.filter(c=>c.marketScan?.pulse==="HOLD");
   const portfolioValue=priced.reduce((s,c)=>s+(Number(c.marketValue)||0),0);
   const validChanges=enough.map(c=>c.marketScan?.change7d).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v));
   const avgChange=validChanges.length?validChanges.reduce((a,b)=>a+b,0)/validChanges.length:null;
   const latestScan=scanned.map(c=>c.marketScan!.scannedAt).sort().at(-1)||"";

   const stats=document.querySelectorAll<HTMLElement>(".stat-card");
   if(stats[0]){stats[0].querySelector(".stat-copy>span")!.textContent="PORTFOLIO VALUE";stats[0].querySelector(".stat-copy>strong")!.textContent=money(portfolioValue);stats[0].querySelector(".stat-copy>small")!.textContent=`${priced.length} priced · ${enough.length} with usable market evidence · ${owned.length} owned`;}
   if(stats[1]){stats[1].querySelector(".stat-copy>span")!.textContent="WATCHING";stats[1].querySelector(".stat-copy>strong")!.innerHTML=`${watching.length} <b>cards</b>`;stats[1].querySelector(".stat-copy>small")!.textContent=`${needs.length} owned cards still need stronger comp data`;}
   if(stats[2]){stats[2].querySelector(".stat-copy>span")!.textContent="BUY MORE";stats[2].querySelector(".stat-copy>strong")!.innerHTML=`${buy.length} <b>active</b>`;stats[2].querySelector(".stat-copy>small")!.textContent=buy.length?`${buy.filter(c=>c.marketScan?.confidence==="HIGH").length} high-confidence signals`:"No qualifying buy signals";}
   if(stats[3]){stats[3].querySelector(".stat-copy>span")!.textContent="SELL RISK";stats[3].querySelector(".stat-copy>strong")!.innerHTML=`${sell.length} <b>active</b>`;stats[3].querySelector(".stat-copy>small")!.textContent=sell.length?`${sell.filter(c=>c.marketScan?.confidence==="HIGH").length} high-confidence risks`:"No qualifying sell risks";}

   const top=[...enough].sort((a,b)=>priority(b)-priority(a))[0]||scanned[0]||owned[0];
   if(top){
    const s=top.marketScan;
    const tone=pulseTone(s?.pulse);
    const color=signalColor(s);
    const grade=grading(top.meta||"");
    const cardSet=top.setName||top.canonicalIdentity?.setName||"CATALOG CARD";
    const cardDetail=[top.cardNumber||top.canonicalIdentity?.cardNumber?`#${top.cardNumber||top.canonicalIdentity?.cardNumber}`:"",top.variant||top.canonicalIdentity?.variation||""].filter(Boolean).join(" · ")||"IDENTITY CONFIRMED";
    setText(".top-signal .panel-heading h2",top.player);
    setText(".top-signal .panel-heading p",top.meta||[top.year,top.setName,top.cardNumber&&`#${top.cardNumber}`].filter(Boolean).join(" · ")||"Saved portfolio card");
    setText(".top-signal .live-dot",s?"● PORTFOLIO SIGNAL":"● NOT SCANNED");
    setText(".top-signal .player-mark span",initials(top.player));
    setText(".top-signal .massive-score",String(top.score||0));
    const arrow=document.querySelector<HTMLElement>(".top-signal .score-arrow");if(arrow){arrow.textContent=s?.pulse==="SELL RISK"?"↘":s?.pulse==="BUY MORE"?"↗":"→";arrow.style.color=color;}
    const massive=document.querySelector<HTMLElement>(".top-signal .massive-score");if(massive)massive.style.color=tone==="sell"?"#ff7b8b":"";
    const rec=document.querySelector<HTMLElement>(".top-signal .recommendation");if(rec){rec.classList.remove("cs-live-buy","cs-live-sell","cs-live-hold");rec.classList.add(`cs-live-${tone}`);}
    setHTML(".top-signal .recommendation",`<span>${s?.pulse==="SELL RISK"?"▼":s?.pulse==="BUY MORE"?"▲":"◎"}</span> ${safe(s?.pulse||"NEEDS DATA")} <small>${safe(s?.confidence||"LOW")} CONFIDENCE</small>`);
    setText(".top-signal .signal-primary > p",s?(s.acceptedCount>=3?`${s.acceptedCount} accepted market matches support this reading. ${s.change7d==null?"Not enough dated history yet for a trustworthy 7-day comparison.":`Recent-vs-prior median movement is ${pct(s.change7d)}.`}`:"Fewer than 3 accepted market matches. CardSignal is withholding a market signal."):"Run Portfolio Pulse to collect identity-matched market evidence for this card.");
    setText(".top-signal .price-line strong",s?.currentMedian!=null?`$${s.currentMedian.toFixed(2)}`:"—");
    setText(".top-signal .price-line small",s?.change7d!=null?`${pct(s.change7d)} / 7D`:"trend not established");
    setText(".top-signal .updated",s?`Last scanned ${new Date(s.scannedAt).toLocaleString()}`:"Not scanned yet");
    setText(".top-signal .card-grade span",grade?.company||"RAW");setText(".top-signal .card-grade b",grade?.grade||"");
    setText(".top-signal .card-caption span",cardSet.toUpperCase());setText(".top-signal .card-caption small",cardDetail.toUpperCase());
   } else {
    setText(".top-signal .panel-heading h2","Add your first card");setText(".top-signal .panel-heading p","Your strongest real portfolio signal will appear here.");setText(".top-signal .massive-score","—");setText(".top-signal .signal-primary > p","Add cards, then run Portfolio Pulse. CardSignal will only surface signals backed by accepted market matches.");setText(".top-signal .price-line strong","—");setText(".top-signal .card-grade span","RAW");setText(".top-signal .card-grade b","");setText(".top-signal .card-caption span","CATALOG CARD");setText(".top-signal .card-caption small","NO CARD SELECTED");
   }

   const breakdown=document.querySelectorAll<HTMLElement>(".breakdown .metric");
   const topScan=top?.marketScan;
   const metrics:[string,number,string,string][]=[
    ["7D price move",topScan?.change7d==null?0:Math.min(100,Math.abs(topScan.change7d)*4),topScan?.change7d==null?"Not enough dated sales":pct(topScan.change7d),topScan?.change7d==null?"neutral":topScan.change7d<0?"negative":"positive"],
    ["Sales velocity",topScan?.velocity||0,topScan?`${topScan.recentSales} recent accepted sales`:"Not scanned","neutral"],
    ["Market-match evidence",topScan?Math.min(100,topScan.acceptedCount*8):0,topScan?`${topScan.acceptedCount} accepted · ${topScan.rejectedCount} rejected`:"Not scanned","neutral"],
    ["Signal confidence",topScan?.confidence==="HIGH"?90:topScan?.confidence==="MODERATE"?65:topScan?.confidence==="LOW"?30:0,topScan?.confidence||"No scan","neutral"],
   ];
   breakdown.forEach((el,i)=>{const m=metrics[i];if(!m)return;const label=el.querySelector<HTMLElement>(".metric-label span"),val=el.querySelector<HTMLElement>(".metric-label b"),bar=el.querySelector<HTMLElement>(".metric-track i"),small=el.querySelector<HTMLElement>("small");if(label)label.textContent=m[0];if(val){val.textContent=String(Math.round(m[1]));val.style.color=m[3]==="negative"?"#ff7b8b":m[3]==="positive"?"#5eeaa0":"";}if(bar){bar.style.width=`${m[1]}%`;bar.style.background=m[3]==="negative"?"#ff667a":m[3]==="positive"?"#54eda0":"#55d7f2";bar.style.boxShadow=m[3]==="negative"?"0 0 12px rgba(255,102,122,.35)":m[3]==="positive"?"0 0 12px rgba(84,237,160,.28)":"0 0 12px rgba(85,215,242,.2)";}if(small){small.textContent=m[2];small.style.color=m[3]==="negative"?"#ff8b99":m[3]==="positive"?"#71eeb0":"";}});
   setText(".breakdown .confidence",topScan?`${topScan.confidence} CONFIDENCE`:"NO SCAN");
   setText(".breakdown .insight-box span","MARKET EVIDENCE");
   setText(".breakdown .insight-box p",topScan?`${topScan.acceptedCount} accepted market matches underpin this card's current reading. CardSignal does not infer supply or buyer-interest metrics until those data sources are added.`:"Run Portfolio Pulse to replace this panel with real evidence.");

   const panels=document.querySelectorAll<HTMLElement>(".triple-grid .radar-panel");
   const renderRows=(panel:HTMLElement|undefined,list:Card[],empty:string)=>{if(!panel)return;panel.querySelectorAll(".signal-row,.radar-empty,.cs-live-empty").forEach(n=>n.remove());const title=panel.querySelector(".section-title");list.slice(0,4).forEach(c=>{const s=c.marketScan;const tone=pulseTone(s?.pulse);const row=document.createElement("div");row.className="signal-row cs-live-home-row";row.dataset.userCardId=String(c.id);const compLabel=s?`${s.acceptedCount} comps`:c.mode==="watching"?"watch":"0 comps";const move=s?.change7d==null?(s?"NO 7D":"NOT SCANNED"):pct(s.change7d);row.innerHTML=`<div class="mini-card mini-${tone}">${c.image?`<img src="${c.image}" alt=""/>`:`<span>${safe(initials(c.player))}</span>`}<i></i></div><div class="signal-copy"><strong>${safe(c.player)}</strong><span>${safe(c.meta||"Saved card")}</span></div><div class="score-pill ${tone} cs-comp-pill"><b>${safe(compLabel)}</b><small>${safe(move)}</small></div>`;title?.insertAdjacentElement("afterend",row);});if(!list.length){const e=document.createElement("div");e.className="radar-empty cs-live-empty";e.textContent=empty;panel.appendChild(e)}};
   renderRows(panels[0],buy,"No evidence-backed BUY MORE signals");renderRows(panels[1],sell,"No evidence-backed SELL RISK signals");renderRows(panels[2],watching,"Your watchlist is empty");

   const trend=document.querySelector<HTMLElement>(".trend-panel .chart-area");if(trend){trend.innerHTML=`<div class="cs-trend-empty"><b>Portfolio trend history starts after repeated scans</b><span>CardSignal has ${scanned.length} cards with a current scan, but a truthful 90-day chart requires saved portfolio snapshots over time. No fabricated history is shown.</span></div>`;}
   setText(".trend-panel .section-title b","PORTFOLIO TREND");setText(".trend-panel .section-title small","Historical snapshots only");

   const alerts=document.querySelector<HTMLElement>(".alerts-panel");if(alerts){alerts.querySelectorAll(".alert").forEach(n=>n.remove());const alertCards=[...scanned].sort((a,b)=>new Date(b.marketScan!.scannedAt).getTime()-new Date(a.marketScan!.scannedAt).getTime()).filter(c=>c.marketScan!.pulse!=="HOLD").slice(0,3);alertCards.forEach(c=>{const s=c.marketScan!;const cls=s.pulse==="SELL RISK"?"sell":s.pulse==="BUY MORE"?"buy":"info";const icon=s.pulse==="SELL RISK"?"▼":s.pulse==="BUY MORE"?"▲":"◎";const a=document.createElement("div");a.className=`alert ${cls}`;a.innerHTML=`<i>${icon}</i><div><b>${safe(s.pulse)}</b><p>${safe(c.player)} · ${s.acceptedCount} accepted market matches${s.change7d==null?"":` · ${safe(pct(s.change7d))} 7D`}</p><small>${new Date(s.scannedAt).toLocaleString()}</small></div>`;alerts.appendChild(a)});if(!alertCards.length){const a=document.createElement("div");a.className="alert info";a.innerHTML=`<i>◎</i><div><b>No material portfolio alerts</b><p>${scanned.length?"Scanned cards are currently HOLD or need more evidence.":"Run Portfolio Pulse to generate evidence-backed alerts."}</p><small>${latestScan?new Date(latestScan).toLocaleString():"No scan yet"}</small></div>`;alerts.appendChild(a)}}

   setText(".snapshot-panel .snapshot-ring strong",String(enough.length));setText(".snapshot-panel .snapshot-ring span","CARDS WITH DATA");
   const snap=document.querySelectorAll<HTMLElement>(".snapshot-panel .snapshot-stats p");if(snap[0])snap[0].innerHTML=`<span>Rising</span><b class="positive">${validChanges.filter(v=>v>3).length}</b>`;if(snap[1])snap[1].innerHTML=`<span>Stable</span><b>${hold.length}</b>`;if(snap[2])snap[2].innerHTML=`<span>Falling</span><b class="negative">${validChanges.filter(v=>v<-3).length}</b>`;
   setHTML(".snapshot-panel .market-note",`<span>◎</span><p><b>${enough.length} of ${owned.length} owned cards have usable market evidence</b><br>${avgChange==null?"Not enough dated sales for an aggregate 7D move.":`Average measured 7D move: ${safe(pct(avgChange))}.`} ${needs.length} cards need more accepted market matches.</p>`);
   setText(".snapshot-panel .section-title small",latestScan?`Last scan ${new Date(latestScan).toLocaleString()}`:"No portfolio scan yet");
   setText(".scan-status strong",latestScan?new Date(latestScan).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"NOT RUN");
   const statusLabel=document.querySelector<HTMLElement>(".scan-status");if(statusLabel&&statusLabel.childNodes[1])statusLabel.childNodes[1].textContent=" Last portfolio scan ";
  };
  render();window.addEventListener("cardsignal:user-cards-changed",render);window.addEventListener("storage",render);return()=>{window.removeEventListener("cardsignal:user-cards-changed",render);window.removeEventListener("storage",render)};
 },[]);
 return <style jsx global>{`
  .cs-live-home-row .mini-card{overflow:hidden}.cs-live-home-row .mini-card img{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:cover;border-radius:5px}
  .cs-comp-pill{min-width:72px!important;padding-left:7px!important;padding-right:7px!important}.cs-comp-pill>b{font-size:9px!important;white-space:nowrap}.cs-comp-pill>small{font-size:7px!important}
  .top-signal .recommendation.cs-live-sell{color:#ff8c99!important;background:rgba(205,45,67,.09)!important;border-color:rgba(255,91,111,.32)!important}.top-signal .recommendation.cs-live-buy{color:#72efad!important;background:rgba(54,226,143,.08)!important;border-color:rgba(66,245,158,.26)!important}.top-signal .recommendation.cs-live-hold{color:#7bdff7!important;background:rgba(62,174,220,.08)!important;border-color:rgba(82,205,245,.24)!important}
  .cs-trend-empty{height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;border:1px dashed rgba(80,190,225,.16);border-radius:10px;background:rgba(5,20,32,.34)}.cs-trend-empty b{color:#c5dce7;font-size:13px}.cs-trend-empty span{max-width:520px;margin-top:8px;color:#69899a;font-size:10px;line-height:1.55}
 `}</style>;
}
