"use client";

/**
 * Route-segment error boundary.
 *
 * Catches failures below the root layout, so the site chrome survives and only
 * the failed segment is replaced. Recovery follows the same order as the root
 * boundary in app/global-error.tsx: repair the browser silently first, and only
 * show a person an error if that did not work.
 */

import { useEffect, useRef, useState } from "react";
import { attemptRecovery, canAttemptRecovery } from "@/lib/client-recovery";
import { reportClientError } from "@/lib/report-client-error";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [phase, setPhase] = useState<"recovering" | "failed">(() =>
    canAttemptRecovery() ? "recovering" : "failed",
  );
  // See app/global-error.tsx: one attempt and one truthful report per error.
  const handledError = useRef<unknown>(null);

  useEffect(() => {
    if (handledError.current === error) return;
    handledError.current = error;
    const recovered = phase === "recovering" ? attemptRecovery() : false;
    reportClientError(error, {
      boundary: "route-error",
      recovered,
      digest: error.digest,
    });
    if (!recovered) setPhase("failed");
  }, [error, phase]);

  if (phase === "recovering") return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>Something went wrong</h2>
      <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.6, maxWidth: "40ch" }}>
        This section did not load properly. Try again, and if it keeps happening, please get in
        touch.
      </p>
      <button
        type="button"
        onClick={() => reset()}
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
    </div>
  );
}
