import { NextRequest, NextResponse } from "next/server";

const BASE = "https://cardpricer.co/api/v1";

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`CardPricer request failed (${response.status})`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const id = searchParams.get("id")?.trim();

  try {
    if (id) {
      const safeId = encodeURIComponent(id);
      const [card, provenance, history] = await Promise.all([
        fetchJson(`${BASE}/cards/${safeId}`),
        fetchJson(`${BASE}/cards/${safeId}/provenance`).catch(() => null),
        fetchJson(`${BASE}/cards/${safeId}/history?interval=W`).catch(() => null),
      ]);

      return NextResponse.json({
        ok: true,
        source: "CardPricer",
        fetchedAt: new Date().toISOString(),
        card,
        provenance,
        history,
      });
    }

    if (!q) {
      return NextResponse.json({ ok: false, error: "Missing q or id" }, { status: 400 });
    }

    const url = `${BASE}/cards?q=${encodeURIComponent(q)}&limit=12&sort=volume`;
    const results = await fetchJson(url);

    return NextResponse.json({
      ok: true,
      source: "CardPricer",
      fetchedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Market data request failed",
      },
      { status: 502 },
    );
  }
}
