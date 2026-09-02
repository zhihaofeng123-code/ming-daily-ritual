/**
 * Flood control for the unauthenticated client-error sink.
 *
 * The endpoint cannot authenticate — a page broken enough to report is not in a
 * position to prove who it is — so the only thing standing between it and
 * unbounded log volume (and the bill that follows) is a cap. A healthy page
 * sends at most a couple of reports per load and the recovery guard already
 * bounds reload cycles, so anything past this is a stuck client or someone
 * poking the endpoint.
 *
 * Be clear about the scope: this is one process's memory. Serverless instances
 * are ephemeral and scale horizontally, so it reliably blunts a single hot
 * client landing on a warm instance and does nothing about distributed abuse.
 * Add a rate rule at the CDN or WAF where that matters.
 */

export const RATE_WINDOW_MS = 60_000;
export const MAX_REPORTS_PER_WINDOW = 20;
/** Bounds the accounting table itself, so the limiter cannot become the leak. */
export const MAX_TRACKED_CLIENTS = 5_000;

const reportWindows = new Map<string, { count: number; resetAt: number }>();

/** Test seam: the module keeps process-lifetime state by design. */
export function resetRateLimitState(): void {
  reportWindows.clear();
}

/**
 * Identify the caller from proxy headers.
 *
 * The left-most `x-forwarded-for` entry is the original client as recorded by
 * the edge. It is spoofable in principle, which is acceptable here: a spoofed
 * key spreads one abuser's requests across buckets rather than letting them
 * evade a real security control, and the caps above still bound memory.
 */
export function clientKeyFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return first || headers.get("x-real-ip") || "unknown";
}

/** Counts this request and reports whether the caller has exceeded its window. */
export function isOverLimit(key: string, now: number = Date.now()): boolean {
  const entry = reportWindows.get(key);
  if (entry && entry.resetAt > now) {
    entry.count += 1;
    return entry.count > MAX_REPORTS_PER_WINDOW;
  }

  if (reportWindows.size >= MAX_TRACKED_CLIENTS) {
    for (const [trackedKey, tracked] of reportWindows) {
      if (tracked.resetAt <= now) reportWindows.delete(trackedKey);
    }
    // Still full means every window is live. Drop the table rather than grow
    // without bound; the cost is a forgotten count, not unbounded memory.
    if (reportWindows.size >= MAX_TRACKED_CLIENTS) reportWindows.clear();
  }

  reportWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
  return false;
}
