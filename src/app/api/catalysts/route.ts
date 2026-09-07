import { NextRequest, NextResponse } from "next/server";
import { fetchPlayerCatalysts } from "@/lib/news-intelligence";

export async function GET(request: NextRequest) {
  const player = (request.nextUrl.searchParams.get("player") || "").trim();
  if (!player) return NextResponse.json({ ok: false, error: "player is required" }, { status: 400 });
  try {
    const result = await fetchPlayerCatalysts(player);
    return NextResponse.json({ ok: true, player, fetchedAt: new Date().toISOString(), articles: result.articles, source: Object.keys(result.sources).join(" + ") || "No available source", sources: result.sources }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Catalyst search failed", articles: [] }, { status: 502 });
  }
}
