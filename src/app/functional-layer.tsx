"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type FormState = {
  player: string;
  yearSet: string;
  cardNumber: string;
  variant: string;
  gradingCompany: string;
  grade: string;
  mode: "owned" | "watching";
  purchasePrice: string;
};

type AnalysisResult = {
  score: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  confidence: "HIGH" | "MEDIUM";
  marketValue: number;
  change7d: number;
  insight: string;
};

const initialForm: FormState = {
  player: "",
  yearSet: "",
  cardNumber: "",
  variant: "",
  gradingCompany: "PSA",
  grade: "10",
  mode: "watching",
  purchasePrice: "",
};

const scanSteps = [
  "Matching card identity",
  "Checking recent sales",
  "Checking active listings",
  "Measuring buyer demand",
  "Calculating momentum",
];

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function analyzeCard(form: FormState): AnalysisResult {
  const seed = hashText(`${form.player}|${form.yearSet}|${form.variant}|${form.grade}`);
  const score = 44 + (seed % 49);
  const recommendation: AnalysisResult["recommendation"] = score >= 75 ? "BUY" : score <= 55 ? "SELL" : "HOLD";
  const confidence: AnalysisResult["confidence"] = score >= 82 || score <= 50 ? "HIGH" : "MEDIUM";
  const marketValue = Math.round((42 + (seed % 490) + ((seed >> 5) % 100) / 100) * 100) / 100;
  const rawChange = ((seed % 181) - 70) / 10;
  const change7d = recommendation === "BUY" ? Math.abs(rawChange) + 2.4 : recommendation === "SELL" ? -Math.abs(rawChange) - 1.8 : rawChange / 3;
  const insight = recommendation === "BUY"
    ? "Sales are clearing faster while available inventory is tightening. Buyer activity is running ahead of the current price curve."
    : recommendation === "SELL"
      ? "Active supply is expanding faster than demand and recent sale prices are beginning to soften. Exit risk is elevated."
      : "Price and demand are balanced. There is movement, but not enough confirmation yet for a strong entry or exit signal.";

  return { score, recommendation, confidence, marketValue, change7d: Math.round(change7d * 10) / 10, insight };
}

export default function FunctionalLayer() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"form" | "scan" | "result">("form");
  const [form, setForm] = useState<FormState>(initialForm);
  const [scanIndex, setScanIndex] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const addButton = document.querySelector<HTMLButtonElement>(".add-card");
    const openModal = (event: Event) => {
      event.preventDefault();
      setOpen(true);
      setStage("form");
    };
    addButton?.addEventListener("click", openModal);

    const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".nav-tabs button"));
    const handlers = navButtons.map((button) => {
      const handler = () => {
        navButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        const text = button.textContent?.trim();
        const target = text === "Buy Radar" || text === "Sell Radar" || text === "Watchlist"
          ? document.querySelector(".triple-grid")
          : text === "Portfolio" || text === "Alerts"
            ? document.querySelector(".bottom-grid")
            : document.querySelector(".dashboard-wrap");
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      button.addEventListener("click", handler);
      return { button, handler };
    });

    return () => {
      addButton?.removeEventListener("click", openModal);
      handlers.forEach(({ button, handler }) => button.removeEventListener("click", handler));
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (stage !== "scan") return;
    if (scanIndex >= scanSteps.length) {
      const computed = analyzeCard(form);
      setResult(computed);
      setStage("result");
      return;
    }
    const timer = window.setTimeout(() => setScanIndex((value) => value + 1), 620);
    return () => window.clearTimeout(timer);
  }, [stage, scanIndex, form]);

  const cardMeta = useMemo(() => {
    return [form.yearSet, form.cardNumber && `#${form.cardNumber}`, form.variant, form.gradingCompany && form.grade && `${form.gradingCompany} ${form.grade}`]
      .filter(Boolean)
      .join(" · ");
  }, [form]);

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.player.trim()) return;
    setScanIndex(0);
    setResult(null);
    setStage("scan");
  };

  const saveCard = () => {
    if (!result) return;
    const payload = {
      id: Date.now(),
      player: form.player.trim(),
      meta: cardMeta || "Unspecified card",
      score: result.score,
      move: `${result.change7d >= 0 ? "+" : ""}${result.change7d}%`,
      tone: result.recommendation === "BUY" ? "buy" : result.recommendation === "SELL" ? "sell" : "hold",
      mode: form.mode,
      marketValue: result.marketValue,
    };
    const previous = JSON.parse(localStorage.getItem("cardsignal-added-cards") || "[]");
    localStorage.setItem("cardsignal-added-cards", JSON.stringify([payload, ...previous].slice(0, 25)));

    const watchPanel = document.querySelector<HTMLElement>(".triple-grid .radar-panel:nth-child(3)");
    if (watchPanel) {
      const row = document.createElement("div");
      row.className = "signal-row cs-added-row";
      const initials = form.player.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      row.innerHTML = `<div class="mini-card mini-${payload.tone}"><span>${initials}</span><i></i></div><div class="signal-copy"><strong>${form.player.replace(/[<>]/g, "")}</strong><span>${payload.meta.replace(/[<>]/g, "")}</span></div><div class="score-pill ${payload.tone}"><b>${result.score}</b><small>${payload.move}</small></div>`;
      const firstExistingRow = watchPanel.querySelector(".signal-row");
      if (firstExistingRow) watchPanel.insertBefore(row, firstExistingRow);
      else watchPanel.appendChild(row);
    }

    const watchingStat = document.querySelector<HTMLElement>(".stat-card:nth-child(2) .stat-copy > strong");
    if (watchingStat) {
      const current = Number.parseInt(watchingStat.textContent || "14", 10) || 14;
      watchingStat.innerHTML = `${current + 1} <b>cards</b>`;
    }

    setOpen(false);
    setStage("form");
    setForm(initialForm);
    setPreview(null);
  };

  if (!open) return null;

  return (
    <div className="cs-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="cs-modal" role="dialog" aria-modal="true" aria-label="Add Card">
        <button className="cs-close" onClick={() => setOpen(false)} aria-label="Close">×</button>

        {stage === "form" && (
          <form onSubmit={submit}>
            <div className="cs-modal-header">
              <span>ADD TO CARDSIGNAL</span>
              <h2>Track a card</h2>
              <p>Upload the card or enter the details manually. We&apos;ll create an initial market signal for the prototype.</p>
            </div>

            <div className="cs-form-grid">
              <label className="cs-upload">
                <input type="file" accept="image/*" onChange={handleImage} />
                {preview ? <img src={preview} alt="Card preview" /> : <><img src="/assets/cropped/icons/action-camera.png" alt="" /><b>Upload card photo</b><small>JPG or PNG</small></>}
              </label>

              <div className="cs-fields">
                <label><span>PLAYER / CARD NAME *</span><input required value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })} placeholder="e.g. Jackson Holliday" /></label>
                <div className="cs-two"><label><span>YEAR / SET</span><input value={form.yearSet} onChange={(e) => setForm({ ...form, yearSet: e.target.value })} placeholder="2024 Topps Chrome" /></label><label><span>CARD #</span><input value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} placeholder="172" /></label></div>
                <label><span>VARIANT</span><input value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} placeholder="Refractor, Silver, Auto..." /></label>
                <div className="cs-two"><label><span>GRADING COMPANY</span><select value={form.gradingCompany} onChange={(e) => setForm({ ...form, gradingCompany: e.target.value })}><option>PSA</option><option>SGC</option><option>BGS</option><option>CGC</option><option>Raw</option></select></label><label><span>GRADE</span><input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="10" /></label></div>
              </div>
            </div>

            <div className="cs-mode-row">
              <button type="button" className={form.mode === "owned" ? "selected" : ""} onClick={() => setForm({ ...form, mode: "owned" })}><b>I own this</b><small>Track portfolio value & profit</small></button>
              <button type="button" className={form.mode === "watching" ? "selected" : ""} onClick={() => setForm({ ...form, mode: "watching" })}><b>I&apos;m watching this</b><small>Track movement before buying</small></button>
            </div>

            {form.mode === "owned" && <label className="cs-price"><span>PURCHASE PRICE</span><div><b>$</b><input inputMode="decimal" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" /></div></label>}

            <button className="cs-primary" type="submit"><img src="/assets/cropped/icons/action-search.png" alt="" /> ANALYZE CARD</button>
          </form>
        )}

        {stage === "scan" && (
          <div className="cs-scan-screen">
            <div className="cs-scanner">
              <img className="cs-scan-frame" src="/assets/cropped/scan/scan-card-frame.png" alt="" />
              {preview ? <img className="cs-scan-preview" src={preview} alt="Card being scanned" /> : <div className="cs-scan-placeholder">{form.player.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</div>}
              <div className="cs-laser" />
            </div>
            <span className="cs-kicker">CARDSIGNAL ANALYSIS</span>
            <h2>Scanning market…</h2>
            <p>{form.player}</p>
            <div className="cs-progress"><i style={{ width: `${Math.min(100, (scanIndex / scanSteps.length) * 100)}%` }} /></div>
            <div className="cs-steps">{scanSteps.map((step, index) => <div key={step} className={index < scanIndex ? "done" : index === scanIndex ? "active" : ""}><span>{index < scanIndex ? "✓" : index === scanIndex ? "●" : "○"}</span>{step}</div>)}</div>
          </div>
        )}

        {stage === "result" && result && (
          <div className="cs-result">
            <span className="cs-kicker">INITIAL SIGNAL</span>
            <h2>{form.player}</h2>
            <p className="cs-result-meta">{cardMeta || "Card details entered manually"}</p>
            <div className="cs-result-grid">
              <div className="cs-score"><small>MOMENTUM SCORE</small><strong>{result.score}</strong><span className={result.recommendation.toLowerCase()}>{result.recommendation}</span></div>
              <div className="cs-market"><small>EST. MARKET</small><strong>${result.marketValue.toFixed(2)}</strong><span className={result.change7d >= 0 ? "positive" : "negative"}>{result.change7d >= 0 ? "+" : ""}{result.change7d}% / 7D</span><em>{result.confidence} CONFIDENCE</em></div>
            </div>
            <div className="cs-result-insight"><b>WHY</b><p>{result.insight}</p></div>
            <div className="cs-result-actions"><button className="cs-secondary" onClick={() => setStage("form")}>EDIT DETAILS</button><button className="cs-primary" onClick={saveCard}>ADD TO DASHBOARD</button></div>
          </div>
        )}
      </section>

      <style jsx global>{`
        .cs-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:22px;background:rgba(0,7,12,.76);backdrop-filter:blur(12px)}
        .cs-modal{position:relative;width:min(900px,96vw);max-height:92vh;overflow:auto;border:1px solid rgba(76,211,255,.23);border-radius:20px;background:linear-gradient(155deg,#081c2d 0%,#04111d 58%,#061823 100%);box-shadow:0 40px 110px rgba(0,0,0,.68),0 0 0 1px rgba(61,241,157,.04);padding:30px;color:#effaff}
        .cs-modal:before{content:"";position:absolute;left:0;top:0;width:220px;height:2px;background:linear-gradient(90deg,#45f39c,transparent);box-shadow:0 0 16px rgba(69,243,156,.7)}
        .cs-close{position:absolute;right:18px;top:15px;width:34px;height:34px;border:1px solid rgba(100,187,226,.15);border-radius:9px;background:#071724;color:#86a6b8;font-size:24px;cursor:pointer;z-index:2}
        .cs-modal-header>span,.cs-kicker{color:#51d9ff;font-size:10px;font-weight:900;letter-spacing:.18em}.cs-modal-header h2,.cs-result h2,.cs-scan-screen h2{margin:7px 0 6px;font-size:30px;letter-spacing:-.04em}.cs-modal-header p,.cs-scan-screen>p,.cs-result-meta{margin:0 0 22px;color:#7695a8;font-size:12px}
        .cs-form-grid{display:grid;grid-template-columns:255px 1fr;gap:24px}.cs-upload{min-height:336px;border:1px dashed rgba(73,210,255,.3);border-radius:14px;background:radial-gradient(circle at 50% 38%,rgba(48,198,255,.12),rgba(3,14,23,.45));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;cursor:pointer;overflow:hidden}.cs-upload input{display:none}.cs-upload>img{max-width:100%;max-height:336px;object-fit:contain}.cs-upload>img[src*="action-camera"]{width:62px;height:62px;object-fit:contain}.cs-upload b{font-size:13px}.cs-upload small{color:#68889a;font-size:10px}
        .cs-fields{display:flex;flex-direction:column;gap:13px}.cs-fields label,.cs-price{display:block}.cs-fields label>span,.cs-price>span{display:block;margin-bottom:6px;color:#7798aa;font-size:9px;font-weight:900;letter-spacing:.13em}.cs-fields input,.cs-fields select,.cs-price input{width:100%;height:42px;border:1px solid rgba(88,190,232,.16);border-radius:9px;background:#06131f;color:#eaf8ff;padding:0 12px;outline:none}.cs-fields input:focus,.cs-fields select:focus,.cs-price input:focus{border-color:rgba(72,216,255,.48);box-shadow:0 0 0 3px rgba(72,216,255,.06)}.cs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cs-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0 14px}.cs-mode-row button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;border:1px solid rgba(88,190,232,.14);border-radius:11px;background:#06131f;color:#dbeef7;padding:13px 15px;cursor:pointer}.cs-mode-row button.selected{border-color:rgba(68,244,157,.45);background:rgba(34,181,111,.09);box-shadow:inset 0 0 24px rgba(47,230,142,.04)}.cs-mode-row small{color:#6e8fa2;font-size:10px}.cs-price{max-width:230px;margin-bottom:14px}.cs-price>div{display:flex;align-items:center;border:1px solid rgba(88,190,232,.16);border-radius:9px;background:#06131f;padding-left:12px}.cs-price>div b{color:#6e91a4}.cs-price input{border:0;background:transparent}
        .cs-primary,.cs-secondary{height:44px;border-radius:9px;font-weight:900;font-size:10px;letter-spacing:.11em;cursor:pointer}.cs-primary{width:100%;border:1px solid rgba(62,242,154,.5);background:linear-gradient(180deg,rgba(42,223,134,.22),rgba(11,91,59,.24));color:#c7ffe0}.cs-primary img{width:22px;height:22px;vertical-align:middle;margin-right:7px}.cs-secondary{border:1px solid rgba(91,190,231,.2);background:#071724;color:#91adbd;padding:0 20px}
        .cs-scan-screen{text-align:center;padding:12px 30px 16px}.cs-scanner{position:relative;width:235px;height:285px;margin:4px auto 19px;display:grid;place-items:center}.cs-scan-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:3;pointer-events:none}.cs-scan-preview{width:154px;height:218px;object-fit:cover;border-radius:10px;opacity:.74}.cs-scan-placeholder{width:154px;height:218px;display:grid;place-items:center;border-radius:10px;background:radial-gradient(circle,#17405a,#06121d 68%);color:#dff7ff;font-size:44px;font-weight:900}.cs-laser{position:absolute;left:43px;right:43px;height:2px;background:#51f5a0;box-shadow:0 0 14px #51f5a0;z-index:5;animation:csScan 1.5s ease-in-out infinite}@keyframes csScan{0%,100%{top:52px}50%{top:230px}}.cs-progress{height:7px;max-width:560px;margin:16px auto 17px;border-radius:10px;background:#07131d;border:1px solid rgba(70,188,226,.11);overflow:hidden}.cs-progress i{display:block;height:100%;background:linear-gradient(90deg,#17a9cc,#48f29c);transition:width .35s ease;box-shadow:0 0 14px rgba(70,240,163,.35)}.cs-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:720px;margin:auto}.cs-steps div{color:#58788c;font-size:9px;line-height:1.35}.cs-steps span{display:block;margin-bottom:4px}.cs-steps .active{color:#67dfff}.cs-steps .done{color:#60eba4}
        .cs-result{padding:8px 4px}.cs-result-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:22px 0}.cs-score,.cs-market{min-height:168px;border:1px solid rgba(84,194,232,.15);border-radius:14px;background:linear-gradient(145deg,rgba(8,29,46,.88),rgba(3,14,24,.9));padding:20px}.cs-score small,.cs-market small{display:block;color:#7190a3;font-size:9px;font-weight:900;letter-spacing:.14em}.cs-score strong{display:block;font-size:72px;line-height:1;margin:10px 0;color:#effcff}.cs-score span{display:inline-block;padding:6px 10px;border-radius:7px;font-size:11px;font-weight:900}.cs-score .buy{color:#65f4aa;border:1px solid rgba(69,240,157,.33);background:rgba(54,219,139,.08)}.cs-score .sell{color:#ff7080;border:1px solid rgba(255,91,111,.33);background:rgba(219,54,75,.08)}.cs-score .hold{color:#67dfff;border:1px solid rgba(68,205,255,.3);background:rgba(54,163,219,.08)}.cs-market strong{display:block;margin:13px 0 7px;font-size:31px}.cs-market>span{display:block;font-size:12px}.cs-market em{display:inline-block;margin-top:18px;color:#84a3b3;font-size:9px;font-style:normal;letter-spacing:.1em}.cs-result-insight{border:1px solid rgba(77,204,246,.16);border-radius:11px;background:rgba(16,74,101,.12);padding:14px}.cs-result-insight b{color:#55d8ff;font-size:9px;letter-spacing:.13em}.cs-result-insight p{margin:7px 0 0;color:#9bb6c5;font-size:12px;line-height:1.55}.cs-result-actions{display:grid;grid-template-columns:auto 1fr;gap:10px;margin-top:16px}
        .cs-added-row{animation:csAdded .5s ease}@keyframes csAdded{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
        @media(max-width:720px){.cs-modal{padding:22px 16px}.cs-form-grid{grid-template-columns:1fr}.cs-upload{min-height:210px}.cs-two,.cs-result-grid,.cs-mode-row{grid-template-columns:1fr}.cs-steps{grid-template-columns:1fr;text-align:left}.cs-result-actions{grid-template-columns:1fr}.cs-secondary{width:100%}}
      `}</style>
    </div>
  );
}
