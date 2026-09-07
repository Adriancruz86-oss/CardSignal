export type CatalystTone = "positive" | "negative" | "watch" | "neutral";
export type NewsArticle = {
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  category: string;
  tone: CatalystTone;
  impact: number;
  provider: string;
};

const NEGATIVE = [
  "injury",
  "injured",
  "surgery",
  "out for",
  "ruled out",
  "disabled list",
  "suspension",
  "suspended",
  "arrest",
  "waived",
  "released",
  "demoted",
  "optioned",
];
const POSITIVE = [
  "promoted",
  "call-up",
  "called up",
  "recalled",
  "activated",
  "returns",
  "returning",
  "record",
  "award",
  "mvp",
  "rookie of the",
  "all-star",
  "extension",
  "contract",
  "named starter",
  "playoff",
  "championship",
  "career high",
  "breakout",
];
const WATCH = [
  "trade",
  "traded",
  "rumor",
  "rumour",
  "deadline",
  "free agent",
  "free agency",
  "prospect",
  "debut",
  "rotation",
  "lineup",
];

export function classifyHeadline(title: string) {
  const text = ` ${title.toLowerCase()} `;
  const negative = NEGATIVE.find((word) => text.includes(word));
  const positive = POSITIVE.find((word) => text.includes(word));
  const watch = WATCH.find((word) => text.includes(word));
  if (negative)
    return {
      category: /injur|surgery|out for|ruled out|disabled/.test(negative)
        ? "INJURY / AVAILABILITY"
        : "NEGATIVE EVENT",
      tone: "negative" as CatalystTone,
      impact: 90,
    };
  if (positive)
    return {
      category: /promot|call|recalled/.test(positive)
        ? "CALL-UP / ROLE"
        : "POSITIVE CATALYST",
      tone: "positive" as CatalystTone,
      impact: 80,
    };
  if (watch)
    return {
      category: /trade|rum/.test(watch) ? "TRADE WATCH" : "ROLE / MARKET WATCH",
      tone: "watch" as CatalystTone,
      impact: 65,
    };
  return {
    category: "PLAYER NEWS",
    tone: "neutral" as CatalystTone,
    impact: 35,
  };
}

function safeDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const compact = value.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/,
  );
  if (compact) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] =
      compact;
    const parsed = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
    );
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function xmlValue(block: string, tag: string) {
  return decodeXml(
    block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
    )?.[1] || "",
  );
}

function domainFor(url: string, fallback = "News source") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

function parseRss(xml: string, provider: string): NewsArticle[] {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || [])
    .map((item) => {
      const title = xmlValue(item, "title");
      const url = xmlValue(item, "link");
      const publishedAt = safeDate(
        xmlValue(item, "pubDate") || xmlValue(item, "dc:date"),
      );
      const source = xmlValue(item, "source");
      const classification = classifyHeadline(title);
      return {
        title,
        url,
        publishedAt,
        domain: source || domainFor(url),
        provider,
        ...classification,
      };
    })
    .filter((article) => article.title && article.url);
}

async function googleNews(query: string, timespan = "7d") {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:${timespan}`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  const response = await fetch(url, {
    headers: { "User-Agent": "CardSignal/0.1 news-monitor" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Google News returned ${response.status}`);
  return parseRss(await response.text(), "Google News RSS");
}

async function espnNews() {
  const response = await fetch("https://www.espn.com/espn/rss/news", {
    headers: { "User-Agent": "CardSignal/0.1 news-monitor" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
  return parseRss(await response.text(), "ESPN RSS");
}

async function gdelt(query: string, timespan = "7d") {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "30");
  url.searchParams.set("timespan", timespan);
  url.searchParams.set("sort", "datedesc");
  const response = await fetch(url, {
    headers: { "User-Agent": "CardSignal/0.1 news-monitor" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`GDELT returned ${response.status}`);
  const payload = (await response.json()) as {
    articles?: Array<Record<string, unknown>>;
  };
  return (payload.articles || [])
    .map((row) => {
      const title = String(row.title || "").trim();
      const articleUrl = String(row.url || "").trim();
      return {
        title,
        url: articleUrl,
        domain: String(row.domain || domainFor(articleUrl)),
        publishedAt: safeDate(row.seendate || row.date),
        provider: "GDELT DOC 2.0",
        ...classifyHeadline(title),
      };
    })
    .filter((article) => article.title && article.url);
}

function normalizedTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function playerMatches(title: string, player: string) {
  const titleWords = new Set(normalizedTitle(title).split(" "));
  const playerWords = normalizedTitle(player)
    .split(" ")
    .filter((word) => word.length > 1);
  return (
    playerWords.length > 0 && playerWords.every((word) => titleWords.has(word))
  );
}

function merge(
  results: PromiseSettledResult<NewsArticle[]>[],
  player?: string,
  limit = 20,
) {
  const seen = new Set<string>();
  const articles: NewsArticle[] = [];
  const sources: Record<
    string,
    { ok: boolean; count: number; error?: string }
  > = {};
  for (const result of results) {
    if (result.status === "rejected") continue;
    for (const article of result.value) {
      const source = article.provider;
      if (!sources[source]) sources[source] = { ok: true, count: 0 };
      if (player && !playerMatches(article.title, player)) continue;
      const key = normalizedTitle(article.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sources[source].count++;
      articles.push(article);
    }
  }
  articles.sort(
    (a, b) =>
      b.impact - a.impact ||
      Date.parse(b.publishedAt || "1970-01-01") -
        Date.parse(a.publishedAt || "1970-01-01"),
  );
  const diversified = player
    ? articles.filter((article, index, rows) => {
        const key = `${article.domain.toLowerCase()}|${article.category}`;
        return (
          rows.findIndex(
            (row) => `${row.domain.toLowerCase()}|${row.category}` === key,
          ) === index
        );
      })
    : articles;
  return { articles: diversified.slice(0, limit), sources };
}

export async function fetchPlayerCatalysts(player: string) {
  const clean = player.replace(/["<>]/g, "").trim();
  const catalystTerms =
    "(injury OR injured OR trade OR traded OR promoted OR recalled OR activated OR suspension OR contract OR record OR award OR playoff OR debut OR lineup)";
  const results = await Promise.allSettled([
    googleNews(`"${clean}" sports`, "7d"),
    gdelt(`"${clean}" ${catalystTerms}`, "7d"),
  ]);
  return merge(results, clean, 16);
}

export async function fetchSportsHeadlines() {
  const query =
    "(NFL OR NBA OR MLB OR NHL OR WNBA) (injury OR trade OR debut OR record OR award OR playoff OR breakout)";
  const results = await Promise.allSettled([
    googleNews(query, "1d"),
    espnNews(),
    gdelt(query, "24h"),
  ]);
  return merge(results, undefined, 30);
}

export function stableEventKey(
  player: string,
  article: Pick<NewsArticle, "title" | "url">,
) {
  const input = `${player.toLowerCase()}|${article.url || normalizedTitle(article.title)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `news_${(hash >>> 0).toString(16)}`;
}
