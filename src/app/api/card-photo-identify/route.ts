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

  const form = new FormData();
  form.append("image", front, front.name || "card.jpg");

  try {
    const response = await fetch(`${BASE}/v1/identify/card`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
      },
      body: form,
      cache: "no-store",
    });

    const raw = await response.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(raw); } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: text(json.detail ?? json.message ?? json.error ?? raw.slice(0, 250) || `CardSight HTTP ${response.status}`),
          code: `cardsight_${response.status}`,
        },
        { status: response.status },
      );
    }

    const detections = Array.isArray(json.detections) ? json.detections as Record<string, unknown>[] : [];
    if (!detections.length) {
      return NextResponse.json({ ok: false, error: "CardSight did not identify a card in the front image", code: "no_detection" }, { status: 422 });
    }

    const detection = detections[0];
    const card = obj(detection.card);
    const grading = obj(detection.grading);
    const company = obj(grading.company);
    const grade = obj(grading.grade);
    const printRun = text(card.printRun ?? card.print_run ?? card.serialNumber ?? card.serial_number);

    const identification = {
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

    const scanId = text(json.requestId) || `cardsight_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    scans.set(scanId, { status: "completed", identification });

    return NextResponse.json({
      ok: true,
      scanId,
      status: "completed",
      provider: "CardSight AI",
      processingTime: json.processingTime ?? null,
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
