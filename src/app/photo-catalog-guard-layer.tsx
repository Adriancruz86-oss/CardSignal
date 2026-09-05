"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type VisualCandidate = {
  name?: string;
  subject?: string;
  year?: string;
  set?: string;
  number?: string;
  parallel?: string;
};

export default function PhotoCatalogGuardLayer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [visual, setVisual] = useState<VisualCandidate | null>(null);

  useEffect(() => {
    const findTarget = () => setTarget(document.querySelector<HTMLElement>(".cs-photo-actions"));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".cs-identify-btn");
      if (!button || working) return;

      // The original Add Card handler trusts the visual model and writes its answer
      // straight into the form. Stop that path: image recognition is only a clue now.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const files = Array.from(document.querySelectorAll<HTMLInputElement>(".cs-photo-slot input[type='file']"));
      const front = files[0]?.files?.[0];
      const back = files[1]?.files?.[0];
      if (!front) {
        setMessage("Add a front photo first.");
        return;
      }

      setWorking(true);
      setVisual(null);
      setMessage("Checking the image, then verifying card text against the catalog…");
      const oldText = button.textContent;
      button.disabled = true;
      button.textContent = "VERIFYING PHOTO + CATALOG…";

      try {
        const fd = new FormData();
        fd.append("front", front);
        if (back) fd.append("back", back);
        const start = await fetch("/api/card-photo-identify", { method: "POST", body: fd });
        const sj = await start.json();

        if (start.ok && sj.ok && sj.scanId) {
          const poll = await fetch(`/api/card-photo-identify?id=${encodeURIComponent(String(sj.scanId))}`);
          const pj = await poll.json();
          if (poll.ok && pj.ok && pj.identification) {
            setVisual(pj.identification as VisualCandidate);
            setMessage("Visual AI produced a suggestion, but CardSignal will not apply it until OCR/catalog evidence agrees.");
          } else {
            setMessage("Visual AI could not produce a trusted match. Reading the card text and checking the catalog instead.");
          }
        } else {
          setMessage(sj?.error ? `Visual AI: ${String(sj.error)} — checking OCR/catalog instead.` : "Visual AI had no match. Checking OCR/catalog instead.");
        }
      } catch {
        setMessage("Visual AI was unavailable. Checking OCR/catalog instead.");
      } finally {
        // OCR owns the factual clues. It feeds the normal search box, whose API now
        // uses CardSight catalog search first and TCDB only as a fallback.
        window.dispatchEvent(new CustomEvent("cardsignal:request-ocr"));
        setWorking(false);
        button.disabled = false;
        button.textContent = oldText || "✦ IDENTIFY FROM PHOTOS";
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [working]);

  if (!target || (!message && !visual)) return null;

  const visualLabel = visual
    ? [visual.subject || visual.name, visual.year, visual.set, visual.number ? `#${visual.number}` : "", visual.parallel].filter(Boolean).join(" · ")
    : "";

  return createPortal(
    <div className="cs-catalog-guard">
      <span>CATALOG CONFIRMATION REQUIRED</span>
      <b>{message}</b>
      {visualLabel && <div><small>VISUAL SUGGESTION — NOT APPLIED</small>{visualLabel}</div>}
      <p>The card fields stay unchanged until you select a canonical catalog result below.</p>
      <style jsx global>{`
        .cs-catalog-guard{margin-top:10px;padding:10px 11px;border:1px solid rgba(82,205,245,.2);border-radius:8px;background:rgba(20,92,122,.08)}
        .cs-catalog-guard>span{display:block;color:#65dcff;font-size:7px;font-weight:900;letter-spacing:.12em}.cs-catalog-guard>b{display:block;margin-top:4px;color:#b8d9e8;font-size:8px;line-height:1.4}.cs-catalog-guard>div{margin-top:7px;padding:7px 8px;border:1px solid rgba(255,194,91,.2);border-radius:6px;background:rgba(133,83,14,.08);color:#f1d9aa;font-size:8px}.cs-catalog-guard>div small{display:block;margin-bottom:3px;color:#e7ad55;font-size:6px;font-weight:900;letter-spacing:.1em}.cs-catalog-guard>p{margin:7px 0 0;color:#6f8d9c;font-size:7px;line-height:1.4}
      `}</style>
    </div>,
    target,
  );
}
