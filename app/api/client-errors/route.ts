import { NextRequest, NextResponse } from "next/server";
import { clientKeyFromHeaders, isOverLimit } from "@/lib/client-error-rate-limit";

/**
 * Sink for browser-side error reports (see lib/report-client-error.ts).
 *
 * A client render failure never reaches server logs on its own: the page was
 * served successfully and the exception happened afterwards. Writing it here
 * puts it in the platform's normal log stream, which is the difference between
 * noticing a site-wide client crash from telemetry and noticing it because
 * somebody sent a screenshot.
 *
 * The endpoint is unauthenticated by necessity — a broken page cannot be
 * trusted to authenticate — so treat every field as hostile: bound the body,
 * bound each field, log, and return nothing.
 */

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 2_000;

function asBoundedString(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, MAX_FIELD_LENGTH);
}

export async function POST(req: NextRequest) {
  if (isOverLimit(clientKeyFromHeaders(req.headers))) {
    return new NextResponse(null, { status: 429 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new NextResponse(null, { status: 204 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  console.error(
    JSON.stringify({
      event: "client_error",
      boundary: asBoundedString(payload.boundary),
      recovered: payload.recovered === true,
      digest: asBoundedString(payload.digest),
      name: asBoundedString(payload.name),
      message: asBoundedString(payload.message),
      stack: asBoundedString(payload.stack),
      url: asBoundedString(payload.url),
      userAgent: asBoundedString(payload.userAgent),
      reportedAt: asBoundedString(payload.at),
      receivedAt: new Date().toISOString(),
    }),
  );

  // The browser is mid-recovery and ignores the response.
  return new NextResponse(null, { status: 204 });
}
