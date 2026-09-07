import { NextRequest, NextResponse } from "next/server";

type SourceItem = {
  id: string;
  title: string;
  price: number | null;
  soldDate: string;
  marketplace: string;
  url: string;
};

type Category = "Sports" | "Pokémon";

type Identity = {
  year: string | null;
  brand: string | null;
  line: string | null;
  format: string | null;
  category: Category;
  canonicalKey: string;
  confidence: "high" | "medium" | "low";
};

const FORMAT_RULES: Array<[RegExp, string]> = [
  [/\bhobby\s+box\b/i, "Hobby Box"],
  [/\bjumbo\s+hobby\s+box\b/i, "Jumbo Hobby Box"],
  [/\bbooster\s+box\b/i, "Booster Box"],
  [/\belite\s+trainer\s+box\b|\betb\b/i, "Elite Trainer Box"],
  [/\bbooster\s+bundle\b/i, "Booster Bundle"],
  [/\bblaster\s+box\b/i, "Blaster Box"],
  [/\bmega\s+box\b/i, "Mega Box"],
  [/\bfat\s+pack\b/i, "Fat Pack"],
  [/\bhang(er|er box)\b/i, "Hanger Box"],
  [/\bcollector\s+box\b/i, "Collector Box"],
  [/\btin\b/i, "Tin"],
];

const BRAND_RULES: Array<[RegExp, string]> = [
  [/\btopps\b/i, "Topps"],
  [/\bpanini\b/i, "Panini"],
  [/\bbowman\b/i, "Bowman"],
  [/\bupper\s+deck\b/i, "Upper Deck"],
  [/\bpokemon\b|\bpokémon\b/i, "Pokémon"],
];

const NOISE = /\b(single|card only|pick your|break|case break|box break|team break|digital|code card|empty box|wrapper|repack|mystery pack)\b/i;

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function identityFromTitle(title: string, requestedCategory?: string | null): Identity | null {
  if (NOISE.test(title)) return null;
  const format = FORMAT_RULES.find(([rule]) => rule.test(title))?.[1] ?? null;
  if (!format) return null;
  const brand = BRAND_RULES.find(([rule]) => rule.test(title))?.[1] ?? null;
  const year = title.match(/\b(20\d{2}(?:-\d{2})?)\b/)?.[1] ?? null;
  const category: Category = requestedCategory === "Pokémon" || /pokemon|pokémon/i.test(title) ? "Pokémon" : "Sports";

  let line = title
    .replace(/\bnew\b|\bsealed\b|\bfactory sealed\b|\bin hand\b|\bpresale\b|\bpre[- ]?order\b/gi, " ")
    .replace(/\b(20\d{2}(?:-\d{2})?)\b/g, " ")
    .replace(new RegExp(format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();
  if (brand) line = line.replace(new RegExp(`\\b${brand.replace("é", "e")}\\b`, "i"), "").replace(/\s+/g, " ").trim();
  line = line.replace(/[|:–—-]+$/g, "").trim();
  if (line.length > 70) line = line.slice(0, 70).trim();
  const usableLine = line || brand || "Unknown product";
  const parts = [category, year ?? "year-unknown", brand ?? "brand-unknown", usableLine, format];
  const confidence: Identity["confidence"] = year && brand && line ? "high" : brand && line ? "medium" : "low";
  return { year, brand, line: usableLine, format, category, canonicalKey: parts.map(slug).join("::"), confidence };
}

async function cardApi(q: string): Promise<{ provider: string; items: SourceItem[] }> {
  const key = process.env.CARD_API_KEY?.trim();
  if (!key) throw new Error("CARD_API_KEY missing");
  const response = await fetch(`https://thecardapi.com/api/v1/market/sales?q=${encodeURIComponent(q)}&limit=50`, {
    headers: { Accept: "application/json", "x-market-api-key": key },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(text) as Record<string, unknown>; } catch {}
  if (!response.ok) throw new Error(String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${response.status}`));
  const data = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
  return {
    provider: "The Card API",
    items: data.map((item, i) => ({
      id: String(item.id ?? item.sale_id ?? i),
      title: String(item.title ?? ""),
      price: num(item.sale_price ?? item.price),
      soldDate: String(item.sale_date ?? item.ended_at ?? ""),
      marketplace: String(item.platform ?? item.marketplace ?? "market"),
      url: String(item.url ?? ""),
    })).filter((item) => item.title),
  };
}

async function soldComps(q: string): Promise<{ provider: string; items: SourceItem[] }> {
  const key = process.env.SOLD_COMPS_API_KEY?.trim();
  if (!key) throw new Error("SOLD_COMPS_API_KEY missing");
  const response = await fetch(`https://api.sold-comps.com/v1/scrape?keyword=${encodeURIComponent(q)}&count=50&exactMatch=false`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${key}`, "User-Agent": "CardSignal/0.1" },
    cache: "no-store",
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(text) as Record<string, unknown>; } catch {}
  if (!response.ok) throw new Error(String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${response.status}`));
  const data = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
  return {
    provider: "SoldComps",
    items: data.map((item, i) => ({
      id: String(item.itemId ?? i),
      title: String(item.title ?? ""),
      price: num(item.soldPrice),
      soldDate: String(item.endedAt ?? ""),
      marketplace: String(item.marketplace ?? "eBay"),
      url: String(item.url ?? ""),
    })).filter((item) => item.title),
  };
}

export async function GET(request: NextRequest) {
  const search = new URL(request.url).searchParams;
  const q = search.get("q")?.trim();
  const category = search.get("category");
  if (!q || q.length < 3) return NextResponse.json({ ok: false, error: "Enter at least 3 characters." }, { status: 400 });

  let source: { provider: string; items: SourceItem[] } | null = null;
  const errors: string[] = [];
  for (const provider of [cardApi, soldComps]) {
    try {
      source = await provider(q);
      if (source.items.length) break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "provider failed");
    }
  }
  if (!source) return NextResponse.json({ ok: false, setupRequired: true, error: errors.join(" · ") || "No sealed market provider is configured." }, { status: 503 });

  const groups = new Map<string, { identity: Identity; items: SourceItem[] }>();
  for (const item of source.items) {
    const identity = identityFromTitle(item.title, category);
    if (!identity) continue;
    const group = groups.get(identity.canonicalKey) ?? { identity, items: [] };
    group.items.push(item);
    groups.set(identity.canonicalKey, group);
  }

  const candidates = [...groups.values()].map((group) => {
    const prices = group.items.map((item) => item.price).filter((v): v is number => v !== null && v > 0);
    const newest = [...group.items].sort((a, b) => String(b.soldDate).localeCompare(String(a.soldDate)))[0];
    return {
      ...group.identity,
      evidenceCount: group.items.length,
      pricedEvidenceCount: prices.length,
      marketMedian: median(prices),
      lastSaleDate: newest?.soldDate || null,
      sampleTitle: group.items[0]?.title ?? "",
      marketplace: group.items[0]?.marketplace ?? source?.provider,
    };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount).slice(0, 20);

  return NextResponse.json({
    ok: true,
    provider: source.provider,
    fetchedAt: new Date().toISOString(),
    query: q,
    scannedListings: source.items.length,
    candidates,
    identityNote: "Marketplace titles are discovery evidence. Confirm the product identity before tracking it as an exact SKU.",
  });
}
