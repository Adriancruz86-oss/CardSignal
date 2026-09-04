"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createWorker } from "tesseract.js";

type Clues = {
  player?: string;
  year?: string;
  manufacturer?: string;
  cardNumber?: string;
  serial?: string;
  rawText?: string;
  playerConfidence?: "high" | "medium" | "low";
  yearConfidence?: "high" | "medium" | "low";
  cardNumberConfidence?: "high" | "medium" | "low";
};

const NAME_EXCLUDES = new Set([
  "TOPPS", "BOWMAN", "PANINI", "DONRUSS", "BASEBALL", "FOOTBALL", "BASKETBALL",
  "PITCHER", "HITTER", "ROOKIE", "CARD", "CARDS", "PLAYER", "PLAYERS", "CHROME",
  "REFRACTOR", "REFRACTORS", "PRIZM", "OPTIC", "SELECT", "MOSAIC", "COPYRIGHT",
  "INC", "LLC", "USA", "MADE IN USA", "MAJOR LEAGUE BASEBALL", "LOS ANGELES DODGERS"
]);

function lines(text: string) {
  return text.split(/\r?\n/).map((v) => v.replace(/[^A-Za-z0-9#/'&.\- ]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function titleCase(v: string) {
  return v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function upperRatio(v: string) {
  const letters = v.replace(/[^A-Za-z]/g, "");
  if (!letters) return 0;
  return [...letters].filter((c) => c === c.toUpperCase()).length / letters.length;
}

function normalizeName(v: string) {
  return v.toUpperCase().replace(/[^A-Z' .-]/g, " ").replace(/\s+/g, " ").trim();
}

function nameCandidates(text: string) {
  return lines(text).filter((v) => {
    const words = v.split(" ");
    if (words.length < 2 || words.length > 4 || v.length < 6 || v.length > 34) return false;
    if (/\d/.test(v) || upperRatio(v) < 0.68) return false;
    const normalized = normalizeName(v);
    if (NAME_EXCLUDES.has(normalized)) return false;
    if ([...NAME_EXCLUDES].some((x) => normalized.includes(x) && x.length > 7)) return false;
    return words.every((w) => /^[A-Za-z'.-]+$/.test(w));
  });
}

function findPlayer(front: string, back: string, frontBottom: string, backTop: string) {
  const weighted: { value: string; weight: number }[] = [];
  for (const value of nameCandidates(front)) weighted.push({ value, weight: 2 });
  for (const value of nameCandidates(back)) weighted.push({ value, weight: 2 });
  for (const value of nameCandidates(frontBottom)) weighted.push({ value, weight: 4 });
  for (const value of nameCandidates(backTop)) weighted.push({ value, weight: 5 });

  const scores = new Map<string, { score: number; displays: string[] }>();
  for (const item of weighted) {
    const key = normalizeName(item.value);
    const current = scores.get(key) || { score: 0, displays: [] };
    current.score += item.weight;
    current.displays.push(item.value);
    scores.set(key, current);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score || a[0].length - b[0].length);
  const best = ranked[0];
  if (!best) return { value: "", confidence: "low" as const };
  const confidence = best[1].score >= 7 ? "high" : best[1].score >= 4 ? "medium" : "low";
  return { value: titleCase(best[0]), confidence };
}

function findCardNumber(back: string, backTop: string) {
  const targeted = lines(backTop).slice(0, 8);
  for (const value of targeted) {
    const direct = value.match(/^#?\s*([A-Z0-9-]{1,8})$/i)?.[1] || "";
    if (!direct) continue;
    if (/^(19|20)\d{2}$/.test(direct)) continue;
    if (/^\d{1,3}$/.test(direct) || /[A-Za-z]/.test(direct)) return { value: direct, confidence: "high" as const };
  }
  const all = `${backTop}\n${back}`;
  const labeled = all.match(/(?:card\s*(?:no\.?|#)|#)\s*([A-Z0-9-]{1,10})/i)?.[1] || "";
  if (labeled) return { value: labeled, confidence: "high" as const };
  for (const value of lines(back).slice(0, 15)) {
    const direct = value.match(/^#?\s*([A-Z0-9-]{1,8})$/i)?.[1] || "";
    if (direct && !/^(19|20)\d{2}$/.test(direct)) return { value: direct, confidence: "medium" as const };
  }
  return { value: "", confidence: "low" as const };
}

function findYear(combined: string, backBottom: string) {
  const targetedYears = [...backBottom.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]);
  const allYears = [...combined.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]);
  const currentYear = new Date().getFullYear() + 1;
  const valid = (arr: string[]) => arr.map(Number).filter((y) => y >= 1950 && y <= currentYear);
  const targeted = valid(targetedYears);
  if (targeted.length) {
    const counts = new Map<number, number>();
    targeted.forEach((y) => counts.set(y, (counts.get(y) || 0) + 1));
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    return { value: String(ranked[0][0]), confidence: ranked[0][1] >= 2 ? "high" as const : "medium" as const };
  }
  const fallback = valid(allYears);
  return fallback.length ? { value: String(Math.max(...fallback)), confidence: "low" as const } : { value: "", confidence: "low" as const };
}

function extractClues(front: string, back: string, frontBottom: string, backTop: string, backBottom: string): Clues {
  const combined = `${front}\n${back}\n${frontBottom}\n${backTop}\n${backBottom}`;
  const player = findPlayer(front, back, frontBottom, backTop);
  const number = findCardNumber(back, backTop);
  const year = findYear(combined, backBottom);
  const serialMatches = [...`${front}\n${frontBottom}`.matchAll(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/g)];
  const serialMatch = serialMatches.sort((a, b) => Number(a[2]) - Number(b[2]))[0];
  const serial = serialMatch ? `${serialMatch[1]}/${serialMatch[2]}` : "";
  const brandMatch = combined.match(/\b(Topps|Bowman|Panini|Upper Deck|Donruss|Leaf|Fleer|Score)\b/i)?.[1] || "";
  return {
    player: player.value,
    playerConfidence: player.confidence,
    year: year.value,
    yearConfidence: year.confidence,
    manufacturer: brandMatch ? titleCase(brandMatch) : "",
    cardNumber: number.value,
    cardNumberConfidence: number.confidence,
    serial,
    rawText: combined,
  };
}

function setReactInput(el: HTMLInputElement | null, value: string) {
  if (!el || !value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

async function cropAndEnhance(file: File, x: number, y: number, w: number, h: number) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Could not preprocess card image"));
      node.src = url;
    });
    const sx = Math.round(img.width * x), sy = Math.round(img.height * y);
    const sw = Math.max(1, Math.round(img.width * w)), sh = Math.max(1, Math.round(img.height * h));
    const scale = Math.max(2, Math.min(4, 1800 / Math.max(sw, sh)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not preprocess card image");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const boosted = gray > 160 ? 255 : gray < 80 ? 0 : Math.max(0, Math.min(255, (gray - 128) * 1.7 + 128));
      d[i] = d[i + 1] = d[i + 2] = boosted;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoOcrFallbackLayer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [clues, setClues] = useState<Clues | null>(null);

  useEffect(() => {
    const evaluate = () => {
      const actions = document.querySelector<HTMLElement>(".cs-photo-actions");
      const error = document.querySelector<HTMLElement>(".cs-identify-error");
      const text = error?.textContent?.toLowerCase() || "";
      setTarget(actions);
      setVisible(Boolean(actions && error && (text.includes("catalog") || text.includes("could not match") || text.includes("detected the trading card"))));
    };
    evaluate();
    const observer = new MutationObserver(evaluate);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const runOcr = async () => {
    const files = Array.from(document.querySelectorAll<HTMLInputElement>(".cs-photo-slot input[type='file']"));
    const front = files[0]?.files?.[0];
    const back = files[1]?.files?.[0];
    if (!front) return;

    setWorking(true);
    setStatus("Preparing targeted card regions…");
    setClues(null);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      const frontBottom = await cropAndEnhance(front, 0.05, 0.64, 0.90, 0.34);
      const backTop = back ? await cropAndEnhance(back, 0.05, 0.00, 0.90, 0.34) : null;
      const backBottom = back ? await cropAndEnhance(back, 0.03, 0.68, 0.94, 0.31) : null;

      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") setStatus(`Reading targeted card text… ${Math.round(m.progress * 100)}%`);
        },
      });

      await worker.setParameters({ preserve_interword_spaces: "1" });
      const frontResult = await worker.recognize(front);
      const frontBottomResult = await worker.recognize(frontBottom);
      const backResult = back ? await worker.recognize(back) : null;
      const backTopResult = backTop ? await worker.recognize(backTop) : null;
      const backBottomResult = backBottom ? await worker.recognize(backBottom) : null;

      const next = extractClues(
        frontResult.data.text || "",
        backResult?.data.text || "",
        frontBottomResult.data.text || "",
        backTopResult?.data.text || "",
        backBottomResult?.data.text || "",
      );
      setClues(next);

      const fieldInputs = Array.from(document.querySelectorAll<HTMLInputElement>(".cs-collection-fields input"));
      if (next.player && next.playerConfidence === "high") setReactInput(fieldInputs[0] || null, next.player);
      if (next.cardNumber && next.cardNumberConfidence !== "low") setReactInput(fieldInputs[2] || null, next.cardNumber);
      if (next.serial) setReactInput(fieldInputs[3] || null, `/${next.serial.split("/")[1]}`);

      const trustedPlayer = next.playerConfidence === "high" ? next.player : "";
      const trustedYear = next.yearConfidence !== "low" ? next.year : "";
      const trustedNumber = next.cardNumberConfidence !== "low" ? next.cardNumber : "";
      const query = [trustedPlayer, trustedYear, next.manufacturer, trustedNumber ? `#${trustedNumber}` : ""].filter(Boolean).join(" ");
      if (query) setReactInput(document.querySelector<HTMLInputElement>(".cs-add-search"), query);
      setStatus(query ? "Better clues extracted — checking TCDB for likely matches…" : "OCR finished. Low-confidence guesses were not written into your card fields.");
    } catch (error) {
      setStatus(error instanceof Error ? `OCR failed: ${error.message}` : "OCR failed");
    } finally {
      await worker?.terminate();
      setWorking(false);
    }
  };

  if (!visible || !target) return null;

  return createPortal(
    <div className="cs-ocr-fallback">
      <div className="cs-ocr-fallback-head"><span>LOCAL OCR FALLBACK</span><b>Read the card instead of giving up</b></div>
      <button type="button" onClick={runOcr} disabled={working}>{working ? "READING TARGETED REGIONS…" : "READ FRONT + BACK"}</button>
      <small>Runs locally. CardSignal now checks the name strip, back header/card number, copyright area and serial numbering separately instead of trusting one full-card OCR pass.</small>
      {status && <div className="cs-ocr-status">{status}</div>}
      {clues && <div className="cs-ocr-clues">
        {clues.player && <span className={`q-${clues.playerConfidence}`}>PLAYER <b>{clues.player}</b><i>{clues.playerConfidence}</i></span>}
        {clues.cardNumber && <span className={`q-${clues.cardNumberConfidence}`}>CARD # <b>{clues.cardNumber}</b><i>{clues.cardNumberConfidence}</i></span>}
        {clues.year && <span className={`q-${clues.yearConfidence}`}>YEAR <b>{clues.year}</b><i>{clues.yearConfidence}</i></span>}
        {clues.manufacturer && <span>BRAND <b>{clues.manufacturer}</b></span>}
        {clues.serial && <span className="q-high">SERIAL <b>{clues.serial}</b><i>high</i></span>}
      </div>}
      <style jsx global>{`
        .cs-ocr-fallback{margin-top:10px;padding:12px;border:1px solid rgba(255,193,92,.26);border-radius:9px;background:rgba(145,92,18,.08)}
        .cs-ocr-fallback-head span{display:block;color:#ffc66f;font-size:7px;font-weight:900;letter-spacing:.13em}.cs-ocr-fallback-head b{display:block;margin:4px 0 9px;color:#f5dfba;font-size:10px}.cs-ocr-fallback>button{width:100%;min-height:36px;border:1px solid rgba(255,193,92,.36);border-radius:8px;background:rgba(164,103,24,.12);color:#ffe1aa;font-size:8px;font-weight:900;letter-spacing:.09em;cursor:pointer}.cs-ocr-fallback>button:disabled{opacity:.5;cursor:wait}.cs-ocr-fallback>small{display:block;margin-top:6px;color:#8b9ba3;font-size:8px;line-height:1.4}.cs-ocr-status{margin-top:8px;color:#8fe6ff;font-size:8px}.cs-ocr-clues{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.cs-ocr-clues span{padding:5px 7px;border:1px solid rgba(82,205,245,.15);border-radius:6px;background:#071724;color:#66889b;font-size:7px;font-weight:900;letter-spacing:.07em}.cs-ocr-clues b{margin-left:4px;color:#d9f4ff;font-size:8px}.cs-ocr-clues i{margin-left:5px;font-size:6px;font-style:normal;color:#667f8d}.cs-ocr-clues .q-high{border-color:rgba(77,238,157,.3)}.cs-ocr-clues .q-high i{color:#62e9a5}.cs-ocr-clues .q-low{opacity:.55;border-color:rgba(255,107,123,.18)}
      `}</style>
    </div>,
    target,
  );
}
