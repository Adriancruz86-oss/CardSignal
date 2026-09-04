"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Identity = { year?: string; setName?: string; manufacturer?: string; cardNumber?: string; playerName?: string; variation?: string; sport?: string; url?: string };
type FormState = { player:string; yearSet:string; cardNumber:string; variant:string; gradingCompany:string; grade:string; cert:string; mode:"owned"|"watching"; purchasePrice:string };
type SuggestionResponse = { ok:boolean; suggestions?:Identity[]; error?:string };

const initialForm: FormState = { player:"", yearSet:"", cardNumber:"", variant:"", gradingCompany:"PSA", grade:"10", cert:"", mode:"watching", purchasePrice:"" };

function readImage(event: ChangeEvent<HTMLInputElement>, setter: (v:string|null)=>void) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setter(String(reader.result));
  reader.readAsDataURL(file);
}

function label(id:Identity){ return [id.year,id.setName,id.cardNumber?`#${id.cardNumber}`:"",id.variation].filter(Boolean).join(" · "); }

export default function FunctionalLayer(){
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState<FormState>(initialForm);
  const [front,setFront]=useState<string|null>(null);
  const [back,setBack]=useState<string|null>(null);
  const [lookup,setLookup]=useState("");
  const [manualOpen,setManualOpen]=useState(false);
  const [suggestions,setSuggestions]=useState<Identity[]>([]);
  const [suggesting,setSuggesting]=useState(false);
  const [selected,setSelected]=useState<Identity|null>(null);
  const cache=useRef(new Map<string,Identity[]>());

  useEffect(()=>{
    const addButton=document.querySelector<HTMLButtonElement>(".add-card");
    const openModal=(e:Event)=>{e.preventDefault();setOpen(true);};
    addButton?.addEventListener("click",openModal);
    return()=>addButton?.removeEventListener("click",openModal);
  },[]);

  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape")setOpen(false); };
    window.addEventListener("keydown",onKey); return()=>window.removeEventListener("keydown",onKey);
  },[open]);

  useEffect(()=>{
    const q=lookup.trim();
    if(!open||!manualOpen||selected||q.length<5){ if(q.length<5)setSuggestions([]); return; }
    const key=q.toLowerCase();
    const cached=cache.current.get(key); if(cached){setSuggestions(cached);return;}
    const timer=window.setTimeout(async()=>{
      setSuggesting(true);
      try{
        const r=await fetch(`/api/card-suggestions?q=${encodeURIComponent(q)}`);
        const j=await r.json() as SuggestionResponse;
        const next=r.ok&&j.ok?(j.suggestions??[]):[];
        cache.current.set(key,next); setSuggestions(next);
      }catch{setSuggestions([]);}finally{setSuggesting(false);}
    },450);
    return()=>window.clearTimeout(timer);
  },[lookup,open,manualOpen,selected]);

  const meta=useMemo(()=>[form.yearSet,form.cardNumber&&`#${form.cardNumber}`,form.variant,form.gradingCompany!=="Raw"&&form.grade?`${form.gradingCompany} ${form.grade}`:"Raw"].filter(Boolean).join(" · "),[form]);

  const choose=(id:Identity)=>{
    setSelected(id); setSuggestions([]);
    setLookup([id.playerName,id.year,id.setName,id.cardNumber?`#${id.cardNumber}`:"",id.variation].filter(Boolean).join(" "));
    setForm(f=>({...f,player:id.playerName||f.player,yearSet:[id.year,id.setName].filter(Boolean).join(" "),cardNumber:id.cardNumber||"",variant:id.variation||""}));
  };

  const reset=()=>{setForm(initialForm);setFront(null);setBack(null);setLookup("");setSelected(null);setSuggestions([]);setManualOpen(false);};

  const save=(event?:FormEvent)=>{
    event?.preventDefault();
    if(!form.player.trim()){setManualOpen(true);return;}
    const payload={
      id:Date.now(), player:form.player.trim(), meta:meta||"Unspecified card", score:0, move:"", tone:"hold", mode:form.mode,
      marketValue:0, purchasePrice:form.purchasePrice?Number(form.purchasePrice):undefined, image:front||undefined, frontImage:front||undefined, backImage:back||undefined,
      addedAt:new Date().toISOString(), analyzed:false,
      canonicalIdentity:selected?{...selected}:undefined,
      cert:form.cert||undefined,
    };
    const previous=JSON.parse(localStorage.getItem("cardsignal-added-cards")||"[]");
    localStorage.setItem("cardsignal-added-cards",JSON.stringify([payload,...previous].slice(0,100)));
    window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
    setOpen(false); reset();
  };

  if(!open)return null;

  return <div className="cs-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}>
    <section className="cs-modal cs-add-collection" role="dialog" aria-modal="true" aria-label="Add Card">
      <button className="cs-close" onClick={()=>setOpen(false)} aria-label="Close">×</button>
      <form onSubmit={save}>
        <div className="cs-modal-header"><span>ADD TO COLLECTION</span><h2>Add cards first. Analyze later.</h2><p>Capture the front and back, confirm the details, then save it to your portfolio or watchlist. Market analysis is optional afterward.</p></div>

        <div className="cs-photo-pair">
          <label className="cs-photo-slot"><input type="file" accept="image/*" capture="environment" onChange={e=>readImage(e,setFront)} />{front?<img src={front} alt="Front of card"/>:<><img src="/assets/cropped/icons/action-camera.png" alt=""/><b>FRONT PHOTO</b><small>Take photo or upload</small></>}</label>
          <label className="cs-photo-slot"><input type="file" accept="image/*" capture="environment" onChange={e=>readImage(e,setBack)} />{back?<img src={back} alt="Back of card"/>:<><img src="/assets/cropped/icons/action-camera.png" alt=""/><b>BACK PHOTO</b><small>Card # and set details often live here</small></>}</label>
        </div>

        <div className="cs-identify-placeholder"><div><span>PHOTO IDENTIFICATION</span><b>{front||back?"Photos saved — auto-identification is next":"Add front/back photos now"}</b><small>For this build, photos are stored with the card. Automatic image recognition will populate these fields in the next pass.</small></div><button type="button" onClick={()=>setManualOpen(v=>!v)}>{manualOpen?"HIDE LOOKUP":"SEARCH / ENTER MANUALLY"}</button></div>

        {manualOpen&&<div className="cs-manual-block">
          <label className="cs-search-label"><span>FIND CARD IN TCDB</span><input value={lookup} onChange={e=>{setLookup(e.target.value);setSelected(null);}} placeholder="Start typing player, year, set..." autoComplete="off"/></label>
          {!selected&&(suggesting||suggestions.length>0)&&<div className="cs-add-suggestions"><div>{suggesting?"SEARCHING TCDB…":"POSSIBLE CARDS — SELECT ONE TO FILL THE FORM"}</div>{suggestions.map((id,i)=><button type="button" key={`${id.url}-${i}`} onClick={()=>choose(id)}><strong>{id.playerName||"Unknown player"}</strong><span>{label(id)}</span><small>{[id.manufacturer,id.sport].filter(Boolean).join(" · ")}</small></button>)}</div>}
          {selected&&<div className="cs-add-locked"><span>SELECTED</span><b>{selected.playerName} · {label(selected)}</b><button type="button" onClick={()=>setSelected(null)}>CHANGE</button></div>}
        </div>}

        <div className="cs-fields cs-collection-fields">
          <label><span>PLAYER / CARD NAME *</span><input required value={form.player} onChange={e=>setForm({...form,player:e.target.value})} placeholder="Shohei Ohtani"/></label>
          <div className="cs-two"><label><span>YEAR / SET</span><input value={form.yearSet} onChange={e=>setForm({...form,yearSet:e.target.value})} placeholder="2024 Topps Chrome"/></label><label><span>CARD #</span><input value={form.cardNumber} onChange={e=>setForm({...form,cardNumber:e.target.value})} placeholder="1"/></label></div>
          <label><span>VARIANT / PARALLEL</span><input value={form.variant} onChange={e=>setForm({...form,variant:e.target.value})} placeholder="Refractor, Silver, Auto..."/></label>
          <div className="cs-three"><label><span>GRADER</span><select value={form.gradingCompany} onChange={e=>setForm({...form,gradingCompany:e.target.value})}><option>PSA</option><option>SGC</option><option>BGS</option><option>CGC</option><option>Raw</option></select></label><label><span>GRADE</span><input value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} placeholder="10" disabled={form.gradingCompany==="Raw"}/></label><label><span>CERT #</span><input value={form.cert} onChange={e=>setForm({...form,cert:e.target.value})} placeholder="Optional" disabled={form.gradingCompany==="Raw"}/></label></div>
        </div>

        <div className="cs-mode-row"><button type="button" className={form.mode==="owned"?"selected":""} onClick={()=>setForm({...form,mode:"owned"})}><b>I own this</b><small>Add it to portfolio</small></button><button type="button" className={form.mode==="watching"?"selected":""} onClick={()=>setForm({...form,mode:"watching"})}><b>I&apos;m watching this</b><small>Add it to watchlist</small></button></div>
        {form.mode==="owned"&&<label className="cs-price"><span>PURCHASE PRICE</span><div><b>$</b><input inputMode="decimal" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})} placeholder="0.00"/></div></label>}
        <div className="cs-save-row"><button type="submit" className="cs-primary">＋ ADD TO COLLECTION</button><small>You can run Live Comps or Analyze Now from the saved card later.</small></div>
      </form>
    </section>
    <style jsx global>{`
      .cs-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:22px;background:rgba(0,7,12,.78);backdrop-filter:blur(12px)}
      .cs-modal{position:relative;width:min(980px,96vw);max-height:92vh;overflow:auto;border:1px solid rgba(76,211,255,.23);border-radius:20px;background:linear-gradient(155deg,#081c2d,#04111d 58%,#061823);box-shadow:0 40px 110px rgba(0,0,0,.68);padding:30px;color:#effaff}.cs-close{position:absolute;right:18px;top:15px;width:34px;height:34px;border:1px solid rgba(100,187,226,.15);border-radius:9px;background:#071724;color:#86a6b8;font-size:24px;cursor:pointer;z-index:3}.cs-modal-header>span{color:#51d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-modal-header h2{margin:7px 0 6px;font-size:30px}.cs-modal-header p{margin:0 0 20px;color:#7695a8;font-size:12px;max-width:760px;line-height:1.5}
      .cs-photo-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cs-photo-slot{min-height:220px;border:1px dashed rgba(73,210,255,.28);border-radius:14px;background:radial-gradient(circle at 50% 38%,rgba(48,198,255,.1),rgba(3,14,23,.45));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;overflow:hidden}.cs-photo-slot input{display:none}.cs-photo-slot>img:not([src*='action-camera']){width:100%;height:220px;object-fit:contain}.cs-photo-slot>img[src*='action-camera']{width:54px;height:54px}.cs-photo-slot b{font-size:12px}.cs-photo-slot small{color:#6d8c9d;font-size:9px}
      .cs-identify-placeholder{display:flex;justify-content:space-between;gap:18px;align-items:center;margin:16px 0;padding:13px 14px;border:1px solid rgba(84,194,232,.14);border-radius:11px;background:rgba(6,24,38,.7)}.cs-identify-placeholder span{display:block;color:#59ddff;font-size:8px;font-weight:900;letter-spacing:.13em}.cs-identify-placeholder b{display:block;margin-top:4px;font-size:11px}.cs-identify-placeholder small{display:block;margin-top:3px;color:#6c899a;font-size:9px}.cs-identify-placeholder button{height:36px;border:1px solid rgba(85,208,248,.24);border-radius:8px;background:#071724;color:#9de9ff;font-size:9px;font-weight:900;padding:0 14px;cursor:pointer}
      .cs-manual-block{position:relative;margin-bottom:16px}.cs-search-label span,.cs-fields label>span,.cs-price>span{display:block;margin-bottom:6px;color:#7798aa;font-size:9px;font-weight:900;letter-spacing:.13em}.cs-search-label input,.cs-fields input,.cs-fields select,.cs-price input{width:100%;height:42px;border:1px solid rgba(88,190,232,.16);border-radius:9px;background:#06131f;color:#eaf8ff;padding:0 12px;outline:none}.cs-add-suggestions{position:absolute;z-index:20;left:0;right:0;top:66px;max-height:340px;overflow:auto;border:1px solid rgba(75,207,255,.28);border-radius:10px;background:#061522;box-shadow:0 20px 60px rgba(0,0,0,.72)}.cs-add-suggestions>div{position:sticky;top:0;padding:10px 12px;background:#061522;color:#5fe0ff;font-size:8px;font-weight:900;letter-spacing:.12em;border-bottom:1px solid rgba(80,190,229,.12)}.cs-add-suggestions button{display:block;width:100%;padding:11px 12px;border:0;border-bottom:1px solid rgba(80,190,229,.08);background:transparent;color:#e9f9ff;text-align:left;cursor:pointer}.cs-add-suggestions button:hover{background:rgba(47,208,143,.08)}.cs-add-suggestions strong,.cs-add-suggestions span,.cs-add-suggestions small{display:block}.cs-add-suggestions span{margin-top:3px;color:#9cb5c2;font-size:9px}.cs-add-suggestions small{margin-top:3px;color:#5e7e90;font-size:8px}.cs-add-locked{display:flex;align-items:center;gap:8px;margin-top:7px;padding:9px 10px;border:1px solid rgba(62,241,154,.2);border-radius:8px;background:rgba(35,173,108,.07)}.cs-add-locked span{color:#5ceca5;font-size:8px;font-weight:900}.cs-add-locked b{flex:1;font-size:9px}.cs-add-locked button{border:0;background:none;color:#6edfff;font-size:8px;cursor:pointer}
      .cs-collection-fields{display:flex;flex-direction:column;gap:12px}.cs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-three{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:12px}.cs-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0 14px}.cs-mode-row button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;border:1px solid rgba(88,190,232,.14);border-radius:11px;background:#06131f;color:#dbeef7;padding:13px 15px;cursor:pointer}.cs-mode-row button.selected{border-color:rgba(68,244,157,.45);background:rgba(34,181,111,.09)}.cs-mode-row small{color:#6e8fa2;font-size:10px}.cs-price{max-width:230px;margin-bottom:14px}.cs-price>div{display:flex;align-items:center;border:1px solid rgba(88,190,232,.16);border-radius:9px;background:#06131f;padding-left:12px}.cs-price input{border:0;background:transparent}.cs-save-row{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:14px;align-items:center}.cs-primary{height:44px;border-radius:9px;font-weight:900;font-size:10px;letter-spacing:.11em;cursor:pointer;width:100%;border:1px solid rgba(62,242,154,.5);background:linear-gradient(180deg,rgba(42,223,134,.22),rgba(11,91,59,.24));color:#c7ffe0}.cs-save-row small{color:#6c8998;font-size:9px}
      @media(max-width:720px){.cs-modal{padding:22px 16px}.cs-photo-pair,.cs-two,.cs-three,.cs-mode-row,.cs-save-row{grid-template-columns:1fr}.cs-identify-placeholder{align-items:flex-start;flex-direction:column}.cs-photo-slot{min-height:180px}}
    `}</style>
  </div>;
}
