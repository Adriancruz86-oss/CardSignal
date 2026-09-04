import { NextRequest, NextResponse } from "next/server";

const BASE = "https://cardpricer.co/api/v1";

type UpstreamError = Error & { status?: number; body?: string };

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CardSignal/0.1 (local prototype)",
    },
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(`CardPricer request failed (${response.status})`) as UpstreamError;
    error.status = response.status;
    error.body = text.slice(0, 500);
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("CardPricer returned a non-JSON response");
  }
}

function playerOnlyQuery(q: string) {
  const beforeYear = q.split(/\b(?:19|20)\d{2}\b/)[0]?.trim();
  if (beforeYear && beforeYear.length >= 3) return beforeYear;
  return q.split(/\s+/).slice(0, 3).join(" ");
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

    // Keep the public search request deliberately minimal. Some upstream deployments
    // have rejected optional sorting/filter combinations even though the directory
    // endpoint itself is available anonymously.
    try {
      const url = `${BASE}/cards?q=${encodeURIComponent(q)}&limit=12`;
      const results = await fetchJson(url);

      return NextResponse.json({
        ok: true,
        source: "CardPricer",
        fetchedAt: new Date().toISOString(),
        results,
      });
    } catch (firstError) {
      // Fallback: verify that the anonymous API is reachable and return matching
      // players. The UI can still show useful live catalog data while we diagnose
      // a card-search-specific upstream restriction.
      const fallbackQ = playerOnlyQuery(q);
      try {
        const players = await fetchJson(`${BASE}/players?q=${encodeURIComponent(fallbackQ)}&limit=10`);
        return NextResponse.json({
          ok: true,
          source: "CardPricer",
          fetchedAt: new Date().toISOString(),
          fallback: "players",
          query: fallbackQ,
          results: players,
          warning: firstError instanceof Error ? firstError.message : "Card search failed; showing player matches instead.",
        });
      } catch (fallbackError) {
        const upstream = fallbackError as UpstreamError;
        return NextResponse.json(
          {
            ok: false,
            error: upstream.message || "Market data request failed",
            upstreamStatus: upstream.status ?? null,
            upstreamBody: upstream.body ?? null,
          },
          { status: 502 },
        );
      }
    }
  } catch (error) {
    const upstream = error as UpstreamError;
    return NextResponse.json(
      {
        ok: false,
        error: upstream.message || "Market data request failed",
        upstreamStatus: upstream.status ?? null,
        upstreamBody: upstream.body ?? null,
      },
      { status: 502 },
    );
  }
}
