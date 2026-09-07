import { NextResponse } from "next/server";
import { fetchSportsHeadlines } from "@/lib/news-intelligence";

export async function GET() {
  try {
    const result = await fetchSportsHeadlines();
    return NextResponse.json({ ok: true, fetchedAt: new Date().toISOString(), headlines: result.articles.filter(article => article.impact >= 60), source: Object.keys(result.sources).join(" + ") || "No available source", sources: result.sources }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Market headline scan failed", headlines: [] }, { status: 502 });
  }
}
