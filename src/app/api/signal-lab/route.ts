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

type ParsedQuery = {
  player: string;
  year: string;
  setName: string;
  grader: string;
  grade: string;
  cardNumber: string;
  variant: string;
};

const KNOWN_SETS = [
  "topps chrome update", "topps chrome", "bowman chrome", "bowman draft", "bowman", "topps heritage",
  "topps series 1", "topps series 2", "topps update", "panini prizm", "prizm", "select", "optic", "mosaic",
  "donruss optic", "donruss", "hoops premium stock", "hoops", "finest", "stadium club", "archives",
];

const VARIANTS = [
  "logofractor", "refractor", "x-fractor", "xfractor", "superfractor", "cosmic", "cosmic chrome", "sapphire",
  "silver", "holo", "hyper", "wave", "shimmer", "cracked ice", "ice", "scope", "mojo", "sepia", "negative",
  "pink", "purple", "blue", "green", "red", "orange", "gold", "black", "aqua", "raywave", "ray wave",
];

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
  return {
    count: prices.length,
    median: median(prices),
    average: prices.reduce((a, b) => a + b, 0) / prices.length,
    low: Math.min(...prices),
    high: Math.max(...prices),
  };
}

function normalize(v: string) {
  return v.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9#/.+-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTitle(v: string) {
  return normalize(v).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function phraseIn(text: string, phrase: string) {
  const t = ` ${normalizeTitle(text)} `;
  const p = ` ${normalizeTitle(phrase)} `;
  return t.includes(p);
}

function parseQuery(q: string): ParsedQuery {
  const n = normalize(q);
  const year = n.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? "";
  const player = year ? q.split(new RegExp(`\\b${year}\\b`))[0].trim() : q.split(/\b(?:psa|bgs|sgc|cgc)\b/i)[0].trim();
  const grader = ["psa", "bgs", "sgc", "cgc"].find((g) => new RegExp(`\\b${g}\\b`, "i").test(q)) ?? "";
  const grade = grader ? n.match(new RegExp(`\\b${grader}\\s*(10|9(?:\\.5)?|8(?:\\.5)?|7(?:\\.5)?)\\b`))?.[1] ?? "" : "";
  const cardNumber = n.match(/#\s*([a-z0-9-]+)/)?.[1] ?? n.match(/\bcard\s*#?\s*([a-z0-9-]+)/)?.[1] ?? "";
  const setName = KNOWN_SETS.find((set) => phraseIn(n, set)) ?? "";
  const variant = VARIANTS.find((v) => phraseIn(n, v)) ?? "";
  return { player, year, setName, grader, grade, cardNumber, variant };
}

function isNumberedParallel(title: string) {
  return /(?:^|\s)\/\d{2,4}\b/.test(normalize(title));
}

function queryRequestsNumbered(q: string) {
  return /(?:^|\s)\/\d{2,4}\b/.test(normalize(q));
}

function saleMatches(parsed: ParsedQuery, query: string, sale: Sale) {
  const title = normalize(sale.title);
  const playerTokens = normalize(parsed.player).split(" ").filter((t) => t.length > 1);
  if (playerTokens.length && !playerTokens.every((token) => title.includes(token))) return false;

  if (parsed.year) {
    const titleYear = title.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? "";
    if (titleYear && titleYear !== parsed.year) return false;
  }

  if (parsed.setName && !phraseIn(title, parsed.setName)) return false;

  if (parsed.grader) {
    const graderInTitle = phraseIn(title, parsed.grader);
    const graderField = normalize(sale.grader ?? "") === parsed.grader;
    if (!graderInTitle && !graderField) return false;
  }

  if (parsed.grade) {
    const titleHasGrade = new RegExp(`\\b${parsed.grader}\\s*${parsed.grade.replace(".", "\\.")}\\b`, "i").test(sale.title);
    const fieldHasGrade = normalize(sale.grade ?? "") === parsed.grade;
    if (!titleHasGrade && !fieldHasGrade) return false;
  }

  if (parsed.cardNumber) {
    const titleNumber = title.match(/#\s*([a-z0-9-]+)/)?.[1] ?? "";
    if (titleNumber && titleNumber !== parsed.cardNumber) return false;
  }

  if (!queryRequestsNumbered(query) && isNumberedParallel(title)) return false;

  if (parsed.variant) {
    if (!phraseIn(title, parsed.variant)) return false;
  } else {
    const unexpectedVariant = VARIANTS.find((variant) => phraseIn(title, variant));
    if (unexpectedVariant) return false;
  }

  if (parsed.setName === "topps chrome") {
    const excludedFamilies = ["topps chrome update", "cosmic chrome", "logofractor", "sapphire"];
    if (excludedFamilies.some((family) => phraseIn(title, family))) return false;
  }

  return true;
}

function dedupe(sales: Sale[]) {
  const seen = new Set<string>();
  return sales.filter((sale) => {
    const day = sale.date?.slice(0, 10) || "";
    const price = sale.price == null ? "" : sale.price.toFixed(2);
    const idKey = sale.id ? `${sale.source}|${sale.id}` : "";
    const titleKey = `${normalizeTitle(sale.title).slice(0, 100)}|${price}|${day}`;
    const key = idKey || titleKey;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function soldComps(query: string): Promise<{ ok: boolean; sales: Sale[]; error?: string }> {
  const key = process.env.SOLD_COMPS_API_KEY?.trim();
  if (!key) return { ok: false, sales: [], error: "Missing SOLD_COMPS_API_KEY" };
  try {
    const res = await fetch(`https://api.sold-comps.com/v1/scrape?keyword=${encodeURIComponent(query)}&count=40&exactMatch=false`, {
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
    const res = await fetch(`https://thecardapi.com/api/v1/market/sales?q=${encodeURIComponent(query)}&limit=40`, {
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
    const identities = rows.map((row) => ({
      year: String(row.year ?? ""),
      setName: String(row.set_name ?? row.setName ?? ""),
      manufacturer: String(row.manufacturer ?? ""),
      cardNumber: String(row.card_number ?? row.number ?? ""),
      playerName: String(row.player_name ?? row.name ?? ""),
      variation: String(row.parallel_variation ?? row.variation ?? ""),
      url: String(row.url ?? ""),
    }));
    const filtered = identities.filter((id) => {
      if (params.year && id.year && !String(id.year).startsWith(params.year)) return false;
      if (params.setName && id.setName && !normalize(id.setName).includes(normalize(params.setName))) return false;
      return true;
    });
    return { ok: true, identities: (filtered.length ? filtered : identities).slice(0, 12) };
  } catch (error) {
    return { ok: false, identities: [], error: error instanceof Error ? error.message : "TCDB request failed" };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ ok: false, error: "Provide q" }, { status: 400 });

  const parsed = parseQuery(q);
  const player = searchParams.get("player")?.trim() || parsed.player;
  const year = searchParams.get("year")?.trim() || parsed.year;
  const setName = searchParams.get("set")?.trim() || parsed.setName;
  const sport = searchParams.get("sport")?.trim() || "";
  if (!player) return NextResponse.json({ ok: false, error: "Could not determine player" }, { status: 400 });

  const started = Date.now();
  const [sold, card, catalog] = await Promise.all([
    soldComps(q),
    cardApi(q),
    tcdb({ player, setName, year, sport }),
  ]);

  const soldAccepted = sold.sales.filter((sale) => saleMatches(parsed, q, sale));
  const cardAccepted = card.sales.filter((sale) => saleMatches(parsed, q, sale));
  const merged = dedupe([...soldAccepted, ...cardAccepted]);

  const soldStats = stats(soldAccepted);
  const cardStats = stats(cardAccepted);
  const mergedStats = stats(merged);
  const medians = [soldStats.median, cardStats.median].filter((v): v is number => v != null && v > 0);
  const disagreementPct = medians.length === 2 ? Math.abs(medians[0] - medians[1]) / ((medians[0] + medians[1]) / 2) * 100 : null;
  const sourceAgreement = disagreementPct == null ? "Single source" : disagreementPct <= 12 ? "High" : disagreementPct <= 25 ? "Moderate" : "Low";

  return NextResponse.json({
    ok: sold.ok || card.ok || catalog.ok,
    query: q,
    parsed,
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
        soldComps: { ok: sold.ok, error: sold.error ?? null, rawCount: sold.sales.length, rejected: sold.sales.length - soldAccepted.length, ...soldStats },
        cardApi: { ok: card.ok, error: card.error ?? null, rawCount: card.sales.length, rejected: card.sales.length - cardAccepted.length, ...cardStats },
      },
      sales: merged.slice(0, 40),
    },
  });
}
