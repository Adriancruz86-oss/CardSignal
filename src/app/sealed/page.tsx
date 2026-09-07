"use client";

import { useMemo, useState } from "react";
import "./sealed.css";

type Category = "Sports" | "Pokémon";
type Status = "Released" | "Upcoming";
type Signal = "BUY SEALED" | "WAIT" | "WATCH RESTOCK" | "HOLD SEALED" | "TAKE PROFIT" | "AVOID";

type SealedProduct = {
  id: string;
  name: string;
  category: Category;
  format: string;
  releaseDate: string;
  status: Status;
  msrp: number;
  market: number;
  move7d: number | null;
  move30d: number | null;
  velocity7d: number;
  activeListings: number;
  supplyTrend: "tightening" | "stable" | "expanding";
  restockRisk: "low" | "medium" | "high";
};

const PRODUCTS: SealedProduct[] = [
  {
    id: "sports-1",
    name: "2026 Topps Chrome Baseball Hobby",
    category: "Sports",
    format: "Hobby Box",
    releaseDate: "2026-07-29",
    status: "Released",
    msrp: 229.99,
    market: 259,
    move7d: 4.8,
    move30d: 11.2,
    velocity7d: 38,
    activeListings: 61,
    supplyTrend: "tightening",
    restockRisk: "medium",
  },
  {
    id: "pokemon-1",
    name: "Pokémon Scarlet & Violet — Recent Booster Box",
    category: "Pokémon",
    format: "Booster Box",
    releaseDate: "2026-06-12",
    status: "Released",
    msrp: 161.64,
    market: 174,
    move7d: 1.9,
    move30d: 5.4,
    velocity7d: 72,
    activeListings: 144,
    supplyTrend: "stable",
    restockRisk: "high",
  },
  {
    id: "sports-2",
    name: "2026 Basketball Premium Hobby Release",
    category: "Sports",
    format: "Hobby Box",
    releaseDate: "2026-10-16",
    status: "Upcoming",
    msrp: 299.99,
    market: 389,
    move7d: null,
    move30d: null,
    velocity7d: 18,
    activeListings: 27,
    supplyTrend: "stable",
    restockRisk: "medium",
  },
  {
    id: "pokemon-2",
    name: "Pokémon — Upcoming Expansion ETB",
    category: "Pokémon",
    format: "Elite Trainer Box",
    releaseDate: "2026-11-06",
    status: "Upcoming",
    msrp: 59.99,
    market: 84,
    move7d: null,
    move30d: null,
    velocity7d: 41,
    activeListings: 83,
    supplyTrend: "expanding",
    restockRisk: "high",
  },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function daysUntil(date: string) {
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function getSignal(p: SealedProduct): Signal {
  const premium = (p.market - p.msrp) / p.msrp;
  if (p.status === "Upcoming") {
    if (premium > 0.28) return "WAIT";
    if (p.restockRisk === "high") return "WATCH RESTOCK";
    return "BUY SEALED";
  }
  if (p.supplyTrend === "expanding" && (p.move7d ?? 0) < 0) return "AVOID";
  if (premium > 0.45 && (p.move7d ?? 0) <= 1) return "TAKE PROFIT";
  if (p.supplyTrend === "tightening" && p.velocity7d >= 25 && premium < 0.25) return "BUY SEALED";
  if (p.restockRisk === "high" && premium > 0.08) return "WATCH RESTOCK";
  return "HOLD SEALED";
}

const signalTone: Record<Signal, string> = {
  "BUY SEALED": "buy",
  WAIT: "wait",
  "WATCH RESTOCK": "watch",
  "HOLD SEALED": "hold",
  "TAKE PROFIT": "profit",
  AVOID: "avoid",
};

export default function SealedPage() {
  const [tab, setTab] = useState<"Market" | "Upcoming">("Market");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [query, setQuery] = useState("");
  const [watching, setWatching] = useState<string[]>([]);

  const products = useMemo(() => {
    return PRODUCTS.filter((p) => (tab === "Upcoming" ? p.status === "Upcoming" : p.status === "Released"))
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [tab, category, query]);

  const released = PRODUCTS.filter((p) => p.status === "Released");
  const avgPremium = released.reduce((sum, p) => sum + (p.market - p.msrp) / p.msrp, 0) / Math.max(1, released.length);
  const buyCount = PRODUCTS.filter((p) => getSignal(p) === "BUY SEALED").length;
  const restockCount = PRODUCTS.filter((p) => getSignal(p) === "WATCH RESTOCK").length;

  return (
    <main className="sealed-shell">
      <header className="sealed-topbar">
        <button className="sealed-brand" onClick={() => (window.location.href = "/")}>Card<span>Signal</span></button>
        <div className="sealed-title-lockup">
          <small>SEALED MARKET</small>
          <b>Sports + Pokémon</b>
        </div>
        <button className="back-button" onClick={() => (window.location.href = "/")}>← Dashboard</button>
      </header>

      <section className="sealed-wrap">
        <div className="sealed-hero">
          <div>
            <span className="sealed-eyebrow">SEALED INTELLIGENCE</span>
            <h1>Track the box before you rip it.</h1>
            <p>Past 12 months + upcoming releases. Signals compare MSRP, market premium, velocity, listing supply, and restock risk.</p>
          </div>
          <div className="data-badge"><i /> MVP seed data — live provider wiring next</div>
        </div>

        <section className="sealed-stats">
          <article><span>TRACKED PRODUCTS</span><strong>{PRODUCTS.length}</strong><small>Sports + Pokémon</small></article>
          <article><span>AVG PREMIUM</span><strong>{Math.round(avgPremium * 100)}%</strong><small>Released vs MSRP</small></article>
          <article><span>BUY SEALED</span><strong>{buyCount}</strong><small>Current model</small></article>
          <article><span>RESTOCK WATCH</span><strong>{restockCount}</strong><small>Entry-price opportunities</small></article>
        </section>

        <section className="sealed-controls">
          <div className="sealed-tabs">
            <button className={tab === "Market" ? "active" : ""} onClick={() => setTab("Market")}>Market</button>
            <button className={tab === "Upcoming" ? "active" : ""} onClick={() => setTab("Upcoming")}>Upcoming</button>
          </div>
          <div className="category-tabs">
            {(["All", "Sports", "Pokémon"] as const).map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sealed products…" />
        </section>

        <section className="sealed-grid">
          {products.map((p) => {
            const signal = getSignal(p);
            const premium = ((p.market - p.msrp) / p.msrp) * 100;
            const countdown = daysUntil(p.releaseDate);
            const isWatching = watching.includes(p.id);
            return (
              <article className="sealed-card" key={p.id}>
                <div className="sealed-card-head">
                  <div>
                    <span className="product-category">{p.category} · {p.format}</span>
                    <h2>{p.name}</h2>
                    <small>{p.status === "Upcoming" ? `${Math.max(0, countdown)} days to release` : `Released ${p.releaseDate}`}</small>
                  </div>
                  <span className={`sealed-signal ${signalTone[signal]}`}>{signal}</span>
                </div>

                <div className="price-pair">
                  <div><span>MSRP</span><strong>{money(p.msrp)}</strong></div>
                  <div><span>{p.status === "Upcoming" ? "PREORDER" : "MARKET"}</span><strong>{money(p.market)}</strong></div>
                  <div><span>PREMIUM</span><strong className={premium > 25 ? "hot" : ""}>{premium >= 0 ? "+" : ""}{premium.toFixed(0)}%</strong></div>
                </div>

                <div className="sealed-metrics">
                  <div><span>7D MOVE</span><b>{p.move7d == null ? "—" : `${p.move7d > 0 ? "+" : ""}${p.move7d}%`}</b></div>
                  <div><span>30D MOVE</span><b>{p.move30d == null ? "—" : `${p.move30d > 0 ? "+" : ""}${p.move30d}%`}</b></div>
                  <div><span>SALES / 7D</span><b>{p.velocity7d}</b></div>
                  <div><span>LISTINGS</span><b>{p.activeListings}</b></div>
                  <div><span>SUPPLY</span><b>{p.supplyTrend}</b></div>
                  <div><span>RESTOCK RISK</span><b>{p.restockRisk}</b></div>
                </div>

                <div className="signal-explain">
                  <span>WHY THIS SIGNAL</span>
                  <p>{signal === "BUY SEALED" && "Demand is healthy relative to the current premium while supply is not expanding aggressively."}
                  {signal === "WAIT" && "Preorder premium is too far above MSRP to justify chasing before release."}
                  {signal === "WATCH RESTOCK" && "Demand exists, but a likely restock could create a much better entry near MSRP."}
                  {signal === "HOLD SEALED" && "Price and supply are balanced. There is no strong reason to add or exit yet."}
                  {signal === "TAKE PROFIT" && "The premium is elevated while short-term momentum is flattening."}
                  {signal === "AVOID" && "Supply is expanding while price momentum is weakening."}</p>
                </div>

                <div className="sealed-actions">
                  <button className={isWatching ? "watching" : ""} onClick={() => setWatching((old) => isWatching ? old.filter((id) => id !== p.id) : [...old, p.id])}>{isWatching ? "✓ Watching" : "+ Watch product"}</button>
                  <button disabled>Buy-at-MSRP alert <small>coming next</small></button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="sealed-roadmap">
          <span>NEXT DATA PASS</span>
          <h3>Turn this UI into a live signal lane.</h3>
          <div>
            <p><b>1.</b> Product catalog: exact SKU, release date, format and MSRP.</p>
            <p><b>2.</b> Market snapshots: price, sold velocity and active listing count.</p>
            <p><b>3.</b> Restock watcher: retailer availability + price-at-MSRP alerts.</p>
            <p><b>4.</b> Repeat scans: 7D / 30D movement and supply tightening.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
