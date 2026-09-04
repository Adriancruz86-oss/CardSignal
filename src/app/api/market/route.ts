import { NextRequest, NextResponse } from "next/server";

const SOLD_COMPS_BASE = "https://api.sold-comps.com/v1/scrape";

type SoldComp = {
  itemId?: string;
  title?: string;
  soldPrice?: number | string;
  shippingCost?: number | string | null;
  endedAt?: string;
  condition?: string | null;
  url?: string;
  thumbnailUrl?: string | null;
  marketplace?: string;
};

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function summary(items: SoldComp[]) {
  const prices = items.map((item) => toNumber(item.soldPrice)).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!prices.length) return { count: 0, average: null, median: null, low: null, high: null };
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return {
    count: prices.length,
    average: Math.round(average * 100) / 100,
    median: Math.round(median * 100) / 100,
    low: prices[0],
    high: prices[prices.length - 1],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });
  }

  const apiKey = process.env.SOLD_COMPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: true,
        provider: "SoldComps",
        error: "Live sold comps need a free SoldComps API key. Add SOLD_COMPS_API_KEY to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const url = `${SOLD_COMPS_BASE}?keyword=${encodeURIComponent(q)}&count=40&exactMatch=true`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "CardSignal/0.1",
      },
      cache: "no-store",
    });

    const text = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const upstreamMessage = typeof payload.error === "string" ? payload.error : typeof payload.message === "string" ? payload.message : text.slice(0, 240);
      return NextResponse.json(
        {
          ok: false,
          provider: "SoldComps",
          error: upstreamMessage || `SoldComps request failed (${response.status})`,
          upstreamStatus: response.status,
        },
        { status: 502 },
      );
    }

    const items = Array.isArray(payload.items) ? payload.items as SoldComp[] : [];

    return NextResponse.json({
      ok: true,
      source: "SoldComps / eBay sold listings",
      fetchedAt: new Date().toISOString(),
      query: q,
      totalItems: typeof payload.totalItems === "number" ? payload.totalItems : items.length,
      totalResults: payload.totalResults ?? null,
      summary: summary(items),
      comps: items.map((item) => ({
        id: item.itemId ?? "",
        title: item.title ?? "Untitled sold listing",
        soldPrice: toNumber(item.soldPrice),
        shippingCost: toNumber(item.shippingCost),
        soldDate: item.endedAt ?? "",
        condition: item.condition ?? "",
        url: item.url ?? "",
        image: item.thumbnailUrl ?? "",
        marketplace: item.marketplace ?? "eBay",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "SoldComps",
        error: error instanceof Error ? error.message : "Live comps request failed",
      },
      { status: 502 },
    );
  }
}
