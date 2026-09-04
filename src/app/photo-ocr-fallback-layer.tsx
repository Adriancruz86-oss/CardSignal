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
};

const NAME_EXCLUDES = new Set([
  "TOPPS", "BOWMAN", "PANINI", "DONRUSS", "BASEBALL", "FOOTBALL", "BASKETBALL",
  "PITCHER", "HITTER", "ROOKIE", "CARD", "CARDS", "PLAYER", "PLAYERS", "CHROME",
  "REFRACTOR", "REFRACTORS", "PRIZM", "OPTIC", "SELECT", "MOSAIC", "COPYRIGHT",
  "INC", "LLC", "USA", "MADE IN USA", "MAJOR LEAGUE BASEBALL"
]);

function lines(text: string) {
  return text.split(/\r?\n/).map((v) => v.replace(/[^A-Za-z0-9#/'&.\- ]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function upperRatio(v: string) {
  const letters = v.replace(/[^A-Za-z]/g, "");
  if (!letters) return 0;
  return [...letters].filter((c) => c === c.toUpperCase()).length / letters.length;
}

function findPlayer(front: string, back: string) {
  const all = [...lines(front), ...lines(back)];
  const candidates = all.filter((v) => {
    const words = v.split(" ");
    if (words.length < 2 || words.length > 4 || v.length < 5 || v.length > 34) return false;
    if (/\d/.test(v) || upperRatio(v) < 0.72) return false;
    const normalized = v.toUpperCase();
    if (NAME_EXCLUDES.has(normalized)) return false;
    if ([...NAME_EXCLUDES].some((x) => normalized.includes(x) && x.length > 5)) return false;
    return words.every((w) => /^[A-Za-z'.-]+$/.test(w));
  });

  const counts = new Map<string, number>();
  for (const value of candidates) {
    const key = value.toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
  if (repeated && repeated[1] >= 2) return repeated[0].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B[A-Z]/g, (c) => c.toLowerCase());

  const first = candidates.sort((a, b) => a.length - b.length)[0];
  return first ? first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

function findCardNumber(back: string) {
  for (const value of lines(back).slice(0, 12)) {
    const direct = value.match(/^#?\s*([A-Z0-9-]{1,8})$/i)?.[1] || "";
    if (!direct) continue;
    if (/^(19|20)\d{2}$/.test(direct)) continue;
    if (/^\d{1,3}$/.test(direct) || /[A-Za-z]/.test(direct)) return direct;
  }
  return back.match(/(?:card\s*(?:no\.?|#)|#)\s*([A-Z0-9-]{1,10})/i)?.[1] || "";
}

function extractClues(front: string, back: string): Clues {
  const combined = `${front}\n${back}`;
  const years = [...combined.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]);
  const currentYear = new Date().getFullYear() + 1;
  const validYears = years.map(Number).filter((y) => y >= 1950 && y <= currentYear);
  const year = validYears.length ? String(Math.max(...validYears)) : "";
  const serialMatch = front.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  const serial = serialMatch ? `${serialMatch[1]}/${serialMatch[2]}` : "";
  const brandMatch = combined.match(/\b(Topps|Bowman|Panini|Upper Deck|Donruss|Leaf|Fleer|Score)\b/i)?.[1] || "";
  return {
    player: findPlayer(front, back),
    year,
    manufacturer: brandMatch ? brandMatch.replace(/\b\w/g, (c) => c.toUpperCase()) : "",
    cardNumber: findCardNumber(back),
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
    setStatus("Reading front photo…");
    setClues(null);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setStatus(`Reading card text… ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      const frontResult = await worker.recognize(front);
      setStatus(back ? "Reading back photo…" : "Extracting card clues…");
      const backResult = back ? await worker.recognize(back) : null;
      const next = extractClues(frontResult.data.text || "", backResult?.data.text || "");
      setClues(next);

      const fieldInputs = Array.from(document.querySelectorAll<HTMLInputElement>(".cs-collection-fields input"));
      setReactInput(fieldInputs[0] || null, next.player || "");
      setReactInput(fieldInputs[2] || null, next.cardNumber || "");
      setReactInput(fieldInputs[3] || null, next.serial ? `/${next.serial.split("/")[1]}` : "");

      const query = [next.player, next.year, next.manufacturer, next.cardNumber ? `#${next.cardNumber}` : ""].filter(Boolean).join(" ");
      setReactInput(document.querySelector<HTMLInputElement>(".cs-add-search"), query);
      setStatus(query ? "Clues extracted — checking TCDB for likely matches…" : "OCR finished — review the extracted clues below.");
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
      <button type="button" onClick={runOcr} disabled={working}>{working ? "READING FRONT + BACK…" : "READ FRONT + BACK"}</button>
      <small>Runs locally in your browser. It does not use another CardSight identification call.</small>
      {status && <div className="cs-ocr-status">{status}</div>}
      {clues && <div className="cs-ocr-clues">
        {clues.player && <span>PLAYER <b>{clues.player}</b></span>}
        {clues.cardNumber && <span>CARD # <b>{clues.cardNumber}</b></span>}
        {clues.year && <span>YEAR <b>{clues.year}</b></span>}
        {clues.manufacturer && <span>BRAND <b>{clues.manufacturer}</b></span>}
        {clues.serial && <span>SERIAL <b>{clues.serial}</b></span>}
      </div>}
      <style jsx global>{`
        .cs-ocr-fallback{margin-top:10px;padding:12px;border:1px solid rgba(255,193,92,.26);border-radius:9px;background:rgba(145,92,18,.08)}
        .cs-ocr-fallback-head span{display:block;color:#ffc66f;font-size:7px;font-weight:900;letter-spacing:.13em}.cs-ocr-fallback-head b{display:block;margin:4px 0 9px;color:#f5dfba;font-size:10px}.cs-ocr-fallback>button{width:100%;min-height:36px;border:1px solid rgba(255,193,92,.36);border-radius:8px;background:rgba(164,103,24,.12);color:#ffe1aa;font-size:8px;font-weight:900;letter-spacing:.09em;cursor:pointer}.cs-ocr-fallback>button:disabled{opacity:.5;cursor:wait}.cs-ocr-fallback>small{display:block;margin-top:6px;color:#8b9ba3;font-size:8px;line-height:1.4}.cs-ocr-status{margin-top:8px;color:#8fe6ff;font-size:8px}.cs-ocr-clues{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.cs-ocr-clues span{padding:5px 7px;border:1px solid rgba(82,205,245,.15);border-radius:6px;background:#071724;color:#66889b;font-size:7px;font-weight:900;letter-spacing:.07em}.cs-ocr-clues b{margin-left:4px;color:#d9f4ff;font-size:8px}
      `}</style>
    </div>,
    target,
  );
}
