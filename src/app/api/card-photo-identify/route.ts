import { NextRequest, NextResponse } from "next/server";

const BASE = "https://cardgrader.ai/v1";

export async function POST(request: NextRequest) {
  const key = process.env.CARDGRADER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing CARDGRADER_API_KEY", code: "missing_key" },
      { status: 503 },
    );
  }

  const incoming = await request.formData();
  const front = incoming.get("front");
  const back = incoming.get("back");
  if (!(front instanceof File)) {
    return NextResponse.json({ ok: false, error: "Front image is required" }, { status: 400 });
  }

  const form = new FormData();
  form.append("front", front, front.name || "front.jpg");
  if (back instanceof File) form.append("back", back, back.name || "back.jpg");
  form.append("modules", "identify");

  const idempotency = `cardsignal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const response = await fetch(`${BASE}/scans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Idempotency-Key": idempotency,
      },
      body: form,
      cache: "no-store",
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch {}

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: String(json.detail ?? json.title ?? json.error ?? text.slice(0, 250) || `HTTP ${response.status}`),
          code: String(json.code ?? "upstream_error"),
          creditsRemaining: json.creditsRemaining ?? response.headers.get("x-credits-remaining"),
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      scanId: json.id,
      status: json.status,
      creditsCharged: json.creditsCharged ?? null,
      creditsRemaining: json.creditsRemaining ?? response.headers.get("x-credits-remaining"),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Photo identification request failed" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  const key = process.env.CARDGRADER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing CARDGRADER_API_KEY", code: "missing_key" },
      { status: 503 },
    );
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing scan id" }, { status: 400 });

  try {
    const response = await fetch(`${BASE}/scans/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const text = await response.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch {}

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: String(json.detail ?? json.title ?? json.error ?? text.slice(0, 250) || `HTTP ${response.status}`), code: String(json.code ?? "upstream_error") },
        { status: response.status },
      );
    }

    const identification = (json.identification && typeof json.identification === "object")
      ? json.identification as Record<string, unknown>
      : null;

    return NextResponse.json({
      ok: true,
      scanId: json.id,
      status: json.status,
      progressPercent: json.progressPercent ?? null,
      statusMessage: json.statusMessage ?? null,
      identification: identification ? {
        name: String(identification.name ?? ""),
        subject: String(identification.subject ?? ""),
        category: String(identification.category ?? ""),
        year: String(identification.year ?? ""),
        set: String(identification.set ?? ""),
        number: String(identification.number ?? ""),
        parallel: String(identification.parallel ?? ""),
        printRun: String(identification.printRun ?? ""),
      } : null,
      creditsRemaining: response.headers.get("x-credits-remaining"),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Photo identification polling failed" },
      { status: 502 },
    );
  }
}
