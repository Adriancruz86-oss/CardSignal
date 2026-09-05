import { NextRequest, NextResponse } from "next/server";

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

type AnyRecord = Record<string, unknown>;

function normalize(v: string) {
  return v.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9#/.+-]+/g, " ").replace(/\s+/g, " ").trim();
}

function text(v: unknown) {
  return v == null ? "" : String(v).trim();
}

function obj(v: unknown): AnyRecord {
  return v && typeof v === "object" && !Array.isArray(v) ? v as AnyRecord : {};
}

function score(query: string, row: Identity) {
  const q = normalize(query);
  const hay = normalize([row.playerName, row.year, row.setName, row.cardNumber && `#${row.cardNumber}`, row.variation, row.manufacturer].filter(Boolean).join(" "));
  const tokens = q.split(" ").filter((t) => t.length > 1);
  const hits = tokens.filter((t) => hay.includes(t)).length;
  let s = hits * 10;
  if (row.playerName && q.includes(normalize(row.playerName))) s += 35;
  if (row.year && q.includes(String(row.year).slice(0, 4))) s += 18;
  if (row.setName && q.includes(normalize(row.setName))) s += 20;
  if (row.cardNumber) {
    const n = normalize(row.cardNumber).replace(/^#/, "");
    if (q.includes(`#${n}`) || new RegExp(`(^|\\s)${n}(\\s|$)`).test(q)) s += 24;
  }
  if (row.variation && q.includes(normalize(row.variation))) s += 14;
  if (row.source === "CardSight") s += 6;
  return s;
}

function identityFromCard(row: AnyRecord): Identity | null {
  const card = obj(row.card && typeof row.card === "object" ? row.card : row);
  const release = obj(card.release ?? row.release);
  const set = obj(card.set ?? row.set);
  const parallel = obj(card.parallel ?? row.parallel);
  const manufacturer = obj(card.manufacturer ?? release.manufacturer ?? row.manufacturer);
  const segment = obj(card.segment ?? release.segment ?? row.segment);

  const playerName = text(card.playerName ?? card.player_name ?? card.subject ?? card.name ?? row.playerName ?? row.player_name ?? row.name ?? row.title);
  const year = text(card.year ?? release.year ?? row.year);
  const setName = text(card.releaseName ?? card.release_name ?? release.name ?? card.setName ?? card.set_name ?? set.name ?? row.releaseName ?? row.setName ?? row.set_name);
  const cardNumber = text(card.cardNumber ?? card.card_number ?? card.number ?? row.cardNumber ?? row.card_number ?? row.number);
  const variation = text(card.parallelName ?? card.parallel_name ?? parallel.name ?? card.variation ?? row.parallelName ?? row.parallel_name ?? row.variation);
  const manufacturerName = text(card.manufacturerName ?? card.manufacturer_name ?? manufacturer.name ?? row.manufacturerName ?? row.manufacturer_name ?? row.manufacturer);
  const sport = text(card.segmentName ?? card.segment_name ?? segment.name ?? row.segmentName ?? row.segment_name ?? row.sport);
  const cardId = text(card.id ?? card.cardId ?? card.card_id ?? row.cardId ?? row.card_id ?? row.id);

  if (!playerName && !setName && !cardNumber) return null;
  return {
    playerName,
    year,
    setName,
    cardNumber,
    variation,
    manufacturer: manufacturerName,
    sport,
    cardId,
    url: cardId ? `cardsight:${cardId}` : "",
    source: "CardSight",
  };
}

function collectCardSightRows(payload: AnyRecord) {
  const candidates: AnyRecord[] = [];
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null || seen.has(value)) return;
    if (typeof value === "object") seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    const row = value as AnyRecord;
    const type = normalize(text(row.type ?? row.entityType ?? row.entity_type ?? row.resultType ?? row.result_type));
    if (type.includes("card") || row.card || row.cardNumber || row.card_number || (row.number && (row.playerName || row.player_name || row.name))) candidates.push(row);
    for (const [key, child] of Object.entries(row)) {
      if (["metadata", "pagination", "facets", "stats"].includes(key)) continue;
      visit(child, depth + 1);
    }
  };
  visit(payload);
  return candidates;
}

async function cardSightSuggestions(q: string, key: string) {
  const headers = { Accept: "application/json", "X-API-Key": key };
  const urls = [
    `https://api.cardsight.ai/v1/catalog/search?q=${encodeURIComponent(q)}&limit=25`,
    `https://api.cardsight.ai/v1/catalog/cards?q=${encodeURIComponent(q)}&limit=25`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) continue;
      const payload = await res.json() as AnyRecord;
      const rows = collectCardSightRows(payload)
        .map(identityFromCard)
        .filter((v): v is Identity => Boolean(v));
      if (rows.length) return rows;
    } catch {}
  }

  try {
    const res = await fetch(`https://api.cardsight.ai/v1/autocomplete/cards?q=${encodeURIComponent(q)}`, { headers, cache: "no-store" });
    if (res.ok) {
      const payload = await res.json() as AnyRecord;
      const raw = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      return raw.map((item) => typeof item === "string"
        ? { playerName: item, source: "CardSight" as const }
        : identityFromCard(obj(item)))
        .filter((v): v is Identity => Boolean(v));
    }
  } catch {}
  return [];
}

async function tcdbSuggestions(q: string, key: string) {
  const normalized = normalize(q);
  const year = normalized.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? "";
  const beforeYear = year ? q.split(new RegExp(`\\b${year}\\b`))[0].trim() : q;
  const playerGuess = beforeYear.split(/\s+/).slice(0, 4).join(" ").trim();
  const qs = new URLSearchParams();
  qs.set("query", playerGuess || q);
  if (year) qs.set("year", year);

  try {
    const res = await fetch(`https://api.parse.bot/scraper/123aeda8-4611-4871-a592-2109a3f6434f/search_cards?${qs.toString()}`, {
      headers: { Accept: "application/json", "X-API-Key": key },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const payload = await res.json() as AnyRecord;
    const root = obj(payload.data) && Object.keys(obj(payload.data)).length ? obj(payload.data) : payload;
    const rows = Array.isArray(root.results) ? root.results as AnyRecord[] : Array.isArray(root.cards) ? root.cards as AnyRecord[] : Array.isArray(payload.results) ? payload.results as AnyRecord[] : [];
    return rows.map((row): Identity => ({
      year: text(row.year),
      setName: text(row.set_name ?? row.setName),
      manufacturer: text(row.manufacturer),
      cardNumber: text(row.card_number ?? row.number),
      playerName: text(row.player_name ?? row.name),
      variation: text(row.parallel_variation ?? row.variation),
      sport: text(row.sport),
      url: text(row.url),
      source: "TCDB",
    })).filter((row) => !year || !row.year || String(row.year).startsWith(year));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 4) return NextResponse.json({ ok: true, query: q, suggestions: [], source: "none" });

  const cardSightKey = process.env.CARDSIGHT_API_KEY?.trim() ?? "";
  const parseKey = process.env.PARSE_API_KEY?.trim() ?? "";
  const year = normalize(q).match(/\b((?:19|20)\d{2})\b/)?.[1] ?? "";

  let rows: Identity[] = [];
  if (cardSightKey) rows = await cardSightSuggestions(q, cardSightKey);

  const cardSightRanked = rows
    .filter((row) => !year || !row.year || String(row.year).startsWith(year))
    .sort((a, b) => score(q, b) - score(q, a))
    .filter((row, index, arr) => index === arr.findIndex((x) => [x.cardId, x.playerName, x.year, x.setName, x.cardNumber, x.variation].join("|") === [row.cardId, row.playerName, row.year, row.setName, row.cardNumber, row.variation].join("|")))
    .slice(0, 12);

  if (cardSightRanked.length) {
    return NextResponse.json({ ok: true, query: q, suggestions: cardSightRanked, source: "CardSight" });
  }

  const fallback = parseKey ? await tcdbSuggestions(q, parseKey) : [];
  const ranked = fallback.sort((a, b) => score(q, b) - score(q, a)).slice(0, 10);
  return NextResponse.json({ ok: true, query: q, suggestions: ranked, source: ranked.length ? "TCDB" : "none" });
}
