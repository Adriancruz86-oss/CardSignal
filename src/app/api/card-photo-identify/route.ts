import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.cardsight.ai";

type CachedScan = {
  status: "completed";
  identification: {
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
};

const scans = new Map<string, CachedScan>();

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

async function postBinary(url: string, key: string, front: File) {
  const bytes = await front.arrayBuffer();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": key,
      "Content-Type": front.type || "image/jpeg",
    },
    body: bytes,
    cache: "no-store",
  });
  const raw = await response.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(raw); } catch {}
  return { response, raw, json };
}

function normalizeIdentification(json: Record<string, unknown>) {
  const detections = Array.isArray(json.detections) ? json.detections as Record<string, unknown>[] : [];
  if (!detections.length) return null;

  const detection = detections[0];
  const card = obj(detection.card);
  const grading = obj(detection.grading);
  const company = obj(grading.company);
  const grade = obj(grading.grade);
  const printRun = text(card.printRun ?? card.print_run ?? card.serialNumber ?? card.serial_number);

  return {
    name: text(card.name),
    subject: text(card.name),
    category: text(card.segmentName ?? card.segment_name ?? card.segment),
    year: text(card.year),
    set: text(card.releaseName ?? card.release_name ?? card.setName ?? card.set_name),
    number: text(card.number),
    parallel: text(card.parallelName ?? card.parallel_name ?? card.parallel),
    printRun,
    manufacturer: text(card.manufacturer),
    confidence: text(detection.confidence),
    cardId: text(card.id),
    gradingCompany: text(company.name),
    grade: text(grade.value),
    condition: text(grade.condition),
  };
}

export async function POST(request: NextRequest) {
  const key = process.env.CARDSIGHT_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing CARDSIGHT_API_KEY in .env.local", code: "missing_cardsight_key" },
      { status: 503 },
    );
  }

  const incoming = await request.formData();
  const front = incoming.get("front");
  if (!(front instanceof File)) {
    return NextResponse.json({ ok: false, error: "Front image is required" }, { status: 400 });
  }

  try {
    // Free preflight: confirm CardSight can actually see a trading card in the image.
    const detectionCheck = await postBinary(`${BASE}/v1/detect/card`, key, front);
    const cardDetected = detectionCheck.response.ok && detectionCheck.json.detected === true;
    const detectedCount = Number(detectionCheck.json.count ?? 0);

    if (!detectionCheck.response.ok) {
      const upstreamError = detectionCheck.json.detail ?? detectionCheck.json.message ?? detectionCheck.json.error ?? detectionCheck.raw.slice(0, 250);
      return NextResponse.json(
        { ok: false, error: text(upstreamError) || `CardSight detect HTTP ${detectionCheck.response.status}`, code: `cardsight_detect_${detectionCheck.response.status}` },
        { status: detectionCheck.response.status },
      );
    }

    if (!cardDetected) {
      return NextResponse.json(
        { ok: false, error: "CardSight did not detect a trading card in the front image. Use a straight-on photo with the full card visible and little background.", code: "no_card_detected", detectedCount },
        { status: 422 },
      );
    }

    // First try automatic segment detection.
    let identified = await postBinary(`${BASE}/v1/identify/card`, key, front);
    if (!identified.response.ok) {
      const upstreamError = identified.json.detail ?? identified.json.message ?? identified.json.error ?? identified.raw.slice(0, 250);
      return NextResponse.json(
        { ok: false, error: text(upstreamError) || `CardSight HTTP ${identified.response.status}`, code: `cardsight_${identified.response.status}`, cardDetected: true },
        { status: identified.response.status },
      );
    }

    let identification = normalizeIdentification(identified.json);
    let mode = "auto";

    // CardSight specifically recommends a known sport segment for better accuracy.
    // For the current sports-card prototype, retry Baseball once when auto-detect sees
    // the card but cannot match it. This only happens after a failed auto ID.
    if (!identification) {
      const baseball = await postBinary(`${BASE}/v1/identify/card/baseball`, key, front);
      if (baseball.response.ok) {
        const baseballIdentification = normalizeIdentification(baseball.json);
        if (baseballIdentification) {
          identified = baseball;
          identification = baseballIdentification;
          mode = "baseball";
        }
      }
    }

    if (!identification) {
      return NextResponse.json(
        {
          ok: false,
          error: "CardSight detected the trading card clearly, but could not match it to an identifiable catalog card. This is likely a catalog/set coverage issue, not a bad photo. Use Search / Enter Manually for this card.",
          code: "catalog_no_match",
          cardDetected: true,
          detectedCount,
        },
        { status: 422 },
      );
    }

    const scanId = text(identified.json.requestId) || `cardsight_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    scans.set(scanId, { status: "completed", identification });

    return NextResponse.json({
      ok: true,
      scanId,
      status: "completed",
      provider: "CardSight AI",
      mode,
      cardDetected: true,
      detectedCount,
      processingTime: identified.json.processingTime ?? null,
      confidence: identification.confidence,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "CardSight photo identification failed" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing scan id" }, { status: 400 });

  const scan = scans.get(id);
  if (!scan) {
    return NextResponse.json({ ok: false, error: "Identification result expired. Run photo identification again." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    scanId: id,
    status: "completed",
    progressPercent: 100,
    statusMessage: "Card identified by CardSight AI",
    identification: scan.identification,
    provider: "CardSight AI",
  });
}
