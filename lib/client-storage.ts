/**
 * Validated access to browser-persisted state.
 *
 * Persisted state is untrusted input. It outlives the code that wrote it, so a
 * value written by an older build, a half-finished write, or an unrelated tool
 * on the same origin can still be sitting there years later. Reading it back
 * with a bare `JSON.parse` and handing the result straight to render is how a
 * single stale key takes an entire site down: the parse succeeds, the shape is
 * wrong, the first `.map`/`.reduce` throws during render, and — because the
 * value stays on disk — every subsequent load throws in exactly the same place.
 * Reloading does not help, which is the part that makes it look like the site
 * itself is broken.
 *
 * So every read validates, and an invalid value is discarded rather than
 * returned. The visitor sees a default (an empty cart, unset preferences), the
 * page renders, and nobody has to be told to open developer tools.
 */

/** Never throws, including when storage is unavailable (private mode, quota). */
function getStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export interface ReadStoredOptions {
  /** Defaults to localStorage. */
  storage?: "local" | "session";
}

/**
 * Read, parse, and validate a JSON value.
 *
 * Returns `fallback` when the key is absent, unparseable, or fails `isValid`,
 * and removes the offending value so the next read starts clean.
 */
export function readStored<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
  options: ReadStoredOptions = {},
): T {
  const storage = getStorage(options.storage ?? "local");
  if (!storage) return fallback;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeStored(key, options);
    return fallback;
  }

  if (!isValid(parsed)) {
    removeStored(key, options);
    return fallback;
  }
  return parsed;
}

/**
 * Read an array and keep only the entries that validate.
 *
 * A single malformed entry loses that entry, not the whole collection, and the
 * pruned collection is written back so the repair is permanent.
 */
export function readStoredArray<T>(
  key: string,
  isValidItem: (value: unknown) => value is T,
  options: ReadStoredOptions = {},
): T[] {
  const parsed = readStored<unknown[]>(key, (value): value is unknown[] => Array.isArray(value), [], options);
  const items = parsed.filter(isValidItem);
  if (items.length !== parsed.length) writeStored(key, items, options);
  return items;
}

/** Best-effort write. Storage being unavailable must never block the UI. */
export function writeStored(key: string, value: unknown, options: ReadStoredOptions = {}): void {
  const storage = getStorage(options.storage ?? "local");
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or quota exceeded: the value does not persist, but the
    // current session continues to work with it in memory.
  }
}

export function removeStored(key: string, options: ReadStoredOptions = {}): void {
  const storage = getStorage(options.storage ?? "local");
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}

/**
 * Last-resort recovery: drop this origin's persisted state.
 *
 * Only the error boundary calls this, and only on a page that has already
 * failed to render. Losing a saved preference is strictly better than serving a
 * permanently dead page, but the consent decision is preserved by default:
 * re-asking someone who already answered is a regression in its own right.
 */
export function clearClientState(preserveKeys: readonly string[] = []): void {
  const preserve = new Set(preserveKeys);
  for (const kind of ["local", "session"] as const) {
    const storage = getStorage(kind);
    if (!storage) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key !== null && !preserve.has(key)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch {
      // Storage disappeared mid-loop: nothing further to clear.
    }
  }
}
