"use client";

import LiveSealedDiscovery from "./live-sealed-discovery";
import HotRightNow from "./hot-right-now";
import SealedOwnership from "./sealed-ownership";
import "./sealed.css";

const sections = [
  ["hot", "Hot right now"],
  ["discover", "Discover"],
  ["portfolio", "My sealed"],
] as const;

export default function SealedPage() {
  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="sealed-shell">
      <header className="sealed-topbar">
        <button className="sealed-brand" onClick={() => (window.location.href = "/")}>Card<span>Signal</span></button>
        <div className="sealed-title-lockup">
          <small>SEALED</small>
          <b>Sports + Pokémon wax</b>
        </div>
        <button className="back-button" onClick={() => (window.location.href = "/")}>Dashboard</button>
      </header>

      <section className="sealed-intro">
        <div className="sealed-intro-copy">
          <span className="sealed-eyebrow">SEALED MARKET</span>
          <h1>Find the wax that is moving. Buy it at the right price.</h1>
          <p>Live discovery, market momentum, retail entry checks, restock tracking, and your own cost basis — in one place.</p>
        </div>
        <div className="sealed-intro-status">
          <div><span>MARKET</span><b>Live scans</b></div>
          <div><span>BUY SIDE</span><b>Retail Radar</b></div>
          <div><span>OWNERSHIP</span><b>Cost basis</b></div>
        </div>
      </section>

      <nav className="sealed-section-nav" aria-label="Sealed sections">
        {sections.map(([id, label], index) => (
          <button key={id} onClick={() => go(id)}>
            <span>{String(index + 1).padStart(2, "0")}</span>{label}
          </button>
        ))}
      </nav>

      <section id="hot" className="sealed-section-block sealed-section-featured">
        <HotRightNow />
      </section>

      <section id="discover" className="sealed-section-block">
        <div className="sealed-section-label"><span>DISCOVER</span><p>Search, verify, compare entry prices, then track the exact product.</p></div>
        <LiveSealedDiscovery />
      </section>

      <section id="portfolio" className="sealed-section-block sealed-section-last">
        <div className="sealed-section-label"><span>MY SEALED</span><p>See what you own, what you paid, and whether the position is worth adding to, holding, or trimming.</p></div>
        <SealedOwnership />
      </section>
    </main>
  );
}
