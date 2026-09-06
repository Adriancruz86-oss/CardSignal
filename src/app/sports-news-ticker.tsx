"use client";

import { useEffect, useState } from "react";

type Headline = {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  league: string;
};
const CACHE_KEY = "cardsignal-sports-news";

function cachedHeadlines(): Headline[] {
  try {
    const payload = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return Array.isArray(payload.headlines) ? payload.headlines : [];
  } catch {
    return [];
  }
}

function age(iso: string) {
  const elapsed = Date.now() - Date.parse(iso);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "recent";
  if (elapsed < 3600000) return `${Math.max(1, Math.round(elapsed / 60000))}m`;
  return `${Math.max(1, Math.round(elapsed / 3600000))}h`;
}

export default function SportsNewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [status, setStatus] = useState("Loading sports headlines…");

  useEffect(() => {
    const cached = cachedHeadlines();
    if (cached.length) {
      setHeadlines(cached);
      setStatus("");
    }
    const controller = new AbortController();
    fetch("/api/sports-news", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok)
          throw new Error(payload.error || "Headlines unavailable");
        const rows = Array.isArray(payload.headlines) ? payload.headlines : [];
        setHeadlines(rows);
        setStatus(rows.length ? "" : "No recent sports headlines found");
        if (rows.length)
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ headlines: rows, fetchedAt: payload.fetchedAt }),
          );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        if (!cached.length)
          setStatus("Sports headlines temporarily unavailable");
      });
    return () => controller.abort();
  }, []);

  const loop = headlines.length > 1 ? [...headlines, ...headlines] : headlines;
  return (
    <section className="cs-news-ticker" aria-label="Latest sports headlines">
      <div className="cs-news-label">
        <i /> SPORTS WIRE
      </div>
      <div className="cs-news-window">
        {status ? (
          <span className="cs-news-status">{status}</span>
        ) : (
          <div className="cs-news-track">
            {loop.map((headline, index) => (
              <a
                key={`${headline.url}-${index}`}
                href={headline.url}
                target="_blank"
                rel="noreferrer"
              >
                <b>{headline.league}</b>
                <span>{headline.title}</span>
                <small>
                  {headline.domain} · {age(headline.publishedAt)}
                </small>
              </a>
            ))}
          </div>
        )}
      </div>
      <span className="cs-news-source">GDELT · 15m cache</span>
      <style jsx>{`
        .cs-news-ticker {
          position: relative;
          z-index: 130;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          min-height: 34px;
          border-bottom: 1px solid rgba(78, 190, 230, 0.12);
          background: #05131e;
          color: #bdd4de;
          overflow: hidden;
        }
        .cs-news-label {
          height: 34px;
          padding: 0 16px 0 24px;
          display: flex;
          align-items: center;
          gap: 7px;
          border-right: 1px solid rgba(78, 190, 230, 0.14);
          color: #d6edf5;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
          white-space: nowrap;
        }
        .cs-news-label i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #58eda1;
        }
        .cs-news-window {
          min-width: 0;
          overflow: hidden;
        }
        .cs-news-track {
          display: flex;
          width: max-content;
          animation: csNewsTicker 150s linear infinite;
        }
        .cs-news-window:hover .cs-news-track,
        .cs-news-window:focus-within .cs-news-track {
          animation-play-state: paused;
        }
        .cs-news-track a {
          min-height: 34px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-right: 1px solid rgba(78, 190, 230, 0.1);
          color: inherit;
          text-decoration: none;
          white-space: nowrap;
        }
        .cs-news-track a:hover span {
          color: #ffffff;
        }
        .cs-news-track b {
          color: #61dcff;
          font-size: 7px;
          letter-spacing: 0.08em;
        }
        .cs-news-track span {
          max-width: 620px;
          overflow: hidden;
          color: #c3d9e2;
          font-size: 9px;
          text-overflow: ellipsis;
        }
        .cs-news-track small,
        .cs-news-source,
        .cs-news-status {
          color: #638291;
          font-size: 7px;
        }
        .cs-news-source {
          padding: 0 18px;
          white-space: nowrap;
        }
        .cs-news-status {
          padding-left: 16px;
        }
        @keyframes csNewsTicker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-news-track {
            animation: none;
            max-width: 100%;
            overflow-x: auto;
          }
        }
        @media (max-width: 700px) {
          .cs-news-ticker {
            grid-template-columns: auto minmax(0, 1fr);
          }
          .cs-news-label {
            padding-left: 14px;
          }
          .cs-news-source {
            display: none;
          }
          .cs-news-track span {
            max-width: 300px;
          }
        }
      `}</style>
    </section>
  );
}
