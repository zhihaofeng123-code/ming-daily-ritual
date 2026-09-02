/**
 * Client-error reporting.
 *
 * A client-side render failure is invisible to server logs: the request that
 * served the page returned 200, the exception happened afterwards in the
 * browser, and nothing in the hosting platform records it. Without this, the
 * detection mechanism for a site-wide client crash is a human noticing and
 * saying so — which is both slow and only catches the visitors who bother.
 *
 * The report is deliberately small and best-effort. It must never throw, never
 * block rendering, and never delay recovery.
 */

export const CLIENT_ERROR_ENDPOINT = "/api/client-errors";

const MAX_FIELD_LENGTH = 2_000;

function truncate(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}…` : value;
}

export interface ClientErrorContext {
  /** Where the error surfaced, for example "global-error" or "route-error". */
  boundary: string;
  /** Whether automatic recovery was attempted for this occurrence. */
  recovered?: boolean;
  digest?: string;
}

export function reportClientError(error: unknown, context: ClientErrorContext): void {
  if (typeof window === "undefined") return;

  try {
    const payload = {
      boundary: context.boundary,
      recovered: context.recovered ?? false,
      digest: context.digest ?? null,
      name: error instanceof Error ? error.name : typeof error,
      message: truncate(error instanceof Error ? error.message : String(error)),
      stack: error instanceof Error && error.stack ? truncate(error.stack) : null,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      at: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);

    // sendBeacon survives the reload that recovery triggers; fetch does not
    // reliably. keepalive is the fallback for browsers without sendBeacon.
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, blob)) return;
    }
    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Reporting is diagnostics, not a feature. Failing to report must not
      // produce a second error on a page that is already recovering.
    });
  } catch {
    // Never let the reporter be the reason a boundary fails.
  }
}
