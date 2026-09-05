"use client";

import { useEffect, useMemo, useState } from "react";

type Identity = {
  year?: string;
  setName?: string;
  manufacturer?: string;
  cardNumber?: string;
  playerName?: string;
  variation?: string;
  sport?: string;
  url?: string;
  cardId?: string;
  source?: "CardSight" | "TCDB";
};

type StoredCard = {
  id: number;
  player: string;
  meta?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  mode?: "owned" | "watching";
  score?: number;
  move?: string;
  tone?: "buy" | "hold" | "sell";
  marketValue?: number;
  purchasePrice?: number;
  analyzed?: boolean;
  demo?: boolean;
  demoMetrics?: boolean;
  catalogConfirmed?: boolean;
  catalogSource?: string;
  catalogCardId?: string;
  canonicalIdentity?: Identity;
  liveValuation?: { compCount?: number; median?: number; confidence?: string };
};

type PulseStatus = "BUY MORE" | "HOLD" | "WATCH CLOSELY" | "SELL RISK" | "NOT ENOUGH DATA";

type PulseRow = StoredCard & {
  pulse: PulseStatus;
  change7d: number | null;
  velocity: number | null;
  confidence: string;
};

const STORAGE_KEY = "cardsignal-added-cards";

const DEMO_QUERIES = [
  "2018 Topps Update Shohei Ohtani", "2011 Topps Update Mike Trout", "1989 Upper Deck Ken Griffey Jr", "1993 SP Derek Jeter", "1984 Donruss Don Mattingly",
  "1985 Topps Mark McGwire", "1989 Upper Deck Randy Johnson", "1989 Fleer Ken Griffey Jr", "1990 Leaf Frank Thomas", "1992 Bowman Mariano Rivera",
  "2001 Bowman Chrome Albert Pujols", "2001 Bowman Chrome Ichiro Suzuki", "2017 Topps Aaron Judge", "2018 Topps Ronald Acuna Jr", "2019 Topps Fernando Tatis Jr",
  "2020 Topps Luis Robert", "2022 Topps Julio Rodriguez", "2023 Topps Corbin Carroll", "2024 Topps Elly De La Cruz", "2024 Topps Jackson Holliday",
  "1986 Fleer Michael Jordan", "1996 Topps Chrome Kobe Bryant", "2003 Topps Chrome LeBron James", "2009 Topps Stephen Curry", "2018 Panini Prizm Luka Doncic",
  "2019 Panini Prizm Zion Williamson", "2020 Panini Prizm Anthony Edwards", "2021 Panini Prizm Cade Cunningham", "2022 Panini Prizm Paolo Banchero", "2023 Panini Prizm Victor Wembanyama",
  "1981 Topps Joe Montana", "1984 Topps John Elway", "1984 Topps Dan Marino", "1989 Score Barry Sanders", "1998 Topps Chrome Peyton Manning",
  "2000 Bowman Tom Brady", "2001 Topps LaDainian Tomlinson", "2005 Topps Aaron Rodgers", "2017 Panini Prizm Patrick Mahomes", "2018 Panini Prizm Josh Allen",
  "2020 Panini Prizm Joe Burrow", "2020 Panini Prizm Justin Herbert", "2021 Panini Prizm Trevor Lawrence", "2022 Panini Prizm Brock Purdy", "2023 Panini Prizm CJ Stroud",
  "1979 O-Pee-Chee Wayne Gretzky", "1985 O-Pee-Chee Mario Lemieux", "1990 Score Jaromir Jagr", "2005 Upper Deck Young Guns Sidney Crosby", "2015 Upper Deck Young Guns Connor McDavid",
  "1992 Upper Deck Shaquille ONeal", "1996 Topps Allen Iverson", "1997 Topps Chrome Tim Duncan", "2007 Topps Kevin Durant", "2012 Panini Prizm Kawhi Leonard",
  "2012 Panini Prizm Kyrie Irving", "2013 Panini Prizm Giannis Antetokounmpo", "2017 Panini Prizm Jayson Tatum", "2018 Panini Prizm Trae Young", "2019 Panini Prizm Ja Morant",
  "2014 Topps Chrome Mookie Betts", "2016 Topps Corey Seager", "2017 Topps Chrome Cody Bellinger", "2019 Topps Chrome Vladimir Guerrero Jr", "2020 Topps Chrome Yordan Alvarez",
];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h >>> 0);
}

function readCards(): StoredCard[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function writeCards(cards: StoredCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.slice(0, 150)));
  window.dispatchEvent(new Event("cardsignal:user-cards-changed"));
}

function identityKey(id: Identity) {
  return id.cardId || [id.playerName, id.year, id.setName, id.cardNumber, id.variation].join("|").toLowerCase();
}

function makeDemoCard(id: Identity, index: number): StoredCard {
  const key = identityKey(id);
  const h = hash(key);
  const marketValue = Math.round((18 + (h % 48000) / 100) * 100) / 100;
  const costFactor = 0.62 + ((h >> 7) % 58) / 100;
  const purchasePrice = Math.round(marketValue * costFactor * 100) / 100;
  const change7d = ((h % 330) - 145) / 10;
  const velocity = 25 + ((h >> 4) % 74);
  const score = Math.max(18, Math.min(96, Math.round(56 + change7d * 1.6 + (velocity - 50) * 0.35)));
  const tone: "buy" | "hold" | "sell" = score >= 74 ? "buy" : score <= 42 ? "sell" : "hold";
  const move = `${change7d >= 0 ? "+" : ""}${change7d.toFixed(1)}% 7D`;
  return {
    id: Date.now() + index + 1,
    player: id.playerName || "Catalog card",
    year: id.year,
    setName: id.setName,
    cardNumber: id.cardNumber,
    variant: id.variation,
    meta: [id.year, id.setName, id.cardNumber ? `#${id.cardNumber}` : "", id.variation].filter(Boolean).join(" · "),
    mode: "owned",
    score,
    move,
    tone,
    marketValue,
    purchasePrice,
    analyzed: true,
    demo: true,
    demoMetrics: true,
    catalogConfirmed: true,
    catalogSource: id.source || "CardSight",
    catalogCardId: id.cardId,
    canonicalIdentity: id,
    liveValuation: { compCount: 8 + (h % 31), median: marketValue, confidence: "DEMO" },
  };
}

function classify(card: StoredCard): PulseRow {
  const h = hash(card.canonicalIdentity ? identityKey(card.canonicalIdentity) : `${card.player}|${card.meta}`);
  const parsed = Number.parseFloat((card.move || "").replace(/[^\d+-.]/g, ""));
  const change7d = Number.isFinite(parsed) ? parsed : card.demoMetrics ? ((h % 330) - 145) / 10 : null;
  const velocity = card.demoMetrics ? 25 + ((h >> 4) % 74) : card.liveValuation?.compCount ? Math.min(100, 25 + card.liveValuation.compCount * 3) : null;
  const score = Number(card.score || 0);
  const comps = Number(card.liveValuation?.compCount || 0);
  let pulse: PulseStatus = "NOT ENOUGH DATA";
  if (card.demoMetrics || comps >= 3 || score > 0) {
    if ((change7d ?? 0) <= -9 || score <= 38) pulse = "SELL RISK";
    else if ((change7d ?? 0) >= 8 && (velocity ?? 0) >= 55 && score >= 72) pulse = "BUY MORE";
    else if (Math.abs(change7d ?? 0) >= 5 || score < 55) pulse = "WATCH CLOSELY";
    else pulse = "HOLD";
  }
  return { ...card, pulse, change7d, velocity, confidence: card.demoMetrics ? "SIMULATED" : comps >= 8 ? "HIGH" : comps >= 3 ? "MODERATE" : "LOW" };
}

function statusClass(status: PulseStatus) {
  return status === "BUY MORE" ? "buy" : status === "SELL RISK" ? "sell" : status === "WATCH CLOSELY" ? "watch" : status === "HOLD" ? "hold" : "nodata";
}

export default function PortfolioPulseLayer() {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState("");

  const refresh = () => setCards(readCards());
  useEffect(() => { refresh(); const onChange = () => refresh(); window.addEventListener("cardsignal:user-cards-changed", onChange); return () => window.removeEventListener("cardsignal:user-cards-changed", onChange); }, []);
  useEffect(() => { if (open) refresh(); }, [open]);

  const rows = useMemo(() => cards.filter((card) => card.mode !== "watching").map(classify), [cards]);
  const counts = useMemo(() => ({
    buy: rows.filter((r) => r.pulse === "BUY MORE").length,
    sell: rows.filter((r) => r.pulse === "SELL RISK").length,
    watch: rows.filter((r) => r.pulse === "WATCH CLOSELY").length,
    hold: rows.filter((r) => r.pulse === "HOLD").length,
    nodata: rows.filter((r) => r.pulse === "NOT ENOUGH DATA").length,
  }), [rows]);

  const seedDemo = async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedProgress("Checking CardSight catalog…");
    try {
      const found: Identity[] = [];
      const seen = new Set<string>();
      for (let start = 0; start < DEMO_QUERIES.length && found.length < 50; start += 5) {
        const batch = DEMO_QUERIES.slice(start, start + 5);
        const results = await Promise.all(batch.map(async (query) => {
          try {
            const response = await fetch(`/api/card-suggestions?source=cardsight&q=${encodeURIComponent(query)}`, { cache: "no-store" });
            const json = await response.json() as { suggestions?: Identity[] };
            return json.suggestions?.[0] || null;
          } catch { return null; }
        }));
        for (const item of results) {
          if (!item || !item.playerName || !item.year || !item.setName) continue;
          const key = identityKey(item);
          if (seen.has(key)) continue;
          seen.add(key); found.push(item);
          if (found.length >= 50) break;
        }
        setSeedProgress(`Verified ${found.length} / 50 catalog cards…`);
      }
      const current = readCards().filter((card) => !card.demo);
      const demo = found.slice(0, 50).map(makeDemoCard);
      writeCards([...demo, ...current]);
      setSeedProgress(`Loaded ${demo.length} verified catalog cards. Market metrics are simulated for UI testing.`);
      refresh();
    } finally { setSeeding(false); }
  };

  const clearDemo = () => {
    writeCards(readCards().filter((card) => !card.demo));
    setSeedProgress("Demo cards removed. Your non-demo cards were kept.");
    refresh();
  };

  return <>
    <button className="cs-pulse-launch" onClick={() => setOpen(true)}>◉ PORTFOLIO PULSE</button>
    {open && <div className="cs-pulse-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <section className="cs-pulse-modal">
        <button className="cs-pulse-close" onClick={() => setOpen(false)}>×</button>
        <div className="cs-pulse-head"><span>COLLECTION INTELLIGENCE</span><h2>Portfolio Pulse</h2><p>Which cards deserve attention today? Catalog identity is real; demo market metrics are clearly labeled simulated.</p></div>
        <div className="cs-pulse-actions"><button onClick={seedDemo} disabled={seeding}>{seeding ? "LOADING VERIFIED CARDS…" : "LOAD 50 VERIFIED DEMO CARDS"}</button><button className="secondary" onClick={clearDemo}>CLEAR DEMO CARDS</button></div>
        {seedProgress && <div className="cs-pulse-progress">{seedProgress}</div>}
        <div className="cs-pulse-stats">
          <div className="buy"><small>BUY MORE</small><strong>{counts.buy}</strong><span>momentum + velocity</span></div>
          <div className="sell"><small>SELL RISK</small><strong>{counts.sell}</strong><span>price weakness</span></div>
          <div className="watch"><small>WATCH CLOSELY</small><strong>{counts.watch}</strong><span>meaningful movement</span></div>
          <div className="hold"><small>HOLD</small><strong>{counts.hold}</strong><span>stable / constructive</span></div>
          <div className="nodata"><small>NEEDS DATA</small><strong>{counts.nodata}</strong><span>not enough evidence</span></div>
        </div>
        <div className="cs-pulse-list">
          {rows.length === 0 ? <div className="cs-pulse-empty"><b>No owned cards yet.</b><span>Load the verified demo portfolio or add your own cards.</span></div> : rows.sort((a,b) => {
            const rank: Record<PulseStatus, number> = { "SELL RISK":0, "BUY MORE":1, "WATCH CLOSELY":2, "HOLD":3, "NOT ENOUGH DATA":4 };
            return rank[a.pulse]-rank[b.pulse];
          }).map((card) => <article key={card.id} className="cs-pulse-row">
            <div><strong>{card.player}</strong><span>{card.meta || "Card details unavailable"}</span><small>{card.catalogConfirmed ? `✓ ${card.catalogSource || "Catalog"} confirmed` : "Manual identity"}{card.demo ? " · DEMO CARD" : ""}</small></div>
            <div className="metric"><small>7D</small><b className={(card.change7d ?? 0) < 0 ? "negative" : "positive"}>{card.change7d == null ? "—" : `${card.change7d >= 0 ? "+" : ""}${card.change7d.toFixed(1)}%`}</b></div>
            <div className="metric"><small>VELOCITY</small><b>{card.velocity == null ? "—" : `${card.velocity}/100`}</b></div>
            <div className={`cs-pulse-badge ${statusClass(card.pulse)}`}><b>{card.pulse}</b><small>{card.confidence}{card.demoMetrics ? " METRICS" : " CONFIDENCE"}</small></div>
          </article>)}
        </div>
        <div className="cs-pulse-note">Demo cards are genuine catalog identities returned by CardSight. Demo prices, changes, velocity and signals are simulated only to exercise the Portfolio Pulse interface; they are not presented as live market facts.</div>
      </section>
    </div>}
    <style jsx global>{`
      .cs-pulse-launch{position:fixed;left:24px;bottom:122px;z-index:890;height:38px;padding:0 14px;border:1px solid rgba(72,241,157,.33);border-radius:9px;background:rgba(7,38,34,.94);color:#99ffc5;font-size:9px;font-weight:900;letter-spacing:.11em;cursor:pointer}
      .cs-pulse-backdrop{position:fixed;inset:0;z-index:1460;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.86);backdrop-filter:blur(15px)}.cs-pulse-modal{position:relative;width:min(1140px,97vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(73,205,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.76);color:#effaff}.cs-pulse-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-pulse-head>span{color:#58e5ff;font-size:9px;font-weight:900;letter-spacing:.17em}.cs-pulse-head h2{margin:7px 0 5px;font-size:32px}.cs-pulse-head p{margin:0;color:#7896a8;font-size:11px}.cs-pulse-actions{display:flex;gap:8px;margin:18px 0 8px}.cs-pulse-actions button{height:40px;padding:0 15px;border:1px solid rgba(67,241,155,.4);border-radius:8px;background:rgba(39,202,124,.1);color:#9affc5;font-size:9px;font-weight:900;letter-spacing:.08em;cursor:pointer}.cs-pulse-actions button.secondary{border-color:rgba(83,190,230,.2);background:#071724;color:#86b7ca}.cs-pulse-actions button:disabled{opacity:.45}.cs-pulse-progress{margin:8px 0 14px;padding:10px;border:1px solid rgba(80,202,242,.16);border-radius:8px;background:#071724;color:#8edff8;font-size:9px}
      .cs-pulse-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}.cs-pulse-stats>div{padding:13px;border:1px solid rgba(76,188,229,.12);border-radius:10px;background:rgba(7,25,39,.72)}.cs-pulse-stats small{display:block;color:#66899a;font-size:7px;font-weight:900;letter-spacing:.1em}.cs-pulse-stats strong{display:block;margin:6px 0 3px;font-size:22px}.cs-pulse-stats span{color:#5f8091;font-size:8px}.cs-pulse-stats .buy strong{color:#5cf0a0}.cs-pulse-stats .sell strong{color:#ff7d8d}.cs-pulse-stats .watch strong{color:#f0c66f}.cs-pulse-stats .hold strong{color:#75d9f5}
      .cs-pulse-list{display:flex;flex-direction:column;gap:6px}.cs-pulse-row{display:grid;grid-template-columns:minmax(280px,1fr) 92px 110px 165px;gap:12px;align-items:center;padding:11px 12px;border:1px solid rgba(76,188,229,.1);border-radius:10px;background:rgba(5,20,32,.7)}.cs-pulse-row>div:first-child strong,.cs-pulse-row>div:first-child span,.cs-pulse-row>div:first-child small{display:block}.cs-pulse-row>div:first-child strong{font-size:11px}.cs-pulse-row>div:first-child span{margin-top:3px;color:#9ab4c2;font-size:9px}.cs-pulse-row>div:first-child small{margin-top:4px;color:#5e7e90;font-size:7px}.cs-pulse-row .metric small{display:block;color:#5e7e90;font-size:7px;font-weight:900}.cs-pulse-row .metric b{display:block;margin-top:4px;font-size:11px}.positive{color:#5eeaa0!important}.negative{color:#ff7b8b!important}.cs-pulse-badge{padding:8px 9px;border-radius:8px;border:1px solid rgba(92,174,205,.15);background:#071724}.cs-pulse-badge b,.cs-pulse-badge small{display:block}.cs-pulse-badge b{font-size:8px}.cs-pulse-badge small{margin-top:3px;color:#6e8fa0;font-size:6px;letter-spacing:.07em}.cs-pulse-badge.buy{border-color:rgba(70,239,154,.3);color:#75f1ab}.cs-pulse-badge.sell{border-color:rgba(255,91,111,.3);color:#ff8998}.cs-pulse-badge.watch{border-color:rgba(240,197,109,.28);color:#f0c56d}.cs-pulse-badge.hold{border-color:rgba(83,205,245,.24);color:#7eddf8}.cs-pulse-badge.nodata{color:#7795a5}.cs-pulse-empty{padding:30px;border:1px dashed rgba(80,188,225,.16);border-radius:10px;text-align:center;color:#7897a8}.cs-pulse-empty b,.cs-pulse-empty span{display:block}.cs-pulse-empty span{margin-top:5px;font-size:9px}.cs-pulse-note{margin-top:12px;padding-top:12px;border-top:1px solid rgba(78,183,224,.1);color:#607f90;font-size:8px;line-height:1.45}
      @media(max-width:850px){.cs-pulse-stats{grid-template-columns:repeat(2,1fr)}.cs-pulse-row{grid-template-columns:1fr 90px 145px}.cs-pulse-row .metric:nth-of-type(3){display:none}.cs-pulse-launch{left:14px;bottom:114px}}@media(max-width:600px){.cs-pulse-modal{padding:22px 14px}.cs-pulse-row{grid-template-columns:1fr}.cs-pulse-stats{grid-template-columns:1fr 1fr}.cs-pulse-actions{flex-direction:column}}
    `}</style>
  </>;
}
