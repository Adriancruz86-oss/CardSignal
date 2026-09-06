import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.cardsight.ai";

type Identification = {
  name: string;
  subject: string;
  category: string;
  year: string;
  set: string;
  number: string;
  parallel: string;
  printRun: string;
  manufacturer: string;
  confidence: string;
  cardId: string;
  gradingCompany: string;
  grade: string;
  condition: string;
};

type SideEvidence = {
  detected: boolean;
  detectedCount: number;
  identification: Identification | null;
};

type CachedScan = {
  status: "completed";
  identification: Identification;
  front: SideEvidence;
  back: SideEvidence | null;
  agreement: "EXACT" | "CONSISTENT" | "CONFLICT" | "FRONT_ONLY";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

const scans = new Map<string, CachedScan>();

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

async function postBinary(url: string, key: string, file: File) {
  const bytes = await file.arrayBuffer();
  const response = await fetch(url, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": file.type || "image/jpeg" },
    body: bytes,
    cache: "no-store",
  });
  const raw = await response.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(raw); } catch {}
  return { response, raw, json };
}

function normalizeIdentification(json: Record<string, unknown>): Identification | null {
  const detections = Array.isArray(json.detections) ? json.detections as Record<string, unknown>[] : [];
  if (!detections.length) return null;
  const detection = detections[0];
  const card = obj(detection.card);
  const grading = obj(detection.grading);
  const company = obj(grading.company);
  const grade = obj(grading.grade);
  return {
    name: text(card.name),
    subject: text(card.name),
    category: text(card.segmentName ?? card.segment_name ?? card.segment),
    year: text(card.year),
    set: text(card.releaseName ?? card.release_name ?? card.setName ?? card.set_name),
    number: text(card.number),
    parallel: text(card.parallelName ?? card.parallel_name ?? card.parallel),
    printRun: text(card.printRun ?? card.print_run ?? card.serialNumber ?? card.serial_number),
    manufacturer: text(card.manufacturer),
    confidence: text(detection.confidence),
    cardId: text(card.id),
    gradingCompany: text(company.name),
    grade: text(grade.value),
    condition: text(grade.condition),
  };
}

function confidenceLevel(value: string): CachedScan["confidenceLevel"] {
  const raw = value.trim().toLowerCase();
  if (!raw) return "UNKNOWN";
  if (raw.includes("high")) return "HIGH";
  if (raw.includes("medium") || raw.includes("moderate")) return "MEDIUM";
  if (raw.includes("low")) return "LOW";
  const n = Number(raw.replace("%", ""));
  if (!Number.isFinite(n)) return "UNKNOWN";
  const pct = n <= 1 ? n * 100 : n;
  return pct >= 85 ? "HIGH" : pct >= 65 ? "MEDIUM" : "LOW";
}

function comparable(a?: string, b?: string) {
  const x = text(a).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const y = text(b).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return !x || !y || x === y;
}

function agreement(front: Identification, back: Identification | null): CachedScan["agreement"] {
  if (!back) return "FRONT_ONLY";
  if (front.cardId && back.cardId) return front.cardId === back.cardId ? "EXACT" : "CONFLICT";
  const consistent = comparable(front.subject, back.subject) && comparable(front.year, back.year) && comparable(front.set, back.set) && comparable(front.number, back.number);
  return consistent ? "CONSISTENT" : "CONFLICT";
}

async function inspectSide(key: string, file: File, allowBaseballRetry: boolean) {
  const detectionCheck = await postBinary(`${BASE}/v1/detect/card`, key, file);
  const detected = detectionCheck.response.ok && detectionCheck.json.detected === true;
  const detectedCount = Number(detectionCheck.json.count ?? 0);
  if (!detectionCheck.response.ok || !detected) return { detected, detectedCount, identification: null, raw: detectionCheck };

  let identified = await postBinary(`${BASE}/v1/identify/card`, key, file);
  let identification = identified.response.ok ? normalizeIdentification(identified.json) : null;
  let mode = "auto";
  if (!identification && allowBaseballRetry) {
    const baseball = await postBinary(`${BASE}/v1/identify/card/baseball`, key, file);
    const baseballIdentification = baseball.response.ok ? normalizeIdentification(baseball.json) : null;
    if (baseballIdentification) { identified = baseball; identification = baseballIdentification; mode = "baseball"; }
  }
  return { detected, detectedCount, identification, raw: identified, mode };
}

export async function POST(request: NextRequest) {
  const key = process.env.CARDSIGHT_API_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "Missing CARDSIGHT_API_KEY in .env.local", code: "missing_cardsight_key" }, { status: 503 });

  const incoming = await request.formData();
  const front = incoming.get("front");
  const back = incoming.get("back");
  if (!(front instanceof File)) return NextResponse.json({ ok: false, error: "Front image is required" }, { status: 400 });

  try {
    const frontResult = await inspectSide(key, front, true);
    if (!frontResult.raw.response.ok) {
      const upstreamError = frontResult.raw.json.detail ?? frontResult.raw.json.message ?? frontResult.raw.json.error ?? frontResult.raw.raw.slice(0, 250);
      return NextResponse.json({ ok: false, error: text(upstreamError) || `CardSight HTTP ${frontResult.raw.response.status}`, code: `cardsight_${frontResult.raw.response.status}` }, { status: frontResult.raw.response.status });
    }
    if (!frontResult.detected) return NextResponse.json({ ok: false, error: "CardSight did not detect a trading card in the front image. Use a straight-on photo with the full card visible and little background.", code: "no_card_detected", detectedCount: frontResult.detectedCount }, { status: 422 });
    if (!frontResult.identification) return NextResponse.json({ ok: false, error: "CardSight detected the card but could not match it to a catalog identity. Use catalog search/manual entry for this card.", code: "catalog_no_match", cardDetected: true }, { status: 422 });

    const backResult = back instanceof File ? await inspectSide(key, back, false) : null;
    const frontEvidence: SideEvidence = { detected: frontResult.detected, detectedCount: frontResult.detectedCount, identification: frontResult.identification };
    const backEvidence: SideEvidence | null = backResult ? { detected: backResult.detected, detectedCount: backResult.detectedCount, identification: backResult.identification } : null;
    const match = agreement(frontResult.identification, backResult?.identification ?? null);
    const level = confidenceLevel(frontResult.identification.confidence);
    const scanId = text(frontResult.raw.json.requestId) || `cardsight_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    scans.set(scanId, { status: "completed", identification: frontResult.identification, front: frontEvidence, back: backEvidence, agreement: match, confidenceLevel: level });

    return NextResponse.json({ ok: true, scanId, status: "completed", provider: "CardSight AI", mode: frontResult.mode || "auto", cardDetected: true, detectedCount: frontResult.detectedCount, confidence: frontResult.identification.confidence, confidenceLevel: level, backProvided: back instanceof File, backDetected: backEvidence?.detected ?? false, agreement: match });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "CardSight photo identification failed" }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing scan id" }, { status: 400 });
  const scan = scans.get(id);
  if (!scan) return NextResponse.json({ ok: false, error: "Identification result expired. Run photo identification again." }, { status: 404 });
  return NextResponse.json({ ok: true, scanId: id, status: "completed", progressPercent: 100, statusMessage: "Card identified by CardSight AI", identification: scan.identification, frontEvidence: scan.front, backEvidence: scan.back, agreement: scan.agreement, confidenceLevel: scan.confidenceLevel, provider: "CardSight AI" });
}
