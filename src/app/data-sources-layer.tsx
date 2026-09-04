"use client";

import { useState } from "react";

type Status = "not-tested" | "testing" | "connected" | "error" | "missing-key" | "configured";
type Result = { ok: boolean; provider: string; status: Status; ms: number; sample?: Record<string, unknown>; error?: string; upstreamStatus?: number };

type Source = { key: string; name: string; role: string; description: string };

const SOURCES: Source[] = [
  { key: "soldcomps", name: "SoldComps", role: "Completed sales", description: "Recent sold eBay comps and sale prices." },
  { key: "parse", name: "TCDB / Parse", role: "Catalog + checklists", description: "Set discovery, checklists, card identity and metadata." },
  { key: "psa", name: "PSA", role: "Graded identity", description: "PSA cert verification and exact slab identity." },
  { key: "cardapi", name: "The Card API", role: "Completed sales", description: "Second sale feed for cross-checking market observations." },
];

function formatValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DataSourcesLayer() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [testingAll, setTestingAll] = useState(false);

  const testOne = async (key: string) => {
    setResults((prev) => ({ ...prev, [key]: { ok: false, provider: key, status: "testing", ms: 0 } }));
    try {
      const response = await fetch(`/api/data-sources?provider=${encodeURIComponent(key)}`, { cache: "no-store" });
      const json = await response.json() as Result;
      setResults((prev) => ({ ...prev, [key]: json }));
    } catch (error) {
      setResults((prev) => ({ ...prev, [key]: { ok: false, provider: key, status: "error", ms: 0, error: error instanceof Error ? error.message : "Test failed" } }));
    }
  };

  const testAll = async () => {
    setTestingAll(true);
    setResults(Object.fromEntries(SOURCES.map((source) => [source.key, { ok: false, provider: source.name, status: "testing", ms: 0 } as Result])));
    try {
      const response = await fetch("/api/data-sources?provider=all", { cache: "no-store" });
      const json = await response.json() as { results?: Result[] };
      const next: Record<string, Result> = {};
      (json.results ?? []).forEach((result) => {
        const key = SOURCES.find((source) => source.name === result.provider)?.key;
        if (key) next[key] = result;
      });
      setResults(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test all failed";
      setResults(Object.fromEntries(SOURCES.map((source) => [source.key, { ok: false, provider: source.name, status: "error", ms: 0, error: message } as Result])));
    } finally { setTestingAll(false); }
  };

  return (
    <>
      <button className="cs-sources-launch" onClick={() => setOpen(true)}><span /> DATA SOURCES</button>
      {open && <div className="cs-sources-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
        <section className="cs-sources-modal">
          <button className="cs-sources-close" onClick={() => setOpen(false)}>×</button>
          <div className="cs-sources-head">
            <span>INTERNAL DIAGNOSTICS</span>
            <h2>Data Sources</h2>
            <p>Verify every CardSignal provider independently before we combine them into the signal engine.</p>
            <button className="cs-test-all" onClick={testAll} disabled={testingAll}>{testingAll ? "TESTING…" : "TEST ALL SOURCES"}</button>
          </div>

          <div className="cs-sources-grid">
            {SOURCES.map((source) => {
              const result = results[source.key];
              const status = result?.status ?? "not-tested";
              return <article className="cs-source-card" key={source.key}>
                <div className="cs-source-top">
                  <div><small>{source.role}</small><h3>{source.name}</h3><p>{source.description}</p></div>
                  <span className={`cs-source-status ${status}`}>{status === "not-tested" ? "NOT TESTED" : status === "testing" ? "TESTING" : status === "connected" ? "CONNECTED" : status === "missing-key" ? "MISSING KEY" : status.toUpperCase()}</span>
                </div>
                <div className="cs-source-meta"><span>RESPONSE</span><b>{result?.ms ? `${result.ms} ms` : "—"}</b>{result?.upstreamStatus ? <em>HTTP {result.upstreamStatus}</em> : null}</div>
                {result?.sample && <div className="cs-source-sample">
                  {Object.entries(result.sample).slice(0, 6).map(([key, value]) => <div key={key}><span>{key.replace(/([A-Z])/g, " $1").toUpperCase()}</span><b>{formatValue(value)}</b></div>)}
                </div>}
                {result?.error && <div className="cs-source-error">{result.error}</div>}
                <button className="cs-source-test" onClick={() => testOne(source.key)} disabled={status === "testing"}>{status === "testing" ? "TESTING…" : result ? "RETEST" : "TEST"}</button>
              </article>;
            })}
          </div>

          <div className="cs-authority-map">
            <span>AUTHORITY MAP</span><h3>How CardSignal will use each source</h3>
            <div><b>Card identity</b><p>PSA → TCDB / Parse → user input</p></div>
            <div><b>Completed sales</b><p>SoldComps + The Card API</p></div>
            <div><b>Catalog / checklists</b><p>TCDB / Parse</p></div>
            <div><b>Graded identity</b><p>PSA</p></div>
            <div><b>Historical trends</b><p>CardSignal cached snapshots</p></div>
          </div>
        </section>
      </div>}
      <style jsx global>{`
        .cs-sources-launch{position:fixed;left:24px;bottom:24px;z-index:900;height:42px;padding:0 15px;border:1px solid rgba(71,201,255,.34);border-radius:10px;background:linear-gradient(180deg,rgba(25,117,160,.2),rgba(5,25,38,.94));color:#a8eaff;font-size:10px;font-weight:900;letter-spacing:.11em;cursor:pointer}.cs-sources-launch span{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#4bd9ff;box-shadow:0 0 10px #4bd9ff}
        .cs-sources-backdrop{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:24px;background:rgba(0,7,12,.84);backdrop-filter:blur(15px)}.cs-sources-modal{position:relative;width:min(1120px,97vw);max-height:92vh;overflow:auto;padding:30px;border:1px solid rgba(73,205,255,.22);border-radius:20px;background:linear-gradient(155deg,#081d2e,#04111d 62%,#061821);box-shadow:0 44px 130px rgba(0,0,0,.74);color:#effaff}.cs-sources-modal:before{content:"";position:absolute;top:0;left:0;width:230px;height:2px;background:linear-gradient(90deg,#4cf0a5,transparent);box-shadow:0 0 18px rgba(76,240,165,.55)}.cs-sources-close{position:absolute;right:18px;top:16px;width:34px;height:34px;border:1px solid rgba(102,189,224,.16);border-radius:9px;background:#071724;color:#8cabbd;font-size:24px;cursor:pointer}.cs-sources-head{position:relative;padding-right:150px}.cs-sources-head>span,.cs-authority-map>span{color:#53d9ff;font-size:9px;font-weight:900;letter-spacing:.17em}.cs-sources-head h2{margin:7px 0 5px;font-size:32px;letter-spacing:-.04em}.cs-sources-head p{margin:0;color:#7896a8;font-size:11px}.cs-test-all{position:absolute;right:0;bottom:0;height:40px;padding:0 16px;border:1px solid rgba(68,241,155,.4);border-radius:8px;background:rgba(39,202,124,.1);color:#9affc5;font-size:9px;font-weight:900;letter-spacing:.09em;cursor:pointer}.cs-test-all:disabled{opacity:.45}
        .cs-sources-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.cs-source-card{border:1px solid rgba(76,188,229,.13);border-radius:13px;background:rgba(7,25,39,.76);padding:16px}.cs-source-top{display:flex;justify-content:space-between;gap:16px}.cs-source-top small{color:#55d9ff;font-size:8px;font-weight:900;letter-spacing:.12em}.cs-source-top h3{margin:5px 0 4px;font-size:18px}.cs-source-top p{margin:0;color:#6f8d9f;font-size:10px;line-height:1.45}.cs-source-status{height:25px;padding:0 8px;display:flex;align-items:center;border:1px solid rgba(111,143,160,.2);border-radius:999px;color:#7897a9;font-size:7px;font-weight:900;letter-spacing:.11em;white-space:nowrap}.cs-source-status.connected{color:#6df1aa;border-color:rgba(77,239,159,.34);background:rgba(46,190,123,.08)}.cs-source-status.error{color:#ff8694;border-color:rgba(255,91,111,.32);background:rgba(168,42,58,.08)}.cs-source-status.missing-key{color:#f0c56d;border-color:rgba(240,197,109,.28)}.cs-source-status.testing{color:#66ddff;border-color:rgba(82,205,245,.28)}
        .cs-source-meta{display:flex;align-items:center;gap:8px;margin:14px 0 9px;padding-top:11px;border-top:1px solid rgba(76,188,229,.1)}.cs-source-meta span{color:#648497;font-size:7px;font-weight:900;letter-spacing:.12em}.cs-source-meta b{font-size:10px}.cs-source-meta em{margin-left:auto;color:#7896a8;font-size:8px;font-style:normal}.cs-source-sample{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}.cs-source-sample>div{min-width:0;padding:8px;border:1px solid rgba(75,188,228,.08);border-radius:7px;background:#06131f}.cs-source-sample span{display:block;color:#557488;font-size:7px;font-weight:900;letter-spacing:.09em}.cs-source-sample b{display:block;margin-top:3px;color:#cfe7f1;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-source-error{margin:8px 0;padding:9px;border:1px solid rgba(255,91,111,.22);border-radius:8px;background:rgba(150,30,47,.08);color:#ff9ba8;font-size:9px;line-height:1.4}.cs-source-test{width:100%;height:36px;margin-top:8px;border:1px solid rgba(75,207,255,.26);border-radius:8px;background:#071724;color:#88dcf7;font-size:8px;font-weight:900;letter-spacing:.1em;cursor:pointer}.cs-source-test:hover{border-color:rgba(72,238,157,.4);color:#a8ffd0}.cs-source-test:disabled{opacity:.4}
        .cs-authority-map{display:grid;grid-template-columns:1.35fr repeat(5,1fr);gap:9px;align-items:stretch;padding-top:18px;border-top:1px solid rgba(78,183,224,.12)}.cs-authority-map>span{grid-column:1/-1}.cs-authority-map>h3{margin:0;padding:13px;border:1px solid rgba(74,187,229,.12);border-radius:10px;background:rgba(8,27,42,.7);font-size:15px}.cs-authority-map>div{padding:12px;border:1px solid rgba(74,187,229,.1);border-radius:10px;background:rgba(6,21,33,.68)}.cs-authority-map b{display:block;color:#65e7ff;font-size:8px;letter-spacing:.08em}.cs-authority-map p{margin:6px 0 0;color:#9bb5c3;font-size:9px;line-height:1.4}
        @media(max-width:800px){.cs-sources-grid{grid-template-columns:1fr}.cs-authority-map{grid-template-columns:1fr 1fr}.cs-authority-map>h3{grid-column:1/-1}.cs-sources-head{padding-right:0}.cs-test-all{position:static;margin-top:14px}.cs-sources-launch{left:14px;bottom:14px}}@media(max-width:520px){.cs-sources-modal{padding:22px 14px}.cs-authority-map{grid-template-columns:1fr}.cs-source-sample{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
