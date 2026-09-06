"use client";

function StatCard({icon,label,tone}:{icon:string;label:string;tone?:"buy"|"sell"}){
 return <article className={`stat-card ${tone?`${tone}-edge`:""}`}>
  <div className={`stat-icon ${tone||"cyan"}`}>{icon}</div>
  <div className="stat-copy"><span>{label}</span><strong>—</strong><small>Waiting for portfolio data</small></div>
 </article>;
}

function EmptySignalRow(){
 return <div className="radar-empty">No evidence-backed signals yet</div>;
}

export default function Home(){
 const openPulse=()=>document.querySelector<HTMLButtonElement>(".cs-pulse-launch")?.click();
 return <main className="app-shell v2-shell">
  <div className="ambient-grid" />
  <div className="background-radar" />
  <div className="background-trend" />

  <header className="topbar v2-topbar">
   <div className="brand-lockup v2-brand"><div className="brand-fallback"><b>Card</b><em>Signal</em></div></div>
   <nav className="nav-tabs" aria-label="Primary navigation">
    <button className="active">Dashboard</button><button>Buy Radar</button><button>Sell Radar</button><button>Watchlist</button><button>Portfolio</button><button>Alerts</button>
   </nav>
   <button className="add-card"><span>＋</span> Add Card</button>
  </header>

  <section className="dashboard-wrap v2-wrap">
   <div className="eyebrow-row">
    <div><span className="eyebrow">MARKET INTELLIGENCE</span><h1>Your collection. <em>Evidence first.</em></h1><p className="hero-subcopy">Track exact cards, collect repeatable market evidence, and surface signals only when the data supports them.</p></div>
    <div className="scan-status"><i /> Market scans run when you request them</div>
   </div>

   <section className="stat-grid">
    <StatCard icon="$" label="PORTFOLIO VALUE" tone="buy" />
    <StatCard icon="◎" label="WATCHING" />
    <StatCard icon="↗" label="BUY MORE" tone="buy" />
    <StatCard icon="!" label="SELL RISK" tone="sell" />
   </section>

   <section className="hero-grid v2-hero-grid">
    <article className="panel top-signal v2-top-signal">
     <div className="panel-accent" />
     <div className="panel-heading"><div><span className="kicker green">TOP SIGNAL</span><h2>Add your first card</h2><p>Your strongest evidence-backed portfolio signal will appear here.</p></div><span className="live-dot"><i /> NO SCAN</span></div>
     <div className="top-signal-content">
      <div className="card-stage v2-card-stage">
       <div className="card-glow" />
       <div className="card-silhouette v2-card-silhouette"><div className="card-grade"><span>RAW</span><b /></div><div className="player-mark"><span>CS</span><i /></div><div className="card-caption"><span>CATALOG CARD</span><small>NO CARD SELECTED</small></div></div>
      </div>
      <div className="signal-primary v2-signal-primary">
       <span className="label">CARDSIGNAL SCORE</span><div className="score-lockup"><div className="massive-score">—</div><span className="score-arrow">→</span></div>
       <div className="recommendation"><span>◎</span> NEEDS DATA <small>LOW CONFIDENCE</small></div>
       <div className="decision-strip"><div><span>PRICE TREND</span><strong>—</strong><small>not established</small></div><div><span>SALES VELOCITY</span><strong>—</strong><small>not established</small></div><div><span>EVIDENCE</span><strong>—</strong><small>no scan</small></div></div>
       <p>Add cards, then run Portfolio Pulse. CardSignal will only surface signals backed by accepted market matches.</p>
       <div className="price-line"><span>CURRENT MEDIAN</span><strong>—</strong><small>trend not established</small></div>
       <button onClick={openPulse} className="analyze-button"><span>RUN PORTFOLIO PULSE</span></button><small className="updated">Not scanned yet</small>
      </div>
     </div>
    </article>

    <article className="panel breakdown v2-breakdown">
     <div className="panel-heading compact"><div><span className="kicker cyan">SIGNAL BREAKDOWN</span><h3>Why the signal exists</h3></div><span className="confidence">NO SCAN</span></div>
     {["7D price move","Sales velocity","Market-match evidence","Signal confidence"].map(label=><div className="metric" key={label}><div className="metric-label"><span>{label}</span><b>0</b></div><div className="metric-track"><i style={{width:"0%"}} /></div><small>No evidence yet</small></div>)}
     <div className="insight-box"><span>MARKET EVIDENCE</span><p>Run Portfolio Pulse to populate this panel with exact-card market evidence.</p></div>
    </article>
   </section>

   <section className="triple-grid">
    <article className="panel radar-panel"><div className="section-title"><span className="green">▲</span><div><b>BUY RADAR</b><small>Evidence-backed upside</small></div><button>VIEW ALL</button></div><EmptySignalRow /></article>
    <article className="panel radar-panel"><div className="section-title"><span className="red">▼</span><div><b>SELL RADAR</b><small>Evidence-backed risk</small></div><button>VIEW ALL</button></div><EmptySignalRow /></article>
    <article className="panel radar-panel"><div className="section-title"><span className="cyan">◎</span><div><b>WATCHLIST</b><small>Your monitored cards</small></div><button>VIEW ALL</button></div><div className="radar-empty">Your watchlist is empty</div></article>
   </section>

   <section className="bottom-grid">
    <article className="panel trend-panel"><div className="section-title"><span className="cyan">⌁</span><div><b>PORTFOLIO TREND</b><small>Historical snapshots only</small></div></div><div className="chart-area"><div className="cs-trend-empty"><b>Trend history starts after repeated scans</b><span>No synthetic chart points are shown.</span></div></div></article>
    <article className="panel alerts-panel"><div className="section-title"><span className="cyan">◉</span><div><b>RECENT ALERTS</b><small>Material changes only</small></div></div><div className="radar-empty">No material alerts yet</div></article>
    <article className="panel snapshot-panel"><div className="section-title"><span className="cyan">⌖</span><div><b>MARKET SNAPSHOT</b><small>Across tracked cards</small></div></div><div className="snapshot-ring"><div><strong>—</strong><span>MARKET HEAT</span></div></div><div className="snapshot-stats"><p><span>Rising</span><b>0</b></p><p><span>Stable</span><b>0</b></p><p><span>Falling</span><b>0</b></p></div><div className="market-note"><span>◎</span><p><b>Waiting for evidence</b><br/>Run scans to build a truthful market snapshot.</p></div></article>
   </section>
  </section>
 </main>;
}
