import { NextRequest, NextResponse } from "next/server";

type EbayItem = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: Array<{ shippingCost?: { value?: string; currency?: string } }>;
  condition?: string;
  buyingOptions?: string[];
  seller?: { username?: string };
  image?: { imageUrl?: string };
};

let tokenCache: { token: string; expiresAt: number } | null = null;
const NOISE = /\b(single|card only|pick your|break|case break|box break|team break|digital|code card|empty box|wrapper|repack|mystery pack|graded|psa|bgs|sgc|cgc|slab)\b/i;
const SEALED = /\b(hobby box|jumbo hobby box|booster box|elite trainer box|\betb\b|booster bundle|blaster box|mega box|fat pack|value pack|retail pack|booster pack|wax pack|hanger box|hanger|tin)\b/i;

function num(v: unknown) {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}
function normalize(v: string) {
  return v.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function queryTokens(q: string) {
  const ignored = new Set(["sealed","new","factory","box","pack","hobby","retail","trading","cards","card"]);
  return normalize(q).split(" ").filter((t) => t.length > 2 && !ignored.has(t));
}
function looksLikeExactWax(q: string, title: string) {
  if (NOISE.test(title) || !SEALED.test(title)) return false;
  const t = normalize(title);
  const tokens = queryTokens(q);
  if (!tokens.length) return false;
  const hits = tokens.filter((token) => t.includes(token)).length;
  return hits >= Math.max(2, Math.ceil(tokens.length * 0.65));
}
async function getToken() {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("eBay Browse is not configured.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" });
  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(j.error_description ?? j.error ?? `eBay OAuth ${r.status}`));
  const token = String(j.access_token ?? "");
  if (!token) throw new Error("eBay OAuth returned no token.");
  tokenCache = { token, expiresAt: Date.now() + Number(j.expires_in ?? 7200) * 1000 };
  return token;
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ ok: false, error: "Missing product query." }, { status: 400 });
  try {
    const token = await getToken();
    const qs = new URLSearchParams({ q, limit: "100", filter: "buyingOptions:{FIXED_PRICE},conditions:{NEW}" });
    const r = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", Accept: "application/json" },
      cache: "no-store",
    });
    const body = await r.json().catch(() => ({})) as Record<string, unknown>;
    if (!r.ok) return NextResponse.json({ ok: false, error: String(body.message ?? body.errors ?? `eBay Browse ${r.status}`) }, { status: 502 });
    const rows = Array.isArray(body.itemSummaries) ? body.itemSummaries as EbayItem[] : [];
    const offers = rows
      .filter((item) => item.title && item.itemWebUrl && looksLikeExactWax(q, item.title))
      .map((item) => {
        const price = num(item.price?.value);
        const shipping = num(item.shippingOptions?.[0]?.shippingCost?.value) ?? 0;
        return {
          id: String(item.itemId ?? ""),
          title: String(item.title ?? ""),
          price,
          shipping,
          deliveredPrice: price == null ? null : Math.round((price + shipping) * 100) / 100,
          currency: String(item.price?.currency ?? "USD"),
          url: String(item.itemWebUrl ?? ""),
          seller: String(item.seller?.username ?? "eBay seller"),
          imageUrl: String(item.image?.imageUrl ?? ""),
          source: "eBay",
        };
      })
      .filter((offer) => offer.deliveredPrice != null && offer.deliveredPrice > 0)
      .sort((a, b) => Number(a.deliveredPrice) - Number(b.deliveredPrice));
    const best = offers[0] ?? null;
    return NextResponse.json({
      ok: true,
      query: q,
      checkedAt: new Date().toISOString(),
      source: "eBay Browse API",
      offerCount: offers.length,
      bestOffer: best,
      note: "Best tracked live fixed-price offer from configured buy sources; not a guarantee of the lowest price anywhere on the internet.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Best-offer lookup failed" }, { status: 503 });
  }
}
