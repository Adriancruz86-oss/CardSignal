"use client";

import { useState } from "react";

const radar = [
  { name: "Jackson Holliday", initials: "JH", meta: "2024 Topps Chrome · PSA 10", score: 86, move: "+12.4%", tone: "buy" },
  { name: "Paul Skenes", initials: "PS", meta: "2024 Bowman Chrome · PSA 10", score: 79, move: "+8.1%", tone: "buy" },
  { name: "Victor Wembanyama", initials: "VW", meta: "2023 Prizm Silver · PSA 10", score: 72, move: "+4.7%", tone: "buy" },
];

const sellRadar = [
  { name: "Anthony Richardson", initials: "AR", meta: "2023 Prizm Rookie · PSA 10", score: 81, move: "-14.2%", tone: "sell" },
  { name: "Jordan Walker", initials: "JW", meta: "2023 Topps Chrome · PSA 10", score: 74, move: "-9.3%", tone: "sell" },
];

const watchlist = [
  { name: "Shohei Ohtani", initials: "SO", meta: "2018 Topps Chrome · PSA 10", score: 61, move: "+2.1%", tone: "hold" },
  { name: "Caleb Williams", initials: "CW", meta: "2024 Donruss Optic · PSA 10", score: 56, move: "+0.8%", tone: "hold" },
  { name: "Elly De La Cruz", initials: "ED", meta: "2024 Topps Chrome · PSA 10", score: 48, move: "-1.1%", tone: "hold" },
];

function SignalRow({ name, initials, meta, score, move, tone }: { name: string; initials: string; meta: string; score: number; move: string; tone: string }) {
  return (
    <div className="signal-row">
      <div className={`mini-card mini-${tone}`}>
        <span>{initials}</span>
        <i />
      </div>
      <div className="signal-copy">
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
      <div className={`score-pill ${tone}`}><b>{score}</b><small>{move}</small></div>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, note, tone }: { icon: string; label: string; value: string; suffix?: string; note: string; tone?: string }) {
  return (
    <article className={`stat-card ${tone ? `${tone}-edge` : ""}`}>
      <div className={`stat-icon ${tone ?? "cyan"}`}>{icon}</div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value} {suffix && <b>{suffix}</b>}</strong>
        <small className={tone === "buy" ? "positive" : tone === "sell" ? "negative" : ""}>{note}</small>
      </div>
    </article>
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
    <main className="app-shell v2-shell">
      <div className="ambient-grid" />
      <div className="background-radar" />
      <div className="background-trend" />

      <header className="topbar v2-topbar">
        <div className="brand-lockup v2-brand">
          <div className="brand-fallback"><b>Card</b><em>Signal</em></div>
          <img src="/assets/ui/Generated image 1 (14).png" alt="CardSignal" className="brand-logo-original" />
        </div>
        <nav className="nav-tabs">
          <button className="active">Dashboard</button>
          <button>Buy Radar</button>
          <button>Sell Radar</button>
          <button>Watchlist</button>
          <button>Portfolio</button>
          <button>Alerts</button>
        </nav>
        <button className="add-card"><span>＋</span> Add Card</button>
      </header>

      <section className="dashboard-wrap v2-wrap">
        <div className="eyebrow-row">
          <div>
            <span className="eyebrow">MARKET INTELLIGENCE</span>
            <h1>Good evening. <em>Signals are moving.</em></h1>
            <p className="hero-subcopy">Your cards, your watchlist, and the market events most likely to matter next.</p>
          </div>
          <div className="scan-status"><i /> Next market scan <strong>03:42:18</strong></div>
        </div>

        <section className="stat-grid">
          <StatCard icon="$" label="PORTFOLIO VALUE" value="$3,482.16" note="▲ 4.2% this week" tone="buy" />
          <StatCard icon="◎" label="WATCHING" value="14" suffix="cards" note="3 changed since last scan" />
          <StatCard icon="↗" label="BUY SIGNALS" value="3" suffix="active" note="2 high confidence" tone="buy" />
          <StatCard icon="!" label="SELL RISK" value="2" suffix="active" note="1 urgent review" tone="sell" />
        </section>

        <section className="hero-grid v2-hero-grid">
          <article className="panel top-signal v2-top-signal">
            <div className="panel-accent" />
            <div className="panel-heading">
              <div><span className="kicker green">TOP SIGNAL</span><h2>Jackson Holliday</h2><p>2024 Topps Chrome · #172 · Refractor · PSA 10</p></div>
              <span className="live-dot"><i /> LIVE SIGNAL</span>
            </div>
            <div className="top-signal-content">
              <div className="card-stage v2-card-stage">
                <div className="scan-corner tl" /><div className="scan-corner tr" /><div className="scan-corner bl" /><div className="scan-corner br" />
                <div className="card-glow" />
                <div className="card-silhouette v2-card-silhouette">
                  <div className="card-grade"><span>PSA</span><b>10</b></div>
                  <div className="player-mark"><span>JH</span><i /></div>
                  <div className="card-caption"><span>TOPPS CHROME</span><small>ROOKIE REFRACTOR</small></div>
                </div>
              </div>
              <div className="signal-primary v2-signal-primary">
                <span className="label">MOMENTUM SCORE</span>
                <div className="score-lockup"><div className="massive-score">86</div><span className="score-arrow">↗</span></div>
                <div className="recommendation"><span>▲</span> BUY / WATCH <small>HIGH CONFIDENCE</small></div>
                <div className="decision-strip" aria-label="Signal evidence">
                  <div><span>PRICE TREND</span><strong className="positive">+11</strong><small>since scan</small></div>
                  <div><span>SALES VELOCITY</span><strong className="positive">+18</strong><small>accelerating</small></div>
                  <div><span>SUPPLY</span><strong className="positive">TIGHT</strong><small>inventory falling</small></div>
                </div>
                <p>Inventory is tightening while accepted sale prices continue to step upward. Buyer activity is accelerating ahead of the broader price curve.</p>
                <div className="price-line"><span>EST. MARKET</span><strong>$124.18</strong><small>+$13.84 / 7D</small></div>
                <button onClick={analyze} className={`analyze-button ${analyzing ? "loading" : ""}`}>
                  <span>{analyzing ? "SCANNING MARKET…" : "◉ ANALYZE NOW"}</span>
                </button>
                <small className="updated">Last analyzed {updated}</small>
              </div>
            </div>
          </article>

          <article className="panel breakdown v2-breakdown">
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

      <style jsx global>{`
        .v2-shell { background: #04101a !important; }
        .v2-shell::before {
          background:
            radial-gradient(circle at 8% 18%, rgba(34,255,146,.10), transparent 23%),
            radial-gradient(circle at 90% 25%, rgba(0,181,255,.10), transparent 26%),
            radial-gradient(circle at 72% 86%, rgba(46,118,255,.07), transparent 30%),
            linear-gradient(180deg, rgba(2,10,17,.25), rgba(2,10,17,.82)) !important;
          z-index: 0;
        }
        .background-radar { position:fixed; width:560px; height:560px; left:-260px; top:250px; border:1px solid rgba(55,242,154,.08); border-radius:50%; pointer-events:none; opacity:.8; z-index:0; box-shadow:0 0 0 70px rgba(55,242,154,.018),0 0 0 145px rgba(57,205,255,.012); }
        .background-radar::before,.background-radar::after{content:"";position:absolute;inset:16%;border:1px solid rgba(57,213,255,.08);border-radius:50%}.background-radar::after{inset:34%;border-color:rgba(62,246,154,.13)}
        .background-trend { position:fixed; right:-80px; bottom:40px; width:620px; height:260px; opacity:.14; pointer-events:none; z-index:0; background:linear-gradient(135deg,transparent 0 22%,rgba(42,231,147,.7) 22.3% 22.8%,transparent 23.2% 39%,rgba(51,196,255,.75) 39.3% 39.8%,transparent 40.2% 56%,rgba(43,240,150,.8) 56.3% 56.8%,transparent 57.2%); filter:drop-shadow(0 0 16px rgba(46,240,153,.3)); }
        .v2-topbar { min-height:96px; padding:10px 42px; grid-template-columns:320px 1fr auto; background:rgba(2,11,19,.94)!important; border-bottom:1px solid rgba(90,204,248,.13); }
        .v2-brand { height:76px; position:relative; overflow:visible; }
        .brand-logo-original { position:absolute; left:0; top:50%; transform:translateY(-50%); width:286px; height:112px; object-fit:contain; object-position:left center; filter:drop-shadow(0 0 14px rgba(55,242,154,.16)); z-index:2; }
        .brand-fallback { font-size:27px; font-style:italic; letter-spacing:-.05em; white-space:nowrap; color:#edf8ff; font-weight:900; }
        .brand-fallback b{font-weight:900}.brand-fallback em{font-style:italic;color:#47ef9a;margin-left:2px}
        .v2-wrap { width:min(1680px,calc(100% - 64px))!important; padding-top:34px; }
        .hero-subcopy { margin:8px 0 0; color:#6e8da0; font-size:13px; }
        .stat-grid { gap:16px; }
        .stat-card { display:flex; align-items:center; gap:15px; min-height:118px; padding:17px 20px; background:linear-gradient(145deg,rgba(7,25,40,.97),rgba(3,14,24,.96))!important; border-color:rgba(91,193,235,.16)!important; }
        .stat-icon { width:45px; height:45px; flex:0 0 auto; display:grid; place-items:center; border-radius:12px; font-size:19px; font-weight:900; color:#65ddff; border:1px solid rgba(85,210,255,.2); background:radial-gradient(circle,rgba(52,179,229,.16),rgba(11,34,51,.55)); box-shadow:inset 0 0 18px rgba(49,181,233,.08); }
        .stat-icon.buy{color:#58f3a2;border-color:rgba(74,239,158,.24);background:radial-gradient(circle,rgba(54,213,138,.18),rgba(11,37,31,.48))}.stat-icon.sell{color:#ff6e7c;border-color:rgba(255,93,111,.24);background:radial-gradient(circle,rgba(229,65,82,.15),rgba(45,16,24,.48))}
        .stat-copy{min-width:0}.stat-copy>span{display:block;color:#7798ac;font-size:10px;font-weight:900;letter-spacing:.15em}.stat-copy>strong{display:block;margin:7px 0 7px;font-size:28px;letter-spacing:-.04em}.stat-copy>small{color:#718d9e;font-size:10px}
        .panel { background:linear-gradient(155deg,rgba(7,25,40,.97),rgba(3,14,24,.97))!important; border-color:rgba(92,191,231,.16)!important; box-shadow:0 22px 55px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.025)!important; }
        .v2-hero-grid { grid-template-columns:minmax(0,1.75fr) minmax(390px,.72fr)!important; gap:18px!important; }
        .v2-top-signal { min-height:468px!important; padding:26px!important; position:relative; box-shadow:0 28px 70px rgba(0,0,0,.36),0 0 0 1px rgba(61,238,157,.035),inset 0 1px 0 rgba(255,255,255,.03)!important; }
        .panel-accent { position:absolute; left:0; top:0; width:180px; height:2px; background:linear-gradient(90deg,#45f39c,rgba(69,243,156,0)); box-shadow:0 0 15px rgba(69,243,156,.6); }
        .live-dot{display:inline-flex;align-items:center;gap:6px}.live-dot i{width:6px;height:6px;border-radius:50%;background:#52f49e;box-shadow:0 0 10px #52f49e}
        .v2-card-stage { min-height:335px!important; background:radial-gradient(circle at 50% 46%,rgba(44,202,255,.13),transparent 51%)!important; }
        .v2-card-stage::before{width:255px!important;height:255px!important;border-color:rgba(58,210,255,.12)!important}.v2-card-stage::after{width:330px!important;opacity:.25!important}
        .scan-corner{position:absolute;width:36px;height:36px;border-color:#48d8ff;opacity:.6;z-index:3}.scan-corner.tl{left:32px;top:32px;border-left:2px solid;border-top:2px solid}.scan-corner.tr{right:32px;top:32px;border-right:2px solid;border-top:2px solid}.scan-corner.bl{left:32px;bottom:32px;border-left:2px solid;border-bottom:2px solid}.scan-corner.br{right:32px;bottom:32px;border-right:2px solid;border-bottom:2px solid}
        .card-glow{position:absolute;width:220px;height:290px;border-radius:30px;background:rgba(57,218,255,.06);filter:blur(28px)}
        .v2-card-silhouette { width:188px!important; transform:rotate(-1.5deg)!important; background:linear-gradient(160deg,#dbe8ed,#7b909c 12%,#0c1720 15%,#15354a 74%,#08141e)!important; border:3px solid rgba(225,241,247,.9)!important; }
        .v2-card-silhouette .player-mark{height:184px!important;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 32%,rgba(56,213,255,.42),rgba(13,50,70,.86) 49%,#06131e)!important}.v2-card-silhouette .player-mark i{position:absolute;width:110px;height:135px;border-radius:48% 48% 25% 25%;bottom:-28px;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,rgba(218,244,255,.16),rgba(23,78,102,.48));filter:blur(.2px)}.v2-card-silhouette .player-mark span{position:relative;z-index:2}
        .card-caption{display:flex!important;justify-content:space-between;align-items:center!important;text-align:left!important}.card-caption small{font-size:6px;color:#72b5ce;letter-spacing:.08em}
        .v2-signal-primary { padding-right:8px; }
        .score-lockup{display:flex;align-items:center;gap:16px}.score-arrow{font-size:46px;line-height:1;color:#45f39c;text-shadow:0 0 20px rgba(69,243,156,.35)}
        .massive-score{font-size:86px!important}.recommendation small{margin-left:8px;padding-left:9px;border-left:1px solid rgba(82,241,163,.22);color:#93b7a4;font-size:8px;letter-spacing:.08em}
        .decision-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 14px}
        .decision-strip>div{min-width:0;padding:10px 11px;border:1px solid rgba(87,197,230,.12);border-radius:9px;background:linear-gradient(180deg,rgba(11,34,48,.72),rgba(5,20,30,.72))}
        .decision-strip span{display:block;color:#68899b;font-size:7px;font-weight:900;letter-spacing:.12em;white-space:nowrap}
        .decision-strip strong{display:block;margin-top:5px;font-size:14px;letter-spacing:-.02em}
        .decision-strip small{display:block;margin-top:2px;color:#5f7d8e;font-size:7px}
        .v2-breakdown { min-height:468px!important; padding:26px!important; }
        .triple-grid,.bottom-grid{gap:18px!important}.radar-panel{padding:20px!important;background:linear-gradient(160deg,rgba(7,24,39,.98),rgba(3,14,24,.98))!important}
        .mini-card{position:relative!important;width:38px!important;height:51px!important;overflow:hidden!important;border-radius:6px!important;display:flex!important;align-items:center!important;justify-content:center!important}.mini-card::before{content:"";position:absolute;inset:3px;border:1px solid rgba(255,255,255,.08);border-radius:3px;background:radial-gradient(circle at 50% 35%,rgba(85,215,255,.17),rgba(9,27,39,.2))}.mini-card span{position:relative;z-index:2;font-size:10px!important}.mini-card i{position:absolute;bottom:5px;left:7px;right:7px;height:2px;background:#4bd8ff;box-shadow:0 0 8px #4bd8ff}.mini-buy i{background:#49f19b;box-shadow:0 0 8px #49f19b}.mini-sell i{background:#ff6072;box-shadow:0 0 8px #ff6072}
        .signal-row{grid-template-columns:48px 1fr auto!important;padding:13px 2px!important}.signal-copy strong{font-size:13px!important}.score-pill{min-width:55px;padding:7px 8px!important;border-radius:7px!important}.score-pill b{font-size:16px!important}
        @media(max-width:1150px){.v2-topbar{grid-template-columns:250px 1fr auto;padding-inline:20px}.nav-tabs button{padding-inline:9px}.v2-wrap{width:min(100% - 28px,1680px)!important}.v2-hero-grid{grid-template-columns:1fr!important}.stat-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:760px){.v2-topbar{grid-template-columns:1fr auto}.nav-tabs{display:none}.brand-logo-original{width:220px}.v2-wrap{width:calc(100% - 20px)!important}.stat-grid,.triple-grid,.bottom-grid{grid-template-columns:1fr!important}.eyebrow-row{align-items:flex-start!important;flex-direction:column}.top-signal-content{grid-template-columns:1fr!important}.scan-status{display:none}.stat-card{min-height:100px}.v2-top-signal,.v2-breakdown{padding:18px!important}}
      `}</style>
    </main>
  );
}
