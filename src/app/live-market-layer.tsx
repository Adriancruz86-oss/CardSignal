"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Comp = {
  id: string;
  title: string;
  soldPrice: number | null;
  shippingCost: number | null;
  soldDate: string;
  condition: string;
  url: string;
  image: string;
  marketplace: string;
};

type MarketResponse = {
  ok: boolean;
  source?: string;
  fetchedAt?: string;
  query?: string;
  comps?: Comp[];
  error?: string;
  setupRequired?: boolean;
};

type MatchLabel = "Exact" | "Strong" | "Loose" | "Rejected";

type MatchResult = {
  score: number;
  label: MatchLabel;
  rejected: boolean;
  reasons: string[];
  identityKey: string;
  identityLabel: string;
};

type MarketTarget = {
  cardId?: number;
  player?: string;
  meta?: string;
};

const INSERTS = [
  "instant impact",
  "emergent",
  "global reach",
  "deep space",
  "decade brilliance",
  "get hyped",
  "dominance",
  "fireworks",
  "instant impact prizm",
  "rookie variation",
  "sensational signatures",
  "penmanship",
  "luck of the lottery",
  "fearless",
  "throwback",
];

const SET_WORDS = [
  "prizm",
  "select",
  "optic",
  "mosaic",
  "topps chrome",
  "bowman chrome",
  "hoops premium stock",
];
const VARIANTS = [
  "silver",
  "refractor",
  "holo",
  "hyper",
  "red",
  "blue",
  "green",
  "purple",
  "gold",
  "orange",
  "pink",
  "wave",
  "ice",
  "cracked ice",
  "scope",
  "shimmer",
  "auto",
  "autograph",
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9#/+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(value: number | null | undefined) {
  return value == null
    ? "—"
    : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(comps: Comp[]) {
  const prices = comps
    .map((c) => c.soldPrice)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (!prices.length)
    return { count: 0, median: null, average: null, low: null, high: null };
  return {
    count: prices.length,
    median: median(prices),
    average: prices.reduce((a, b) => a + b, 0) / prices.length,
    low: prices[0],
    high: prices[prices.length - 1],
  };
}

function extractYear(text: string) {
  const match = text.match(/\b((?:19|20)\d{2})(?:-(\d{2,4}))?\b/);
  if (!match) return "";
  return match[2] ? `${match[1]}-${match[2].slice(-2)}` : match[1];
}

function yearMatches(queryYear: string, titleYear: string) {
  if (!queryYear || !titleYear) return true;
  return queryYear.slice(0, 4) === titleYear.slice(0, 4);
}

function extractCardNumber(text: string) {
  const direct = text.match(/#\s*(\d{1,4})\b/);
  if (direct) return direct[1];
  const card = text.match(/\bcard\s*#?\s*(\d{1,4})\b/);
  return card?.[1] ?? "";
}

function extractSerial(text: string) {
  const match = text.match(/(?:^|\s)\/(\d{2,4})\b/);
  return match?.[1] ?? "";
}

function findPhrase(text: string, phrases: string[]) {
  return phrases.find((phrase) => text.includes(phrase)) ?? "";
}

function queryPlayerTokens(query: string) {
  const n = normalize(query);
  const beforeYear = n.split(/\b(?:19|20)\d{2}/)[0].trim();
  return beforeYear
    .split(" ")
    .filter((token) => token.length > 1)
    .slice(0, 3);
}

function describeIdentity(title: string) {
  const n = normalize(title);
  const insert = findPhrase(n, INSERTS);
  const number = extractCardNumber(n);
  if (insert)
    return {
      key: `insert:${insert}:${number || "?"}`,
      label: `${insert.replace(/\b\w/g, (c) => c.toUpperCase())}${number ? ` #${number}` : ""}`,
    };
  if (number)
    return { key: `base:#${number}`, label: `Base / main set #${number}` };
  return { key: "base:unknown", label: "Base / main set (number not shown)" };
}

function matchComp(
  query: string,
  comp: Comp,
  selectedIdentity: string,
): MatchResult {
  const q = normalize(query);
  const t = normalize(comp.title);
  const reasons: string[] = [];
  let score = 0;
  let rejected = false;

  const playerTokens = queryPlayerTokens(query);
  const playerHits = playerTokens.filter((token) => t.includes(token)).length;
  if (playerTokens.length && playerHits === playerTokens.length) score += 35;
  else {
    rejected = true;
    reasons.push("player mismatch");
  }

  const qYear = extractYear(q);
  const tYear = extractYear(t);
  if (qYear && tYear) {
    if (yearMatches(qYear, tYear)) score += 10;
    else {
      rejected = true;
      reasons.push("year mismatch");
    }
  }

  const qSet = findPhrase(q, SET_WORDS);
  if (qSet) {
    if (t.includes(qSet)) score += 15;
    else {
      rejected = true;
      reasons.push("different product/set");
    }
  }

  const qVariant = findPhrase(q, VARIANTS);
  if (qVariant) {
    if (t.includes(qVariant)) score += 15;
    else {
      rejected = true;
      reasons.push("parallel/variant mismatch");
    }
  }

  const qInsert = findPhrase(q, INSERTS);
  const tInsert = findPhrase(t, INSERTS);
  if (!qInsert && tInsert) {
    rejected = true;
    reasons.push(`different insert: ${tInsert}`);
  } else if (qInsert) {
    if (tInsert === qInsert) score += 12;
    else {
      rejected = true;
      reasons.push("insert mismatch");
    }
  }

  const qSerial = extractSerial(q);
  const tSerial = extractSerial(t);
  if (!qSerial && tSerial) {
    rejected = true;
    reasons.push(`numbered parallel /${tSerial}`);
  } else if (qSerial && qSerial !== tSerial) {
    rejected = true;
    reasons.push("serial-number mismatch");
  }

  const qNumber = extractCardNumber(q);
  const tNumber = extractCardNumber(t);
  if (qNumber) {
    if (tNumber === qNumber) score += 13;
    else if (tNumber) {
      rejected = true;
      reasons.push(`card #${tNumber}, not #${qNumber}`);
    } else reasons.push("card number not shown");
  }

  const grader = ["psa", "bgs", "sgc", "cgc"].find((g) => q.includes(g));
  if (grader) {
    if (t.includes(grader)) score += 7;
    else {
      rejected = true;
      reasons.push("grader mismatch");
    }
  }

  const gradeMatch = q.match(
    /\b(?:psa|bgs|sgc|cgc)\s*(10|9(?:\.5)?|8(?:\.5)?|7(?:\.5)?)\b/,
  );
  if (gradeMatch) {
    const gradePattern = new RegExp(
      `\\b(?:psa|bgs|sgc|cgc)\\s*${gradeMatch[1].replace(".", "\\.")}\\b`,
    );
    if (gradePattern.test(t)) score += 8;
    else {
      rejected = true;
      reasons.push(`grade ${gradeMatch[1]} mismatch`);
    }
  }

  const identity = describeIdentity(comp.title);
  if (selectedIdentity && identity.key !== selectedIdentity) {
    rejected = true;
    reasons.push("different card identity");
  }

  let label: MatchLabel = "Loose";
  if (rejected) label = "Rejected";
  else if (score >= 88 && (Boolean(qNumber) || Boolean(selectedIdentity)))
    label = "Exact";
  else if (score >= 72) label = "Strong";

  return {
    score: Math.min(100, score),
    label,
    rejected,
    reasons,
    identityKey: identity.key,
    identityLabel: identity.label,
  };
}

export default function LiveMarketLayer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MarketResponse | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState("");
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [target, setTarget] = useState<MarketTarget | null>(null);

  const comps = useMemo(() => data?.comps ?? [], [data]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail =
        (event as CustomEvent<MarketTarget & { query?: string }>).detail || {};
      const nextQuery =
        detail.query || [detail.player, detail.meta].filter(Boolean).join(" ");
      setTarget({
        cardId: detail.cardId,
        player: detail.player,
        meta: detail.meta,
      });
      if (nextQuery.trim()) setQuery(nextQuery.replace(/\s*·\s*/g, " ").trim());
      setData(null);
      setSelectedIdentity("");
      setManual({});
      setSaved(false);
      setError("");
      setOpen(true);
    };
    window.addEventListener("cardsignal:open-market", onOpen as EventListener);
    return () =>
      window.removeEventListener(
        "cardsignal:open-market",
        onOpen as EventListener,
      );
  }, []);

  const identityGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; comps: Comp[] }
    >();
    comps.forEach((comp) => {
      const baseMatch = matchComp(query, comp, "");
      if (baseMatch.rejected) return;
      const found = groups.get(baseMatch.identityKey) ?? {
        key: baseMatch.identityKey,
        label: baseMatch.identityLabel,
        comps: [],
      };
      found.comps.push(comp);
      groups.set(baseMatch.identityKey, found);
    });
    return [...groups.values()].sort((a, b) => b.comps.length - a.comps.length);
  }, [comps, query]);

  useEffect(() => {
    if (!data) return;
    const qNumber = extractCardNumber(normalize(query));
    if (qNumber) {
      const targetGroup = identityGroups.find(
        (g) => g.key === `base:#${qNumber}` || g.key.endsWith(`:${qNumber}`),
      );
      setSelectedIdentity(targetGroup?.key ?? "");
    } else if (identityGroups.length === 1) {
      setSelectedIdentity(identityGroups[0].key);
    } else {
      setSelectedIdentity("");
    }
  }, [data, identityGroups, query]);

  const reviewed = useMemo(
    () =>
      comps.map((comp, index) => {
        const key = comp.id || `${index}:${comp.title}`;
        const result = matchComp(query, comp, selectedIdentity);
        const defaultIncluded =
          !result.rejected &&
          (selectedIdentity
            ? result.identityKey === selectedIdentity
            : identityGroups.length <= 1);
        const included = manual[key] ?? defaultIncluded;
        return { comp, key, result, included };
      }),
    [comps, query, selectedIdentity, identityGroups.length, manual],
  );

  const accepted = reviewed.filter((r) => r.included).map((r) => r.comp);
  const valuation = useMemo(() => stats(accepted), [accepted]);
  const acceptedMatches = reviewed.filter((r) => r.included);
  const averageScore = acceptedMatches.length
    ? Math.round(
        acceptedMatches.reduce((sum, r) => sum + r.result.score, 0) /
          acceptedMatches.length,
      )
    : 0;
  const confidence =
    !selectedIdentity && identityGroups.length > 1
      ? "Needs identity"
      : accepted.length >= 3 && averageScore >= 88
        ? "Exact"
        : accepted.length >= 3 && averageScore >= 72
          ? "Strong"
          : accepted.length
            ? "Loose"
            : "No match";
  const canUse =
    accepted.length >= 3 && (confidence === "Exact" || confidence === "Strong");

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    setSelectedIdentity("");
    setManual({});
    setSaved(false);
    try {
      const response = await fetch(
        `/api/market?q=${encodeURIComponent(query.trim())}`,
      );
      const json = (await response.json()) as MarketResponse;
      if (!response.ok || !json.ok)
        throw new Error(json.error || "Live comp search failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live comp search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string, current: boolean) =>
    setManual((prev) => ({ ...prev, [key]: !current }));

  const useValuation = () => {
    if (!canUse || valuation.median == null) return;
    const savedAt = new Date().toISOString();
    const identityLabel =
      identityGroups.find((group) => group.key === selectedIdentity)?.label ||
      selectedIdentity ||
      "Resolved card";
    const acceptedSnapshot = accepted.map((comp) => ({
      id: comp.id,
      title: comp.title,
      soldPrice: comp.soldPrice,
      soldDate: comp.soldDate,
      marketplace: comp.marketplace,
    }));
    const snapshot = {
      query,
      identity: selectedIdentity,
      identityLabel,
      confidence,
      median: valuation.median,
      average: valuation.average,
      low: valuation.low,
      high: valuation.high,
      compCount: valuation.count,
      savedAt,
      acceptedComps: acceptedSnapshot,
      target,
    };
    localStorage.setItem("cardsignal-live-valuation", JSON.stringify(snapshot));

    if (target?.cardId != null || target?.player) {
      try {
        const raw = JSON.parse(
          localStorage.getItem("cardsignal-added-cards") || "[]",
        );
        if (Array.isArray(raw)) {
          const updated = raw.map((card) => {
            const sameId =
              target.cardId != null &&
              Number(card.id) === Number(target.cardId);
            const sameCard =
              !sameId &&
              target.player &&
              card.player === target.player &&
              (!target.meta || card.meta === target.meta);
            if (!sameId && !sameCard) return card;
            return {
              ...card,
              marketValue: valuation.median,
              liveValuation: {
                provider: "SoldComps",
                identity: selectedIdentity,
                identityLabel,
                confidence,
                median: valuation.median,
                average: valuation.average,
                low: valuation.low,
                high: valuation.high,
                compCount: valuation.count,
                savedAt,
                acceptedComps: acceptedSnapshot,
              },
            };
          });
          localStorage.setItem(
            "cardsignal-added-cards",
            JSON.stringify(updated),
          );
        }
      } catch {}

      if (target.player) {
        try {
          const state = JSON.parse(
            localStorage.getItem("cardsignal-card-detail-state") || "{}",
          );
          const key = `${target.player}|${target.meta || ""}`;
          state[key] = {
            ...(state[key] || {}),
            marketValue: valuation.median,
            lastScan: "live comps · just now",
          };
          localStorage.setItem(
            "cardsignal-card-detail-state",
            JSON.stringify(state),
          );
        } catch {}
      }

      window.dispatchEvent(new CustomEvent("cardsignal:user-cards-changed"));
      window.dispatchEvent(
        new CustomEvent("cardsignal:valuation-applied", {
          detail: {
            cardId: target.cardId,
            player: target.player,
            meta: target.meta,
            marketValue: valuation.median,
            confidence,
            compCount: valuation.count,
            savedAt,
          },
        }),
      );
    }

    window.dispatchEvent(
      new CustomEvent("cardsignal:valuation", {
        detail: {
          query,
          marketValue: valuation.median,
          confidence,
          compCount: valuation.count,
          target,
        },
      }),
    );
    setSaved(true);
  };

  return (
    <>
      <button
        className="cs-live-launch"
        onClick={() => {
          setTarget(null);
          setOpen(true);
        }}
      >
        <span /> LIVE MARKET
      </button>
      {open && (
        <div
          className="cs-live-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <section className="cs-live-modal">
            <button className="cs-live-close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="cs-live-head">
              <span>REAL MARKET DATA</span>
              <h2>Identity-aware sold comps</h2>
              <p>
                CardSignal resolves the exact card identity before trusting a
                valuation.
              </p>
            </div>
            {target?.player && (
              <div className="cs-live-target">
                <span>APPLYING TO</span>
                <b>{target.player}</b>
                <small>{target.meta || "Saved CardSignal card"}</small>
              </div>
            )}
            <form className="cs-live-search" onSubmit={search}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Player · year · set · card # · variant · grade"
                aria-label="Exact card search"
              />
              <button disabled={loading || !query.trim()}>
                {loading ? "SEARCHING…" : "SEARCH SOLD COMPS"}
              </button>
            </form>
            {error && <div className="cs-live-error">{error}</div>}

            {data &&
              identityGroups.length > 1 &&
              !extractCardNumber(normalize(query)) && (
                <div className="cs-identity-box">
                  <div className="cs-identity-title">
                    <span>IDENTITY CHECK</span>
                    <b>Which card did you mean?</b>
                    <p>
                      These sold results appear to contain multiple cards from
                      the same player/product family.
                    </p>
                  </div>
                  <div className="cs-identity-options">
                    {identityGroups.map((group) => {
                      const groupStats = stats(group.comps);
                      return (
                        <button
                          key={group.key}
                          className={
                            selectedIdentity === group.key ? "selected" : ""
                          }
                          onClick={() => {
                            setSelectedIdentity(group.key);
                            setManual({});
                            setSaved(false);
                          }}
                        >
                          <strong>{group.label}</strong>
                          <span>
                            {group.comps.length} sold result
                            {group.comps.length === 1 ? "" : "s"}
                          </span>
                          <b>{money(groupStats.median)} median</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {data && (
              <>
                <div className="cs-live-confidence">
                  <div>
                    <span>VALUATION CONFIDENCE</span>
                    <strong
                      className={`tone-${confidence.toLowerCase().replace(" ", "-")}`}
                    >
                      {confidence}
                    </strong>
                    <small>{averageScore}% average title match</small>
                  </div>
                  <div>
                    <span>ACCEPTED</span>
                    <strong>{accepted.length}</strong>
                    <small>used in valuation</small>
                  </div>
                  <div>
                    <span>REJECTED</span>
                    <strong>{reviewed.length - accepted.length}</strong>
                    <small>excluded from stats</small>
                  </div>
                  <button disabled={!canUse} onClick={useValuation}>
                    {saved
                      ? target?.player
                        ? "VALUATION APPLIED"
                        : "VALUATION SAVED"
                      : target?.player
                        ? "APPLY TO CARD"
                        : "USE THIS VALUATION"}
                  </button>
                </div>
                <div className="cs-live-summary">
                  <div>
                    <span>FILTERED MEDIAN</span>
                    <strong>{money(valuation.median)}</strong>
                  </div>
                  <div>
                    <span>FILTERED AVERAGE</span>
                    <strong>{money(valuation.average)}</strong>
                  </div>
                  <div>
                    <span>LOW</span>
                    <strong>{money(valuation.low)}</strong>
                  </div>
                  <div>
                    <span>HIGH</span>
                    <strong>{money(valuation.high)}</strong>
                  </div>
                  <div>
                    <span>COMPS USED</span>
                    <strong>{valuation.count}</strong>
                  </div>
                </div>
                {!selectedIdentity && identityGroups.length > 1 && (
                  <div className="cs-live-warning">
                    Choose a card identity above before CardSignal calculates a
                    trusted valuation.
                  </div>
                )}
                <div className="cs-live-section">
                  <span>COMP REVIEW</span>
                  <b>{query}</b>
                </div>
                <div className="cs-live-comps">
                  {reviewed.map(({ comp, key, result, included }) => (
                    <div
                      className={`cs-live-comp ${included ? "included" : "excluded"}`}
                      key={key}
                    >
                      <button
                        className="cs-comp-toggle"
                        onClick={() => toggle(key, included)}
                      >
                        {included ? "✓" : "+"}
                      </button>
                      {comp.image ? (
                        <img src={comp.image} alt="" />
                      ) : (
                        <div className="cs-live-thumb">CS</div>
                      )}
                      <div className="cs-live-comp-copy">
                        <strong>{comp.title}</strong>
                        <span>
                          {comp.marketplace || "eBay"}
                          {comp.condition ? ` · ${comp.condition}` : ""}
                          {comp.soldDate
                            ? ` · ${comp.soldDate.slice(0, 10)}`
                            : ""}
                        </span>
                        <em className={`match-${result.label.toLowerCase()}`}>
                          {result.label} · {result.score}%
                        </em>
                        {result.reasons.length > 0 && (
                          <small>{result.reasons.join(" · ")}</small>
                        )}
                      </div>
                      <div className="cs-live-price">
                        <b>{money(comp.soldPrice)}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!data && !loading && !error && (
              <div className="cs-live-empty">
                Search for a card to pull recent sold listings.
              </div>
            )}
            <div className="cs-live-attribution">
              Sold-market data via SoldComps · CardSignal identity matcher
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .cs-live-launch {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 900;
          height: 42px;
          padding: 0 16px;
          border: 1px solid rgba(65, 241, 155, 0.42);
          border-radius: 10px;
          background: linear-gradient(
            180deg,
            rgba(33, 193, 115, 0.2),
            rgba(4, 30, 20, 0.9)
          );
          color: #bfffdc;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          cursor: pointer;
        }
        .cs-live-launch span {
          display: inline-block;
          width: 7px;
          height: 7px;
          margin-right: 8px;
          border-radius: 50%;
          background: #4ff1a0;
          box-shadow: 0 0 12px #4ff1a0;
        }
        .cs-live-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1300;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 7, 12, 0.82);
          backdrop-filter: blur(15px);
        }
        .cs-live-modal {
          position: relative;
          width: min(1080px, 96vw);
          max-height: 92vh;
          overflow: auto;
          padding: 30px;
          border: 1px solid rgba(75, 207, 255, 0.22);
          border-radius: 20px;
          background: linear-gradient(155deg, #081d2e, #04111d 62%, #061821);
          box-shadow: 0 44px 130px rgba(0, 0, 0, 0.72);
          color: #effaff;
        }
        .cs-live-close {
          position: absolute;
          right: 18px;
          top: 16px;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(102, 189, 224, 0.16);
          border-radius: 9px;
          background: #071724;
          color: #8cabbd;
          font-size: 24px;
        }
        .cs-live-head > span,
        .cs-live-section span,
        .cs-identity-title > span,
        .cs-live-target > span {
          color: #51d9ff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }
        .cs-live-head h2 {
          margin: 7px 0 5px;
          font-size: 31px;
        }
        .cs-live-head p,
        .cs-identity-title p {
          margin: 0;
          color: #7896a8;
          font-size: 11px;
        }
        .cs-live-target {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 15px;
          padding: 10px 12px;
          border: 1px solid rgba(68, 239, 157, 0.18);
          border-radius: 9px;
          background: rgba(38, 180, 112, 0.06);
        }
        .cs-live-target b {
          font-size: 11px;
        }
        .cs-live-target small {
          color: #6f8fa1;
          font-size: 9px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cs-live-search {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          margin: 18px 0 16px;
        }
        .cs-live-search input {
          height: 46px;
          border: 1px solid rgba(82, 190, 230, 0.18);
          border-radius: 10px;
          background: #06131f;
          color: #ecf9ff;
          padding: 0 14px;
        }
        .cs-live-search button,
        .cs-live-confidence button {
          border: 1px solid rgba(62, 241, 154, 0.42);
          border-radius: 10px;
          background: rgba(35, 173, 108, 0.14);
          color: #c9ffe2;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.1em;
          padding: 0 18px;
        }
        .cs-live-search button:disabled,
        .cs-live-confidence button:disabled {
          opacity: 0.35;
        }
        .cs-live-error,
        .cs-live-warning {
          padding: 12px;
          border: 1px solid rgba(255, 91, 111, 0.24);
          border-radius: 9px;
          color: #ff9daa;
          background: rgba(150, 30, 47, 0.09);
          font-size: 10px;
        }
        .cs-live-warning {
          margin-bottom: 12px;
          border-color: rgba(255, 193, 88, 0.2);
          color: #e8c27a;
          background: rgba(180, 120, 20, 0.06);
        }
        .cs-identity-box {
          margin: 14px 0 16px;
          padding: 15px;
          border: 1px solid rgba(76, 211, 255, 0.18);
          border-radius: 12px;
          background: rgba(16, 66, 91, 0.12);
        }
        .cs-identity-title b {
          display: block;
          margin: 6px 0 4px;
        }
        .cs-identity-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 12px;
        }
        .cs-identity-options button {
          padding: 12px;
          text-align: left;
          border: 1px solid rgba(83, 184, 223, 0.13);
          border-radius: 9px;
          background: #071724;
          color: #dff4fd;
        }
        .cs-identity-options button.selected {
          border-color: rgba(72, 241, 157, 0.45);
          background: rgba(38, 180, 112, 0.1);
        }
        .cs-identity-options strong,
        .cs-identity-options span,
        .cs-identity-options b {
          display: block;
        }
        .cs-identity-options strong {
          font-size: 11px;
        }
        .cs-identity-options span {
          margin: 4px 0;
          color: #6f8fa1;
          font-size: 9px;
        }
        .cs-identity-options b {
          color: #62efaa;
          font-size: 11px;
        }
        .cs-live-confidence {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.5fr;
          gap: 9px;
          margin-bottom: 10px;
        }
        .cs-live-confidence > div {
          padding: 13px;
          border: 1px solid rgba(74, 187, 229, 0.13);
          border-radius: 10px;
          background: rgba(6, 24, 38, 0.72);
        }
        .cs-live-confidence span,
        .cs-live-summary span {
          display: block;
          color: #6e8fa2;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }
        .cs-live-confidence strong,
        .cs-live-summary strong {
          display: block;
          margin-top: 6px;
          font-size: 18px;
        }
        .cs-live-confidence small {
          display: block;
          margin-top: 3px;
          color: #57788b;
          font-size: 8px;
        }
        .tone-exact,
        .tone-strong {
          color: #62efaa;
        }
        .tone-needs-identity {
          color: #f0c56d;
        }
        .tone-loose,
        .tone-no-match {
          color: #7ea5b8;
        }
        .cs-live-summary {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 9px;
          margin-bottom: 16px;
        }
        .cs-live-summary > div {
          padding: 13px;
          border: 1px solid rgba(74, 187, 229, 0.13);
          border-radius: 10px;
          background: rgba(6, 24, 38, 0.72);
        }
        .cs-live-summary > div:first-child strong {
          color: #62efaa;
        }
        .cs-live-section {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 16px 0 9px;
        }
        .cs-live-section b {
          color: #8ca8b7;
          font-size: 9px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cs-live-comps {
          display: grid;
          gap: 7px;
        }
        .cs-live-comp {
          display: grid;
          grid-template-columns: 34px 48px 1fr auto;
          align-items: center;
          gap: 11px;
          padding: 9px 11px;
          border: 1px solid rgba(78, 183, 224, 0.1);
          border-radius: 10px;
          background: rgba(7, 24, 38, 0.68);
        }
        .cs-live-comp.excluded {
          opacity: 0.48;
        }
        .cs-live-comp.included {
          border-color: rgba(63, 232, 151, 0.2);
        }
        .cs-comp-toggle {
          width: 28px;
          height: 28px;
          border: 1px solid rgba(70, 216, 255, 0.18);
          border-radius: 7px;
          background: #061522;
          color: #58dda0;
        }
        .cs-live-comp > img,
        .cs-live-thumb {
          width: 48px;
          height: 48px;
          border-radius: 7px;
          object-fit: cover;
          background: #0a2030;
        }
        .cs-live-thumb {
          display: grid;
          place-items: center;
          color: #4bcdf3;
          font-size: 9px;
        }
        .cs-live-comp-copy {
          min-width: 0;
        }
        .cs-live-comp-copy > strong {
          display: block;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cs-live-comp-copy > span {
          display: block;
          margin-top: 3px;
          color: #69899b;
          font-size: 8px;
        }
        .cs-live-comp-copy em {
          display: inline-block;
          margin-top: 5px;
          font-style: normal;
          font-size: 8px;
          font-weight: 800;
        }
        .cs-live-comp-copy small {
          margin-left: 8px;
          color: #6f8491;
          font-size: 8px;
        }
        .match-exact,
        .match-strong {
          color: #59eaa0;
        }
        .match-loose {
          color: #6fd8ff;
        }
        .match-rejected {
          color: #ff7585;
        }
        .cs-live-price b {
          color: #61efaa;
          font-size: 13px;
        }
        .cs-live-empty {
          padding: 28px;
          border: 1px dashed rgba(86, 190, 229, 0.15);
          border-radius: 11px;
          color: #69899b;
          text-align: center;
          font-size: 11px;
        }
        .cs-live-attribution {
          margin-top: 16px;
          text-align: right;
          color: #506f80;
          font-size: 8px;
        }
        @media (max-width: 760px) {
          .cs-live-modal {
            padding: 22px 14px;
          }
          .cs-live-search,
          .cs-live-confidence {
            grid-template-columns: 1fr;
          }
          .cs-live-summary {
            grid-template-columns: repeat(2, 1fr);
          }
          .cs-identity-options {
            grid-template-columns: 1fr;
          }
          .cs-live-comp {
            grid-template-columns: 30px 42px 1fr;
          }
          .cs-live-price {
            grid-column: 3;
          }
          .cs-live-comp > img,
          .cs-live-thumb {
            width: 42px;
            height: 42px;
          }
        }
      `}</style>
    </>
  );
}
