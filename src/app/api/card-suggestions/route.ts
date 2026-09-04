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
};

function normalize(v: string) {
  return v.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9#/.+-]+/g, " ").replace(/\s+/g, " ").trim();
}

function score(query: string, row: Identity) {
  const q = normalize(query);
  const hay = normalize([row.playerName, row.year, row.setName, row.cardNumber && `#${row.cardNumber}`, row.variation, row.manufacturer].filter(Boolean).join(" "));
  const tokens = q.split(" ").filter((t) => t.length > 1);
  const hits = tokens.filter((t) => hay.includes(t)).length;
  let s = hits * 10;
  if (row.playerName && q.includes(normalize(row.playerName))) s += 30;
  if (row.year && q.includes(String(row.year).slice(0, 4))) s += 12;
  if (row.setName && q.includes(normalize(row.setName))) s += 18;
  if (row.cardNumber && q.includes(`#${normalize(row.cardNumber)}`)) s += 14;
  if (row.variation && q.includes(normalize(row.variation))) s += 12;
  return s;
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 4) return NextResponse.json({ ok: true, query: q, suggestions: [] });

  const key = process.env.PARSE_API_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "PARSE_API_KEY is not set" }, { status: 503 });

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
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(text) as Record<string, unknown>; } catch {}
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${res.status}`) }, { status: 502 });
    }

    const root = (payload.data && typeof payload.data === "object") ? payload.data as Record<string, unknown> : payload;
    const rows = Array.isArray(root.results) ? root.results as Record<string, unknown>[] : Array.isArray(root.cards) ? root.cards as Record<string, unknown>[] : Array.isArray(payload.results) ? payload.results as Record<string, unknown>[] : [];

    const suggestions: Identity[] = rows.map((row) => ({
      year: String(row.year ?? ""),
      setName: String(row.set_name ?? row.setName ?? ""),
      manufacturer: String(row.manufacturer ?? ""),
      cardNumber: String(row.card_number ?? row.number ?? ""),
      playerName: String(row.player_name ?? row.name ?? ""),
      variation: String(row.parallel_variation ?? row.variation ?? ""),
      sport: String(row.sport ?? ""),
      url: String(row.url ?? ""),
    }))
      .filter((row) => !year || !row.year || String(row.year).startsWith(year))
      .sort((a, b) => score(q, b) - score(q, a))
      .slice(0, 10);

    return NextResponse.json({ ok: true, query: q, suggestions });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "TCDB suggestion lookup failed" }, { status: 502 });
  }
}
