import { NextRequest, NextResponse } from "next/server";

type Sale = {
  source: "SoldComps" | "The Card API";
  id: string;
  title: string;
  price: number | null;
  date: string;
  marketplace: string;
  grader?: string;
  grade?: string;
  url?: string;
  image?: string;
};

type Identity = {
  year?: string;
  setName?: string;
  manufacturer?: string;
  cardNumber?: string;
  playerName?: string;
  variation?: string;
  url?: string;
};

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(sales: Sale[]) {
  const prices = sales.map((s) => s.price).filter((v): v is number => v != null);
  if (!prices.length) return { count: 0, median: null, average: null, low: null, high: null };
  const average = prices.reduce((a, b) => a + b, 0) / prices.length;
  return { count: prices.length, median: median(prices), average, low: Math.min(...prices), high: Math.max(...prices) };
}

function normalizeTitle(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function dedupe(sales: Sale[]) {
  const seen = new Set<string>();
  return sales.filter((sale) => {
    const day = sale.date?.slice(0, 10) || "";
    const price = sale.price == null ? "" : sale.price.toFixed(2);
    const key = `${normalizeTitle(sale.title).slice(0, 90)}|${price}|${day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function soldComps(query: string): Promise<{ ok: boolean; sales: Sale[]; error?: string }> {
  const key = process.env.SOLD_COMPS_API_KEY?.trim();
  if (!key) return { ok: false, sales: [], error: "Missing SOLD_COMPS_API_KEY" };
  try {
    const res = await fetch(`https://api.sold-comps.com/v1/scrape?keyword=${encodeURIComponent(query)}&count=30&exactMatch=false`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}`, "User-Agent": "CardSignal/0.1" },
      cache: "no-store",
    });
    const text = await res.text();
    const payload = (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } })();
    if (!res.ok) return { ok: false, sales: [], error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${res.status}`) };
    const items = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
    return {
      ok: true,
      sales: items.map((item) => ({
        source: "SoldComps" as const,
        id: String(item.itemId ?? ""),
        title: String(item.title ?? "Untitled sale"),
        price: num(item.soldPrice),
        date: String(item.endedAt ?? ""),
        marketplace: String(item.marketplace ?? "eBay"),
        url: String(item.url ?? ""),
        image: String(item.thumbnailUrl ?? ""),
      })),
    };
  } catch (error) {
    return { ok: false, sales: [], error: error instanceof Error ? error.message : "SoldComps request failed" };
  }
}

async function cardApi(query: string): Promise<{ ok: boolean; sales: Sale[]; error?: string }> {
  const key = process.env.CARD_API_KEY?.trim();
  if (!key) return { ok: false, sales: [], error: "Missing CARD_API_KEY" };
  try {
    const res = await fetch(`https://thecardapi.com/api/v1/market/sales?q=${encodeURIComponent(query)}&limit=30`, {
      headers: { Accept: "application/json", "x-market-api-key": key },
      cache: "no-store",
    });
    const text = await res.text();
    const payload = (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } })();
    if (!res.ok) return { ok: false, sales: [], error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${res.status}`) };
    const data = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
    return {
      ok: true,
      sales: data.map((item) => ({
        source: "The Card API" as const,
        id: String(item.id ?? ""),
        title: String(item.title ?? "Untitled sale"),
        price: num(item.price ?? item.sale_price),
        date: String(item.sale_date ?? item.sold_at ?? ""),
        marketplace: String(item.platform ?? "eBay"),
        grader: String(item.grader ?? item.grading_company ?? ""),
        grade: String(item.grade ?? ""),
        url: String(item.listing_url ?? ""),
        image: String(item.thumbnail_url ?? item.image_url ?? ""),
      })),
    };
  } catch (error) {
    return { ok: false, sales: [], error: error instanceof Error ? error.message : "The Card API request failed" };
  }
}

async function tcdb(params: { player: string; setName?: string; year?: string; sport?: string }): Promise<{ ok: boolean; identities: Identity[]; error?: string }> {
  const key = process.env.PARSE_API_KEY?.trim();
  if (!key) return { ok: false, identities: [], error: "Missing PARSE_API_KEY" };
  const qs = new URLSearchParams();
  if (params.player) qs.set("query", params.player);
  if (params.setName) qs.set("set_name", params.setName);
  if (params.year) qs.set("year", params.year);
  if (params.sport) qs.set("sport", params.sport);
  try {
    const res = await fetch(`https://api.parse.bot/scraper/123aeda8-4611-4871-a592-2109a3f6434f/search_cards?${qs.toString()}`, {
      headers: { Accept: "application/json", "X-API-Key": key },
      cache: "no-store",
    });
    const text = await res.text();
    const payload = (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } })();
    if (!res.ok) return { ok: false, identities: [], error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${res.status}`) };
    const root = (payload.data && typeof payload.data === "object") ? payload.data as Record<string, unknown> : payload;
    const rows = Array.isArray(root.results) ? root.results as Record<string, unknown>[] : Array.isArray(root.cards) ? root.cards as Record<string, unknown>[] : Array.isArray(payload.results) ? payload.results as Record<string, unknown>[] : [];
    return {
      ok: true,
      identities: rows.slice(0, 12).map((row) => ({
        year: String(row.year ?? ""),
        setName: String(row.set_name ?? row.setName ?? ""),
        manufacturer: String(row.manufacturer ?? ""),
        cardNumber: String(row.card_number ?? row.number ?? ""),
        playerName: String(row.player_name ?? row.name ?? ""),
        variation: String(row.parallel_variation ?? row.variation ?? ""),
        url: String(row.url ?? ""),
      })),
    };
  } catch (error) {
    return { ok: false, identities: [], error: error instanceof Error ? error.message : "TCDB request failed" };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const player = searchParams.get("player")?.trim() || q.split(/\b(?:19|20)\d{2}\b/)[0].trim();
  const year = searchParams.get("year")?.trim() || q.match(/\b((?:19|20)\d{2})\b/)?.[1] || "";
  const setName = searchParams.get("set")?.trim() || "";
  const sport = searchParams.get("sport")?.trim() || "";
  if (!q || !player) return NextResponse.json({ ok: false, error: "Provide q or player" }, { status: 400 });

  const started = Date.now();
  const [sold, card, catalog] = await Promise.all([
    soldComps(q),
    cardApi(q),
    tcdb({ player, setName, year, sport }),
  ]);

  const merged = dedupe([...sold.sales, ...card.sales]);
  const soldStats = stats(sold.sales);
  const cardStats = stats(card.sales);
  const mergedStats = stats(merged);
  const medians = [soldStats.median, cardStats.median].filter((v): v is number => v != null && v > 0);
  const disagreementPct = medians.length === 2 ? Math.abs(medians[0] - medians[1]) / ((medians[0] + medians[1]) / 2) * 100 : null;
  const sourceAgreement = disagreementPct == null ? "Single source" : disagreementPct <= 12 ? "High" : disagreementPct <= 25 ? "Moderate" : "Low";

  return NextResponse.json({
    ok: sold.ok || card.ok || catalog.ok,
    query: q,
    elapsedMs: Date.now() - started,
    identity: {
      provider: "TCDB / Parse",
      ok: catalog.ok,
      error: catalog.error ?? null,
      candidates: catalog.identities,
    },
    market: {
      merged: mergedStats,
      sourceAgreement,
      disagreementPct: disagreementPct == null ? null : Math.round(disagreementPct * 10) / 10,
      sources: {
        soldComps: { ok: sold.ok, error: sold.error ?? null, ...soldStats },
        cardApi: { ok: card.ok, error: card.error ?? null, ...cardStats },
      },
      sales: merged.slice(0, 40),
    },
  });
}
