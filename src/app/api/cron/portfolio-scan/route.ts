import { NextRequest, NextResponse } from "next/server";
import { fetchPlayerCatalysts, stableEventKey, type NewsArticle } from "@/lib/news-intelligence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Json = Record<string, unknown>;
type SavedCard = {
  id?: number;
  player?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  variant?: string;
  grader?: string;
  grade?: string;
  mode?: string;
  benchmark?: boolean;
  marketScan?: { scannedAt?: string };
  canonicalIdentity?: { playerName?: string; year?: string; setName?: string; cardNumber?: string; variation?: string };
};

const USER_LIMIT = 10;
const CARD_LIMIT = 40;

function configured() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || "";
  return { url, key };
}
function adminHeaders(key: string, prefer?: string) {
  return { apikey: key, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
}
async function admin(url: string, key: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...adminHeaders(key), ...(init.headers || {}) }, cache: "no-store" });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(String(body?.message || body?.hint || `Supabase ${response.status}`));
  return body;
}
function cardsFromPayload(payload: Json): SavedCard[] {
  const values = payload?.values && typeof payload.values === "object" ? payload.values as Json : {};
  const raw = values["cardsignal-added-cards"];
  try { const parsed = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function identity(card: SavedCard) {
  const c = card.canonicalIdentity || {};
  return { player: c.playerName || card.player || "", year: c.year || card.year || "", set: c.setName || card.setName || "", cardNumber: c.cardNumber || card.cardNumber || "", variant: c.variation || card.variant || "", grader: card.grader || "", grade: card.grade || "" };
}
function scanEligible(card: SavedCard) {
  const c = identity(card);
  return Number.isFinite(Number(card.id)) && Boolean(c.player && c.year && c.set && c.cardNumber && (c.grader === "raw" || (c.grader && c.grade)));
}
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { url, key } = configured();
  if (!url || !key) return NextResponse.json({ ok: false, error: "Scheduled scans require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY" }, { status: 503 });
  const startedAt = new Date().toISOString();
  let runId = "";
  try {
    const run = await admin(url, key, "market_scan_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ started_at: startedAt }) });
    runId = String(run?.[0]?.id || "");
    const states = await admin(url, key, `user_state?select=user_id,payload&order=updated_at.desc&limit=${USER_LIMIT}`) as Array<{ user_id: string; payload: Json }>;
    const queue = states.flatMap(state => cardsFromPayload(state.payload).filter(scanEligible).map(card => ({ userId: state.user_id, card }))).sort((a, b) => Date.parse(a.card.marketScan?.scannedAt || "1970-01-01") - Date.parse(b.card.marketScan?.scannedAt || "1970-01-01")).slice(0, CARD_LIMIT);
    const catalystCache = new Map<string, { articles: NewsArticle[]; sources: Record<string, { ok: boolean; count: number; error?: string }> }>();
    let scanned = 0, failed = 0;
    const errors: Array<{ cardId: number; error: string }> = [];
    for (const item of queue) {
      const c = identity(item.card), params = new URLSearchParams({ ...c, provider: "cardapi" });
      try {
        const playerKey = c.player.toLowerCase();
        let catalysts = catalystCache.get(playerKey);
        if (!catalysts) {
          try { catalysts = await fetchPlayerCatalysts(c.player); } catch { catalysts = { articles: [], sources: {} }; }
          catalystCache.set(playerKey, catalysts);
        }
        if (catalysts.articles.length) {
          await admin(url, key, "news_events?on_conflict=user_id,client_card_id,event_key", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(catalysts.articles.map(article => ({
              event_key: stableEventKey(c.player, article), user_id: item.userId, client_card_id: Number(item.card.id), player: c.player,
              title: article.title, url: article.url, domain: article.domain || null, published_at: article.publishedAt || null,
              last_seen_at: new Date().toISOString(), category: article.category, tone: article.tone, impact: article.impact,
              provider: article.provider, raw: article,
            }))),
          });
        }
        const response = await fetch(`${request.nextUrl.origin}/api/portfolio-scan?${params}`, { cache: "no-store" });
        const result = await response.json() as Json;
        if (!response.ok || !result.ok) throw new Error(String(result.error || `Scan ${response.status}`));
        const snapshotRows = await admin(url, key, "market_snapshots", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ run_id: runId || null, user_id: item.userId, client_card_id: Number(item.card.id), player: c.player, year: c.year || null, set_name: c.set || null, card_number: c.cardNumber || null, variant: c.variant || null, grader: c.grader || null, grade: c.grade || null, accepted_count: Number(result.acceptedCount || 0), rejected_count: Number(result.rejectedCount || 0), current_median: result.currentMedian ?? null, recent_median: result.recentMedian ?? null, prior_median: result.priorMedian ?? null, change_7d: result.change7d ?? null, recent_sales: Number(result.recentSales || 0), velocity: result.velocity ?? null, pulse: String(result.pulse || "NOT ENOUGH DATA"), confidence: String(result.confidence || "LOW"), source_status: { ...(result.sources as Json || {}), news: { count: catalysts.articles.length, providers: Object.keys(catalysts.sources) } } }) });
        const snapshotId = String(snapshotRows?.[0]?.id || "");
        const sales = Array.isArray(result.acceptedSales) ? result.acceptedSales as Json[] : [];
        if (snapshotId && sales.length) await admin(url, key, "market_sales", { method: "POST", body: JSON.stringify(sales.map(s => ({ snapshot_id: snapshotId, user_id: item.userId, client_card_id: Number(item.card.id), provider: String(s.source || "unknown"), provider_sale_id: String(s.id || "") || null, title: String(s.title || "Untitled sale"), sale_price: s.price ?? null, sale_date: s.date || null, marketplace: String(s.marketplace || "") || null, raw: s }))) });
        const pulse = String(result.pulse || "NOT ENOUGH DATA");
        if (snapshotId && ["BUY MORE", "SELL RISK", "WATCH CLOSELY"].includes(pulse)) await admin(url, key, "signal_events", { method: "POST", body: JSON.stringify({ snapshot_id: snapshotId, user_id: item.userId, client_card_id: Number(item.card.id), signal_type: pulse, confidence: String(result.confidence || "LOW"), score: result.velocity ?? null, explanation: `${pulse}: ${result.acceptedCount || 0} accepted matches${result.change7d == null ? "" : `, ${result.change7d}% 7D change`}.`, evidence: { acceptedCount: result.acceptedCount, rejectedCount: result.rejectedCount, currentMedian: result.currentMedian, change7d: result.change7d, velocity: result.velocity, sources: result.sources } }) });
        scanned++;
      } catch (error) { failed++; errors.push({ cardId: Number(item.card.id), error: error instanceof Error ? error.message : "Unknown scan failure" }); }
    }
    const status = failed ? (scanned ? "partial" : "failed") : "completed";
    if (runId) await admin(url, key, `market_scan_runs?id=eq.${runId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ finished_at: new Date().toISOString(), status, users_seen: states.length, cards_seen: queue.length, cards_scanned: scanned, cards_failed: failed, details: { errors: errors.slice(0, 20) } }) });
    return NextResponse.json({ ok: status !== "failed", runId, status, usersSeen: states.length, cardsSeen: queue.length, cardsScanned: scanned, cardsFailed: failed, errors: errors.slice(0, 10) });
  } catch (error) {
    return NextResponse.json({ ok: false, runId, error: error instanceof Error ? error.message : "Scheduled scan failed" }, { status: 500 });
  }
}
