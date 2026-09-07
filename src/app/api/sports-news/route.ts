import { NextResponse } from "next/server";
import { fetchSportsHeadlines } from "@/lib/news-intelligence";

export async function GET() {
  try {
    const result = await fetchSportsHeadlines();
    return NextResponse.json({ ok: true, source: Object.keys(result.sources).join(" + ") || "No available source", sources: result.sources, fetchedAt: new Date().toISOString(), headlines: result.articles }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Sports headlines failed", headlines: [] }, { status: 502 });
  }
}
