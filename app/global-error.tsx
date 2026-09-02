"use client";

/**
 * Root error boundary — the last thing between a client-side exception and a
 * dead site.
 *
 * Without this file Next.js renders its own built-in fallback ("This page
 * couldn't load"), which offers a visitor exactly two useless actions: reload,
 * which repeats the same failure, and back. If the cause is persisted state,
 * that fallback is permanent and the site is gone for that browser until
 * someone talks them through clearing site data.
 *
 * So this boundary repairs first and explains second. See lib/client-recovery.
 *
 * Style it to match the site, but keep two properties: the recovery attempt
 * must render nothing (a visitor being repaired should never see an error), and
 * the fallback must stay on inline styles with no imports beyond these — a
 * boundary that depends on the stylesheet or the design system can fail for the
 * same reason the page did.
 */

import { useEffect, useRef, useState } from "react";
import { attemptRecovery, canAttemptRecovery } from "@/lib/client-recovery";
import { reportClientError } from "@/lib/report-client-error";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // Decided during the first render rather than in an effect, so the fallback
  // copy never paints on a page that is about to repair itself and reload.
  const [phase, setPhase] = useState<"recovering" | "failed">(() =>
    canAttemptRecovery() ? "recovering" : "failed",
  );
  // One attempt and one report per distinct error. Without this the failed
  // path reports twice — once optimistically as recovered, then again after
  // the phase flips — and the first entry would claim a recovery that never
  // happened, which is precisely the signal this reporting exists to give.
  const handledError = useRef<unknown>(null);

  useEffect(() => {
    if (handledError.current === error) return;
    handledError.current = error;
    // Attempt first, then report what actually happened. A recovery that
    // cannot run (storage unavailable, reload blocked) must surface the
    // fallback rather than leave a blank page.
    const recovered = phase === "recovering" ? attemptRecovery() : false;
    reportClientError(error, {
      boundary: "global-error",
      recovered,
      digest: error.digest,
    });
    if (!recovered) setPhase("failed");
  }, [error, phase]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {phase === "failed" ? (
          <main
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "24px",
              textAlign: "center",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>Something went wrong</h1>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.6, maxWidth: "40ch" }}>
              This page did not load properly. Try again, and if it keeps happening, please get in
              touch.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: "8px",
                padding: "12px 24px",
                fontSize: "15px",
                cursor: "pointer",
                border: "1px solid currentColor",
                background: "transparent",
                color: "inherit",
              }}
            >
              Try again
            </button>
          </main>
        ) : null}
      </body>
    </html>
  );
}
