"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createWorker } from "tesseract.js";

type Confidence = "high" | "medium" | "low";
type Clues = {
  player?: string;
  year?: string;
  manufacturer?: string;
  cardNumber?: string;
  serial?: string;
  playerConfidence?: Confidence;
  yearConfidence?: Confidence;
  cardNumberConfidence?: Confidence;
  serialConfidence?: Confidence;
  orientationNote?: string;
};

const EXCLUDES = new Set([
  "TOPPS","BOWMAN","PANINI","DONRUSS","BASEBALL","FOOTBALL","BASKETBALL","PITCHER","HITTER","ROOKIE","CARD","CARDS","PLAYER","PLAYERS","CHROME","REFRACTOR","PRIZM","OPTIC","SELECT","MOSAIC","COPYRIGHT","INC","LLC","USA","MLB","ANGELS","DODGERS","TOPPSBASEBALL","TOPPSBASEB"
]);

function cleanLines(text:string){
  return text.split(/\r?\n/).map(v=>v.replace(/[^A-Za-z0-9#/'&.\- ]+/g," ").replace(/\s+/g," ").trim()).filter(Boolean);
}
function titleCase(v:string){return v.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());}
function normalize(v:string){return v.toUpperCase().replace(/[^A-Z0-9#/' .-]/g," ").replace(/\s+/g," ").trim();}
function upperRatio(v:string){const letters=v.replace(/[^A-Za-z]/g,"");if(!letters)return 0;return [...letters].filter(c=>c===c.toUpperCase()).length/letters.length;}
function isPlausibleCardNumber(v:string){
  const n=v.toUpperCase().replace(/^#/,"").trim();
  if(!n||n.length>9||/^(19|20)\d{2}$/.test(n)||EXCLUDES.has(n))return false;
  if(/^[A-Z]{5,}$/.test(n))return false;
  if(/^\d{1,4}$/.test(n))return true;
  return /\d/.test(n)&&/^[A-Z0-9-]{2,9}$/.test(n);
}

function nameCandidates(text:string){
  return cleanLines(text).filter(v=>{
    const words=v.split(" ");
    if(words.length<2||words.length>4||v.length<6||v.length>32||/\d/.test(v)||upperRatio(v)<.52)return false;
    const n=normalize(v);
    if(EXCLUDES.has(n))return false;
    if([...EXCLUDES].some(x=>x.length>6&&n.includes(x)))return false;
    return words.every(w=>/^[A-Za-z'.-]+$/.test(w));
  });
}

function choosePlayer(front:string,frontStripA:string,frontStripB:string,back:string){
  const weighted:{value:string;weight:number}[]=[];
  nameCandidates(front).forEach(v=>weighted.push({value:v,weight:2}));
  nameCandidates(frontStripA).forEach(v=>weighted.push({value:v,weight:8}));
  nameCandidates(frontStripB).forEach(v=>weighted.push({value:v,weight:10}));
  nameCandidates(back).forEach(v=>weighted.push({value:v,weight:2}));
  const scores=new Map<string,number>();
  for(const item of weighted){const key=normalize(item.value);scores.set(key,(scores.get(key)||0)+item.weight);}
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]||a[0].length-b[0].length);
  if(!ranked.length)return {value:"",confidence:"low" as Confidence};
  const [value,score]=ranked[0];
  return {value:titleCase(value),confidence:(score>=10?"high":score>=7?"medium":"low") as Confidence};
}

function chooseCardNumber(back:string,backTop:string,backRight:string){
  const all=`${backTop}\n${backRight}\n${back}`.toUpperCase();
  const exactPrefixes=[...all.matchAll(/\b(?:US|USC|H|T|BD|BCP|BSP|SMLB|ASG|RD|TT|P)[-]?[A-Z]*\d{1,4}\b/g)].map(m=>m[0]);
  const exact=exactPrefixes.find(isPlausibleCardNumber);
  if(exact)return {value:exact,confidence:"high" as Confidence};
  const labeled=[...all.matchAll(/(?:CARD\s*(?:NO\.?|NUMBER|#)|NO\.?|#)\s*([A-Z0-9-]{1,10})/g)].map(m=>m[1]).find(isPlausibleCardNumber);
  if(labeled)return {value:labeled,confidence:"high" as Confidence};
  const standalone=cleanLines(`${backTop}\n${backRight}`).map(v=>v.match(/^#?([A-Z0-9-]{1,9})$/i)?.[1]||"").find(isPlausibleCardNumber);
  if(standalone)return {value:standalone.toUpperCase(),confidence:"medium" as Confidence};
  return {value:"",confidence:"low" as Confidence};
}

function chooseYear(text:string){
  const years=[...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=1950&&y<=new Date().getFullYear()+1);
  if(!years.length)return {value:"",confidence:"low" as Confidence};
  const counts=new Map<number,number>();years.forEach(y=>counts.set(y,(counts.get(y)||0)+1));
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
  return {value:String(ranked[0][0]),confidence:(ranked[0][1]>=2?"high":"medium") as Confidence};
}

function scoreText(text:string){
  const u=text.toUpperCase();
  let score=Math.min(40,(u.match(/[A-Z]{3,}/g)||[]).length);
  for(const anchor of ["TOPPS","BOWMAN","PANINI","SHOHEI","OHTANI","ROOKIE","BASEBALL","ANGELS","COPYRIGHT","MLB"]){if(u.includes(anchor))score+=12;}
  if(/\b(?:US|USC|H|T|BD|BCP|BSP|SMLB|ASG|RD|TT|P)[-]?[A-Z]*\d{1,4}\b/.test(u))score+=12;
  return score;
}

async function loadCanvas(file:File,rotation:number){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const n=new Image();n.onload=()=>resolve(n);n.onerror=()=>reject(new Error("Could not load card image"));n.src=url;});
    const turn=((rotation%360)+360)%360;const swap=turn===90||turn===270;
    const canvas=document.createElement("canvas");canvas.width=swap?img.height:img.width;canvas.height=swap?img.width:img.height;
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Could not prepare card image");
    ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turn*Math.PI/180);ctx.drawImage(img,-img.width/2,-img.height/2);
    return canvas;
  }finally{URL.revokeObjectURL(url);}
}

function cropEnhanced(source:HTMLCanvasElement,x:number,y:number,w:number,h:number){
  const sx=Math.round(source.width*x),sy=Math.round(source.height*y),sw=Math.max(1,Math.round(source.width*w)),sh=Math.max(1,Math.round(source.height*h));
  const scale=Math.max(2,Math.min(5,2100/Math.max(sw,sh)));const c=document.createElement("canvas");c.width=Math.round(sw*scale);c.height=Math.round(sh*scale);
  const ctx=c.getContext("2d");if(!ctx)throw new Error("Could not crop card image");ctx.drawImage(source,sx,sy,sw,sh,0,0,c.width,c.height);
  const image=ctx.getImageData(0,0,c.width,c.height),d=image.data;for(let i=0;i<d.length;i+=4){const g=d[i]*.299+d[i+1]*.587+d[i+2]*.114;const b=g>175?255:g<65?0:Math.max(0,Math.min(255,(g-128)*2+128));d[i]=d[i+1]=d[i+2]=b;}ctx.putImageData(image,0,0);return c;
}

function setReactInput(el:HTMLInputElement|null,value:string){if(!el||!value)return;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}

export default function PhotoOcrFallbackLayer(){
  const [target,setTarget]=useState<HTMLElement|null>(null);const [visible,setVisible]=useState(false);const [working,setWorking]=useState(false);const [status,setStatus]=useState("");const [clues,setClues]=useState<Clues|null>(null);
  useEffect(()=>{const evaluate=()=>setTarget(document.querySelector<HTMLElement>(".cs-photo-actions"));evaluate();const observer=new MutationObserver(evaluate);observer.observe(document.body,{subtree:true,childList:true});return()=>observer.disconnect();},[]);

  const runOcr=async()=>{
    if(working)return;const files=Array.from(document.querySelectorAll<HTMLInputElement>(".cs-photo-slot input[type='file']"));const front=files[0]?.files?.[0],back=files[1]?.files?.[0];if(!front)return;
    setVisible(true);setWorking(true);setClues(null);setStatus("Checking card orientation and reading text…");
    let worker:Awaited<ReturnType<typeof createWorker>>|null=null;
    try{
      worker=await createWorker("eng",1,{logger:m=>{if(m.status==="recognizing text"&&typeof m.progress==="number")setStatus(`Reading card text… ${Math.round(m.progress*100)}%`);}});await worker.setParameters({preserve_interword_spaces:"1"});
      const rotations=[0,90,180,270];
      const readBest=async(file:File)=>{let best={canvas:await loadCanvas(file,0),text:"",rotation:0,score:-1};for(const rot of rotations){const canvas=rot===0?best.canvas:await loadCanvas(file,rot);const result=await worker!.recognize(canvas);const text=result.data.text||"";const score=scoreText(text);if(score>best.score)best={canvas,text,rotation:rot,score};}return best;};
      const bestFront=await readBest(front);const bestBack=back?await readBest(back):null;
      setStatus("Reading name strip, card number and serial-number areas…");
      const frontStripA=await worker.recognize(cropEnhanced(bestFront.canvas,.02,.68,.96,.27));
      const frontStripB=await worker.recognize(cropEnhanced(bestFront.canvas,.08,.76,.84,.18));
      const frontSerial=await worker.recognize(cropEnhanced(bestFront.canvas,.58,.00,.40,.28));
      const backTop=bestBack?await worker.recognize(cropEnhanced(bestBack.canvas,.02,0,.96,.38)):null;
      const backRight=bestBack?await worker.recognize(cropEnhanced(bestBack.canvas,.62,.00,.36,1.00)):null;
      const backBottom=bestBack?await worker.recognize(cropEnhanced(bestBack.canvas,.02,.60,.96,.38)):null;
      const frontText=bestFront.text,backText=bestBack?.text||"",stripAText=frontStripA.data.text||"",stripBText=frontStripB.data.text||"",serialText=frontSerial.data.text||"",topText=backTop?.data.text||"",rightText=backRight?.data.text||"",bottomText=backBottom?.data.text||"";
      const player=choosePlayer(frontText,stripAText,stripBText,backText);const number=chooseCardNumber(backText,topText,rightText);const year=chooseYear(`${backText}\n${bottomText}\n${frontText}`);const combined=`${frontText}\n${backText}\n${stripAText}\n${stripBText}\n${topText}\n${rightText}\n${bottomText}`;const brand=combined.match(/\b(Topps|Bowman|Panini|Upper Deck|Donruss|Leaf|Fleer|Score)\b/i)?.[1]||"";
      const serialMatch=serialText.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);const serial=serialMatch?`${serialMatch[1]}/${serialMatch[2]}`:"";
      const next:Clues={player:player.value,playerConfidence:player.confidence,year:year.value,yearConfidence:year.confidence,manufacturer:brand?titleCase(brand):"",cardNumber:number.value,cardNumberConfidence:number.confidence,serial,serialConfidence:serial?"medium":"low",orientationNote:`front ${bestFront.rotation}°${bestBack?` · back ${bestBack.rotation}°`:""}`};setClues(next);
      const trustedPlayer=next.playerConfidence!=="low"?next.player:"";const trustedYear=next.yearConfidence!=="low"?next.year:"";const trustedNumber=next.cardNumberConfidence!=="low"?next.cardNumber:"";
      const playerQuery=trustedPlayer?[trustedPlayer,trustedYear,next.manufacturer,trustedNumber?`#${trustedNumber}`:""].filter(Boolean).join(" "):"";
      const identifierQuery=trustedYear&&next.manufacturer&&trustedNumber?[trustedYear,next.manufacturer,`#${trustedNumber}`].join(" "):"";
      const query=playerQuery||identifierQuery;
      if(query){setReactInput(document.querySelector<HTMLInputElement>(".cs-add-search"),query);setStatus(trustedPlayer?"Enough evidence found — searching CardSight's catalog for canonical matches…":"Year + brand + card number agree — searching the catalog to resolve the player and exact card…");}
      else setStatus("OCR found partial clues, but not enough trustworthy evidence to search automatically. Suspicious card numbers and serials were discarded.");
    }catch(error){setStatus(error instanceof Error?`OCR failed: ${error.message}`:"OCR failed");}finally{await worker?.terminate();setWorking(false);}
  };

  useEffect(()=>{const handler=()=>{void runOcr();};window.addEventListener("cardsignal:request-ocr",handler);return()=>window.removeEventListener("cardsignal:request-ocr",handler);});
  if(!target||!visible)return null;
  return createPortal(<div className="cs-ocr-fallback"><div className="cs-ocr-fallback-head"><span>PHOTO TEXT VERIFICATION</span><b>OCR supplies clues. The catalog supplies identity.</b></div><button type="button" onClick={runOcr} disabled={working}>{working?"CHECKING ORIENTATION + TEXT…":"READ / VERIFY FRONT + BACK"}</button><small>CardSignal checks multiple name-strip crops, validates card-number formats and can resolve identity from year + brand + card number even when the player name is unreadable.</small>{status&&<div className="cs-ocr-status">{status}</div>}{clues&&<div className="cs-ocr-clues">{clues.player&&<span className={`q-${clues.playerConfidence}`}>PLAYER <b>{clues.player}</b><i>{clues.playerConfidence}</i></span>}{clues.cardNumber&&<span className={`q-${clues.cardNumberConfidence}`}>CARD # <b>{clues.cardNumber}</b><i>{clues.cardNumberConfidence}</i></span>}{clues.year&&<span className={`q-${clues.yearConfidence}`}>YEAR <b>{clues.year}</b><i>{clues.yearConfidence}</i></span>}{clues.manufacturer&&<span>BRAND <b>{clues.manufacturer}</b></span>}{clues.serial&&<span className={`q-${clues.serialConfidence}`}>SERIAL <b>{clues.serial}</b><i>{clues.serialConfidence}</i></span>}{clues.orientationNote&&<span>ORIENTATION <b>{clues.orientationNote}</b></span>}</div>}<style jsx global>{`.cs-ocr-fallback{margin-top:10px;padding:12px;border:1px solid rgba(255,193,92,.26);border-radius:9px;background:rgba(145,92,18,.08)}.cs-ocr-fallback-head span{display:block;color:#ffc66f;font-size:7px;font-weight:900;letter-spacing:.13em}.cs-ocr-fallback-head b{display:block;margin:4px 0 9px;color:#f5dfba;font-size:10px}.cs-ocr-fallback>button{width:100%;min-height:36px;border:1px solid rgba(255,193,92,.36);border-radius:8px;background:rgba(164,103,24,.12);color:#ffe1aa;font-size:8px;font-weight:900;letter-spacing:.09em;cursor:pointer}.cs-ocr-fallback>button:disabled{opacity:.5;cursor:wait}.cs-ocr-fallback>small{display:block;margin-top:6px;color:#8b9ba3;font-size:8px;line-height:1.4}.cs-ocr-status{margin-top:8px;color:#8fe6ff;font-size:8px}.cs-ocr-clues{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.cs-ocr-clues span{padding:5px 7px;border:1px solid rgba(82,205,245,.15);border-radius:6px;background:#071724;color:#66889b;font-size:7px;font-weight:900;letter-spacing:.07em}.cs-ocr-clues b{margin-left:4px;color:#d9f4ff;font-size:8px}.cs-ocr-clues i{margin-left:5px;font-size:6px;font-style:normal;color:#667f8d}.cs-ocr-clues .q-high{border-color:rgba(77,238,157,.3)}.cs-ocr-clues .q-high i{color:#62e9a5}.cs-ocr-clues .q-low{opacity:.55;border-color:rgba(255,107,123,.18)}`}</style></div>,target);
}
