"use client";

import Image from "next/image";
import { useState } from "react";

const radar = [
  { name: "Jackson Holliday", meta: "2024 Topps Chrome · PSA 10", score: 86, move: "+12.4%", tone: "buy" },
  { name: "Paul Skenes", meta: "2024 Bowman Chrome · PSA 10", score: 79, move: "+8.1%", tone: "buy" },
  { name: "Victor Wembanyama", meta: "2023 Prizm Silver · PSA 10", score: 72, move: "+4.7%", tone: "buy" },
];

const sellRadar = [
  { name: "Anthony Richardson", meta: "2023 Prizm Rookie · PSA 10", score: 81, move: "-14.2%", tone: "sell" },
  { name: "Jordan Walker", meta: "2023 Topps Chrome · PSA 10", score: 74, move: "-9.3%", tone: "sell" },
];

const watchlist = [
  { name: "Shohei Ohtani", meta: "2018 Topps Chrome · PSA 10", score: 61, move: "+2.1%", tone: "hold" },
  { name: "Caleb Williams", meta: "2024 Donruss Optic · PSA 10", score: 56, move: "+0.8%", tone: "hold" },
  { name: "Elly De La Cruz", meta: "2024 Topps Chrome · PSA 10", score: 48, move: "-1.1%", tone: "hold" },
];

function SignalRow({ name, meta, score, move, tone }: { name: string; meta: string; score: number; move: string; tone: string }) {
  return (
    <div className="signal-row">
      <div className="mini-card"><span>CS</span></div>
      <div className="signal-copy">
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
      <div className={`score-pill ${tone}`}><b>{score}</b><small>{move}</small></div>
    </div>
  );
}

export default function Home() {
  const [analyzing, setAnalyzing] = useState(false);
  const [updated, setUpdated] = useState("2 min ago");

  const analyze = () => {
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalyzing(false);
      setUpdated("just now");
    }, 1100);
  };

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <header className="topbar">
        <div className="brand-lockup">
          <Image src="/assets/ui/Generated image 1 (15).png" alt="CardSignal" width={430} height={180} priority className="brand-image" />
        </div>
        <nav className="nav-tabs">
          <button className="active">Dashboard</button>
          <button>Buy Radar</button>
          <button>Sell Radar</button>
          <button>Watchlist</button>
          <button>Portfolio</button>
        </nav>
        <button className="add-card">＋ Add Card</button>
      </header>

      <section className="dashboard-wrap">
        <div className="eyebrow-row">
          <div>
            <span className="eyebrow">MARKET INTELLIGENCE</span>
            <h1>Good evening. <em>Signals are moving.</em></h1>
          </div>
          <div className="scan-status"><i /> Next market scan <strong>03:42:18</strong></div>
        </div>

        <section className="stat-grid">
          <article className="stat-card"><span>PORTFOLIO VALUE</span><strong>$3,482.16</strong><small className="positive">▲ 4.2% this week</small></article>
          <article className="stat-card"><span>WATCHING</span><strong>14 <b>cards</b></strong><small>3 changed since last scan</small></article>
          <article className="stat-card buy-edge"><span>BUY SIGNALS</span><strong>3 <b>active</b></strong><small className="positive">2 high confidence</small></article>
          <article className="stat-card sell-edge"><span>SELL RISK</span><strong>2 <b>active</b></strong><small className="negative">1 urgent review</small></article>
        </section>

        <section className="hero-grid">
          <article className="panel top-signal">
            <div className="panel-heading">
              <div><span className="kicker green">TOP SIGNAL</span><h2>Jackson Holliday</h2><p>2024 Topps Chrome · #172 · Refractor · PSA 10</p></div>
              <span className="live-dot">LIVE</span>
            </div>
            <div className="top-signal-content">
              <div className="card-stage">
                <div className="scan-lines" />
                <div className="card-silhouette">
                  <div className="card-grade">PSA <b>10</b></div>
                  <div className="player-mark">JH</div>
                  <div className="card-caption">TOPPS CHROME</div>
                </div>
              </div>
              <div className="signal-primary">
                <span className="label">MOMENTUM SCORE</span>
                <div className="massive-score">86</div>
                <div className="recommendation"><span>▲</span> BUY / WATCH</div>
                <p>Inventory is tightening while accepted sale prices continue to step upward.</p>
                <div className="price-line"><span>EST. MARKET</span><strong>$124.18</strong><small>+$13.84 / 7D</small></div>
                <button onClick={analyze} className={`analyze-button ${analyzing ? "loading" : ""}`}>
                  <span>{analyzing ? "SCANNING MARKET…" : "◉ ANALYZE NOW"}</span>
                </button>
                <small className="updated">Last analyzed {updated}</small>
              </div>
            </div>
          </article>

          <article className="panel breakdown">
            <div className="panel-heading compact"><div><span className="kicker cyan">SIGNAL BREAKDOWN</span><h3>Why it&apos;s moving</h3></div><span className="confidence">HIGH CONFIDENCE</span></div>
            {[
              ["Price momentum", 88, "+11"],
              ["Sales velocity", 82, "+18"],
              ["Supply pressure", 74, "+7"],
              ["Market interest", 91, "+22"],
            ].map(([label, value, change]) => (
              <div className="metric" key={String(label)}>
                <div className="metric-label"><span>{label}</span><b>{value}</b></div>
                <div className="metric-track"><i style={{ width: `${value}%` }} /></div>
                <small>{change} since previous scan</small>
              </div>
            ))}
            <div className="insight-box"><span>AI INSIGHT</span><p>Recent sales are clearing progressively higher while active inventory has contracted. Search activity is also accelerating.</p></div>
          </article>
        </section>

        <section className="triple-grid">
          <article className="panel radar-panel"><div className="section-title"><span className="green">▲</span><div><b>BUY RADAR</b><small>Positive momentum</small></div><button>VIEW ALL</button></div>{radar.map((item) => <SignalRow key={item.name} {...item} />)}</article>
          <article className="panel radar-panel"><div className="section-title"><span className="red">▼</span><div><b>SELL RADAR</b><small>Weakening demand</small></div><button>VIEW ALL</button></div>{sellRadar.map((item) => <SignalRow key={item.name} {...item} />)}<div className="radar-empty">No other urgent sell signals</div></article>
          <article className="panel radar-panel"><div className="section-title"><span className="cyan">◎</span><div><b>WATCHLIST</b><small>Your monitored cards</small></div><button>VIEW ALL</button></div>{watchlist.map((item) => <SignalRow key={item.name} {...item} />)}</article>
        </section>

        <section className="bottom-grid">
          <article className="panel trend-panel">
            <div className="section-title"><span className="cyan">⌁</span><div><b>90 DAY TREND</b><small>Portfolio signal performance</small></div><button>90D⌄</button></div>
            <div className="chart-area">
              <div className="chart-labels"><span>$3.6k</span><span>$3.3k</span><span>$3.0k</span><span>$2.7k</span></div>
              <svg viewBox="0 0 700 180" preserveAspectRatio="none" aria-label="Portfolio trend chart"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3cff93" stopOpacity=".35"/><stop offset="100%" stopColor="#3cff93" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,150 C55,135 70,145 115,120 C160,95 185,105 225,88 C275,66 310,95 350,72 C390,52 430,65 465,48 C505,26 540,48 575,32 C615,15 650,34 700,10 L700,180 L0,180 Z"/><path className="line" d="M0,150 C55,135 70,145 115,120 C160,95 185,105 225,88 C275,66 310,95 350,72 C390,52 430,65 465,48 C505,26 540,48 575,32 C615,15 650,34 700,10"/></svg>
              <div className="chart-days"><span>Jun 6</span><span>Jul 1</span><span>Aug 1</span><span>Sep 4</span></div>
            </div>
          </article>

          <article className="panel alerts-panel"><div className="section-title"><span className="cyan">◉</span><div><b>RECENT ALERTS</b><small>What changed</small></div></div>
            <div className="alert buy"><i>▲</i><div><b>Momentum spike detected</b><p>Jackson Holliday moved 61 → 86.</p><small>8 min ago</small></div></div>
            <div className="alert sell"><i>▼</i><div><b>Exit risk increased</b><p>Anthony Richardson supply jumped 31%.</p><small>47 min ago</small></div></div>
            <div className="alert info"><i>◎</i><div><b>Market scan complete</b><p>14 cards analyzed. 5 changed materially.</p><small>2 hr ago</small></div></div>
          </article>

          <article className="panel snapshot-panel"><div className="section-title"><span className="cyan">⌖</span><div><b>MARKET SNAPSHOT</b><small>Across your tracked cards</small></div></div>
            <div className="snapshot-ring"><div><strong>68</strong><span>MARKET HEAT</span></div></div>
            <div className="snapshot-stats"><p><span>Rising</span><b className="positive">8</b></p><p><span>Stable</span><b>4</b></p><p><span>Falling</span><b className="negative">2</b></p></div>
            <div className="market-note"><span>▲</span><p><b>Buyer activity is elevated</b><br/>Sales velocity across your watchlist is 18% above its 30-day average.</p></div>
          </article>
        </section>
      </section>
    </main>
  );
}
