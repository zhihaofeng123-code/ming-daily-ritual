/**
 * One-shot automatic recovery for client-side render failures.
 *
 * The common cause of a page that renders on the server and then dies in the
 * browser is persisted state the current code cannot handle. That failure is
 * sticky — the bad value is still there on the next load — so the visitor sees
 * a dead site on every visit and reloading changes nothing. Telling them to
 * clear site data is not a usable answer for a normal person.
 *
 * So the boundary tries to repair the browser before it tries to explain
 * anything: drop this origin's persisted state and reload once. A visitor with
 * a corrupted value sees a blank flash and then a working page, and is never
 * shown an error at all. Only if the reloaded page fails again — meaning the
 * fault was not local state — do we show a human-readable page.
 *
 * The attempt is marked before the wipe and the marker survives it, so a
 * failure that recurs cannot produce a reload loop.
 */

import { clearClientState } from "@/lib/client-storage";

/** Marker key. Preserved across the wipe; without it, recovery would loop. */
const RECOVERY_MARKER_KEY = "__kylon_recovery_attempt";

/**
 * How long a recorded attempt suppresses further attempts.
 *
 * Elapsed time is the whole guard, deliberately. The obvious refinement —
 * clearing the marker as soon as the app renders successfully — cannot be
 * mounted anywhere safe: the root layout still renders when the page beneath it
 * throws, so a component there clears the marker on exactly the loads where it
 * is holding a loop shut. That reliably produces an infinite reload cycle
 * (measured: ~20 reloads a second). The marker also lives in sessionStorage, so
 * it is already scoped to one tab and dies with it; a visitor who returns later
 * always gets a fresh attempt.
 */
const RECOVERY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Keys that survive automatic recovery.
 *
 * Extend this in an app that stores a decision it must not silently discard —
 * a cookie-consent choice is the usual one, because re-asking someone who
 * already answered is its own regression. Do not add convenience state here:
 * anything listed is state that recovery cannot repair.
 */
export const RECOVERY_PRESERVED_KEYS: readonly string[] = [RECOVERY_MARKER_KEY];

function sessionStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** True when no repair has been attempted in this tab inside the window. */
export function canAttemptRecovery(): boolean {
  const storage = sessionStorageOrNull();
  // No durable marker means no way to guarantee a single attempt, and an
  // unbounded reload loop is far worse than showing the fallback page.
  if (!storage) return false;
  try {
    const raw = storage.getItem(RECOVERY_MARKER_KEY);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at > RECOVERY_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Record the attempt, wipe persisted state, and reload.
 *
 * Returns false when the repair did not complete, so the caller falls through
 * to the visible fallback rather than looping. False does not mean nothing
 * happened: it is returned before anything is touched when the attempt cannot
 * be recorded, but also after the wipe if `reload()` itself fails. There is no
 * rollback, and none is wanted — the wipe is the repair, and a caller that
 * shows the fallback on an already-cleaned browser is still correct. Treat
 * false as "do not assume this is fixed", not as "state is unchanged".
 */
export function attemptRecovery(preserveKeys: readonly string[] = RECOVERY_PRESERVED_KEYS): boolean {
  const storage = sessionStorageOrNull();
  if (!storage) return false;
  try {
    storage.setItem(RECOVERY_MARKER_KEY, String(Date.now()));
  } catch {
    return false;
  }

  const preserve = preserveKeys.includes(RECOVERY_MARKER_KEY)
    ? preserveKeys
    : [...preserveKeys, RECOVERY_MARKER_KEY];
  clearClientState(preserve);

  try {
    window.location.reload();
  } catch {
    return false;
  }
  return true;
}
