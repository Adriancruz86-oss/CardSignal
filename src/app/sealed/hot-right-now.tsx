"use client";

import { useEffect, useState } from "react";
import { HotSealed, readHotSealed } from "./sealed-cloud";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function HotRightNow() {
  const [items, setItems] = useState<HotSealed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    readHotSealed().then((rows) => live && setItems(rows)).catch(() => live && setItems([])).finally(() => live && setLoading(false));
    const refresh = () => readHotSealed().then((rows) => live && setItems(rows)).catch(() => {});
    window.addEventListener("cardsignal-sealed-snapshot", refresh);
    return () => { live = false; window.removeEventListener("cardsignal-sealed-snapshot", refresh); };
  }, []);

  return (
    <section className="sealed-hot">
      <div className="sealed-hot-inner">
        <div className="sealed-hot-head">
          <div>
            <span>🔥 HOT RIGHT NOW</span>
            <h2>Wax creating the most new value.</h2>
            <p>Ranks ordinary sealed wax by positive market value created between recent snapshots, strengthened by current evidence. Premium sealed above $500 and non-wax products are excluded.</p>
          </div>
          <b>WAX ONLY · ≤ $500</b>
        </div>
        {loading ? <div className="sealed-hot-empty">Loading sealed history…</div> : items.length === 0 ? (
          <div className="sealed-hot-empty">Hot Right Now activates after a tracked wax product has at least two market snapshots. Search it again later and confirm the same exact SKU to build the comparison.</div>
        ) : (
          <div className="sealed-hot-grid">
            {items.map((item, index) => (
              <article key={item.id} className={index === 0 ? "leader" : ""}>
                <div className="hot-rank">#{index + 1}</div>
                <div className="hot-copy">
                  <span>{item.category} · {item.format}</span>
                  <h3>{item.displayName}</h3>
                  <small>{item.evidenceCount} current market records · refreshed {new Date(item.scannedAt).toLocaleDateString()}</small>
                </div>
                <div className="hot-value">
                  <span>NEW VALUE</span>
                  <strong>+{money(item.dollarGain)}</strong>
                  <b>+{item.percentGain.toFixed(1)}%</b>
                  <small>{money(item.prior)} → {money(item.latest)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .sealed-hot{background:#06131b;color:#dceef4;border-bottom:1px solid rgba(255,145,60,.16);font-family:Arial,sans-serif}.sealed-hot-inner{max-width:1360px;margin:0 auto;padding:20px 24px}.sealed-hot-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.sealed-hot-head span{font-size:10px;font-weight:900;letter-spacing:.13em;color:#ffad67}.sealed-hot-head h2{font-size:21px;margin:5px 0}.sealed-hot-head p{margin:0;max-width:820px;color:#7898a5;font-size:11px;line-height:1.55}.sealed-hot-head>b{font-size:8px;color:#ffc68f;border:1px solid rgba(255,163,83,.24);padding:7px 9px;border-radius:7px;white-space:nowrap}.sealed-hot-grid{display:grid;gap:8px;margin-top:14px}.sealed-hot-grid article{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid rgba(90,190,220,.12);border-radius:9px;background:#071b25}.sealed-hot-grid article.leader{border-color:rgba(255,155,75,.32);background:linear-gradient(90deg,rgba(255,130,45,.07),#071b25 55%)}.hot-rank{font-size:17px;font-weight:900;color:#ffad67;text-align:center}.hot-copy span{font-size:8px;text-transform:uppercase;color:#62cce8}.hot-copy h3{margin:4px 0;font-size:14px}.hot-copy small{color:#698994;font-size:8px}.hot-value{text-align:right;min-width:150px}.hot-value span{display:block;color:#768f98;font-size:7px;font-weight:900;letter-spacing:.08em}.hot-value strong{display:block;color:#76f0aa;font-size:18px;margin:2px 0}.hot-value b{color:#9be5b9;font-size:10px}.hot-value small{display:block;color:#67838d;font-size:8px;margin-top:2px}.sealed-hot-empty{margin-top:13px;padding:13px;border:1px dashed rgba(100,180,205,.16);border-radius:8px;color:#7898a5;font-size:10px}@media(max-width:700px){.sealed-hot-inner{padding:16px 14px}.sealed-hot-head{display:block}.sealed-hot-head>b{display:inline-block;margin-top:9px}.sealed-hot-grid article{grid-template-columns:32px 1fr}.hot-value{grid-column:2;text-align:left}.hot-value strong{font-size:16px}}
      `}</style>
    </section>
  );
}
