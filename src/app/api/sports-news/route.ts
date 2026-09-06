import { NextResponse } from "next/server";

type RawArticle = Record<string, unknown>;
type Headline = {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  league: string;
};

const LEAGUES: Array<[string, RegExp]> = [
  [
    "NFL",
    /\b(nfl|football|super bowl|quarterback|jaguars|raiders|vikings|49ers|rams|chiefs|jets)\b/i,
  ],
  ["NBA", /\b(nba|basketball|lakers|celtics|knicks|warriors)\b/i],
  [
    "MLB",
    /\b(mlb|baseball|world series|mariners|red sox|mets|diamondbacks|cardinals|rockies|yankees|dodgers)\b/i,
  ],
  ["NHL", /\b(nhl|hockey|stanley cup|canadiens|maple leafs|oilers)\b/i],
  ["WNBA", /\bwnba\b/i],
];
const SPORTS_CONTEXT =
  /\b(nfl|nba|mlb|nhl|wnba|football|basketball|baseball|hockey|quarterback|pitcher|rookie|prospect|playoff|championship|coach|manager|roster|season|heisman|touchdown|home run|free agent|contract extension|called? up|dfa|injury|trade)\b/i;
const OFF_TOPIC =
  /\b(video game|clash of clans|gop|democrat|republican|election|transit point|wildlife|vulture conservation)\b/i;

function safeDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const compact = value.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/,
  );
  if (compact) {
    const [, y, m, d, h = "00", min = "00", s = "00"] = compact;
    const parsed = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function leagueFor(title: string) {
  return LEAGUES.find(([, pattern]) => pattern.test(title))?.[0] || "SPORTS";
}

export async function GET() {
  try {
    const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.searchParams.set(
      "query",
      '(NFL OR NBA OR MLB OR NHL OR WNBA OR "Major League Baseball" OR "National Football League") sourcelang:english',
    );
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("maxrecords", "40");
    url.searchParams.set("timespan", "24h");
    url.searchParams.set("sort", "datedesc");

    const response = await fetch(url, {
      headers: { "User-Agent": "CardSignal/0.1 sports-headlines" },
      next: { revalidate: 900 },
    });
    if (!response.ok)
      throw new Error(`News source returned ${response.status}`);
    const payload = (await response.json()) as { articles?: RawArticle[] };
    const seen = new Set<string>();
    const headlines: Headline[] = [];

    for (const article of Array.isArray(payload.articles)
      ? payload.articles
      : []) {
      const title = String(article.title || "").trim();
      const articleUrl = String(article.url || "").trim();
      const domain = String(article.domain || "News source").trim();
      if (!title || !articleUrl) continue;
      if (!SPORTS_CONTEXT.test(title) || OFF_TOPIC.test(title)) continue;
      const key = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      headlines.push({
        title,
        url: articleUrl,
        domain,
        publishedAt: safeDate(article.seendate || article.date),
        league: leagueFor(title),
      });
      if (headlines.length >= 16) break;
    }

    return NextResponse.json(
      {
        ok: true,
        source: "GDELT DOC 2.0",
        fetchedAt: new Date().toISOString(),
        headlines,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Sports headlines failed",
        headlines: [],
      },
      { status: 502 },
    );
  }
}
