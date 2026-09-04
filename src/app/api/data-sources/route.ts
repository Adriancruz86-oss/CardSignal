import { NextRequest, NextResponse } from "next/server";

type TestResult = {
  ok: boolean;
  provider: string;
  status: "connected" | "error" | "missing-key" | "configured";
  ms: number;
  sample?: Record<string, unknown>;
  error?: string;
  upstreamStatus?: number;
};

async function readJson(response: Response) {
  const text = await response.text();
  try { return { payload: JSON.parse(text) as Record<string, unknown>, text }; }
  catch { return { payload: {} as Record<string, unknown>, text }; }
}

function missing(provider: string, envName: string, started: number): TestResult {
  return { ok: false, provider, status: "missing-key", ms: Date.now() - started, error: `${envName} is not set in .env.local` };
}

async function testSoldComps(): Promise<TestResult> {
  const started = Date.now();
  const key = process.env.SOLD_COMPS_API_KEY?.trim();
  if (!key) return missing("SoldComps", "SOLD_COMPS_API_KEY", started);
  try {
    const url = "https://api.sold-comps.com/v1/scrape?keyword=Shohei%20Ohtani&count=1&exactMatch=false";
    const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${key}`, "User-Agent": "CardSignal/0.1" }, cache: "no-store" });
    const { payload, text } = await readJson(response);
    if (!response.ok) return { ok: false, provider: "SoldComps", status: "error", ms: Date.now() - started, upstreamStatus: response.status, error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${response.status}`) };
    const items = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
    const first = items[0] ?? {};
    return { ok: true, provider: "SoldComps", status: "connected", ms: Date.now() - started, sample: { results: typeof payload.totalItems === "number" ? payload.totalItems : items.length, title: first.title ?? "Sale search responded", soldPrice: first.soldPrice ?? null, marketplace: first.marketplace ?? "eBay" } };
  } catch (error) {
    return { ok: false, provider: "SoldComps", status: "error", ms: Date.now() - started, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function testParse(): Promise<TestResult> {
  const started = Date.now();
  const key = process.env.PARSE_API_KEY?.trim();
  if (!key) return missing("TCDB / Parse", "PARSE_API_KEY", started);
  try {
    const url = "https://api.parse.bot/scraper/123aeda8-4611-4871-a592-2109a3f6434f/list_sets?year=2025&query=Donruss&sport=Football";
    const response = await fetch(url, { headers: { Accept: "application/json", "X-API-Key": key }, cache: "no-store" });
    const { payload, text } = await readJson(response);
    if (!response.ok) return { ok: false, provider: "TCDB / Parse", status: "error", ms: Date.now() - started, upstreamStatus: response.status, error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${response.status}`) };
    const data = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : Array.isArray(payload.results) ? payload.results as Record<string, unknown>[] : [];
    const first = (data[0] ?? {}) as Record<string, unknown>;
    return { ok: true, provider: "TCDB / Parse", status: "connected", ms: Date.now() - started, sample: { query: "2025 Donruss Football", matches: data.length, firstSet: first.name ?? first.set_name ?? first.title ?? "TCDB responded successfully", setId: first.id ?? first.set_id ?? null } };
  } catch (error) {
    return { ok: false, provider: "TCDB / Parse", status: "error", ms: Date.now() - started, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function testPSA(): Promise<TestResult> {
  const started = Date.now();
  const token = process.env.PSA_API_TOKEN?.trim();
  if (!token) return missing("PSA", "PSA_API_TOKEN", started);
  try {
    const cert = "20260197";
    const response = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${cert}`, { headers: { Accept: "application/json", Authorization: `bearer ${token}` }, cache: "no-store" });
    const { payload, text } = await readJson(response);
    if (!response.ok) return { ok: false, provider: "PSA", status: "error", ms: Date.now() - started, upstreamStatus: response.status, error: String(payload.ServerMessage ?? payload.error ?? text.slice(0, 180) ?? `HTTP ${response.status}`) };
    const certData = (payload.PSACert ?? payload.Cert ?? payload) as Record<string, unknown>;
    return { ok: true, provider: "PSA", status: "connected", ms: Date.now() - started, sample: { cert, message: payload.ServerMessage ?? "Cert lookup responded", subject: certData.Subject ?? certData.subject ?? null, year: certData.Year ?? certData.year ?? null, brand: certData.Brand ?? certData.BrandTitle ?? certData.brand ?? null, cardNumber: certData.CardNumber ?? certData.cardNumber ?? null, grade: certData.CardGrade ?? certData.GradeDescription ?? certData.grade ?? null } };
  } catch (error) {
    return { ok: false, provider: "PSA", status: "error", ms: Date.now() - started, error: error instanceof Error ? error.message : "Request failed" };
  }
}

async function testCardApi(): Promise<TestResult> {
  const started = Date.now();
  const key = process.env.CARD_API_KEY?.trim();
  if (!key) return missing("The Card API", "CARD_API_KEY", started);
  try {
    const response = await fetch("https://thecardapi.com/api/v1/market/sales?q=Shohei%20Ohtani&limit=1", { headers: { Accept: "application/json", "x-market-api-key": key }, cache: "no-store" });
    const { payload, text } = await readJson(response);
    if (!response.ok) return { ok: false, provider: "The Card API", status: "error", ms: Date.now() - started, upstreamStatus: response.status, error: String(payload.error ?? payload.message ?? text.slice(0, 180) ?? `HTTP ${response.status}`) };
    const data = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [];
    const first = data[0] ?? {};
    const pagination = (payload.pagination ?? {}) as Record<string, unknown>;
    return { ok: true, provider: "The Card API", status: "connected", ms: Date.now() - started, sample: { results: pagination.total ?? data.length, title: first.title ?? "Sales search responded", salePrice: first.sale_price ?? first.price ?? null, saleDate: first.sale_date ?? null, platform: first.platform ?? null } };
  } catch (error) {
    return { ok: false, provider: "The Card API", status: "error", ms: Date.now() - started, error: error instanceof Error ? error.message : "Request failed" };
  }
}

export async function GET(request: NextRequest) {
  const provider = new URL(request.url).searchParams.get("provider") ?? "all";
  const tests: Record<string, () => Promise<TestResult>> = { soldcomps: testSoldComps, parse: testParse, psa: testPSA, cardapi: testCardApi };
  if (provider !== "all") {
    const test = tests[provider];
    if (!test) return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 400 });
    return NextResponse.json(await test());
  }
  const results = await Promise.all(Object.values(tests).map((test) => test()));
  return NextResponse.json({ ok: results.every((result) => result.ok), testedAt: new Date().toISOString(), results });
}
