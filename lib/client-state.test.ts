import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import {
  clientKeyFromHeaders,
  isOverLimit,
  MAX_REPORTS_PER_WINDOW,
  MAX_TRACKED_CLIENTS,
  RATE_WINDOW_MS,
  resetRateLimitState,
} from "@/lib/client-error-rate-limit";
import { attemptRecovery, canAttemptRecovery, RECOVERY_PRESERVED_KEYS } from "@/lib/client-recovery";
import { clearClientState, readStored, readStoredArray, writeStored } from "@/lib/client-storage";

const RECOVERY_MARKER_KEY = "__kylon_recovery_attempt";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  failWrites = false;

  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

let localStorage: MemoryStorage;
let sessionStorage: MemoryStorage;
let reload: ReturnType<typeof mock.fn>;

beforeEach(() => {
  localStorage = new MemoryStorage();
  sessionStorage = new MemoryStorage();
  reload = mock.fn();
  (globalThis as { window?: unknown }).window = {
    localStorage,
    sessionStorage,
    location: { reload },
  };
});

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");
const isNumber = (value: unknown): value is number => typeof value === "number";

describe("readStored", () => {
  it("returns the value when it satisfies the guard", () => {
    localStorage.setItem("k", JSON.stringify([1, 2]));
    assert.deepEqual(readStored("k", isNumberArray, []), [1, 2]);
    assert.equal(localStorage.getItem("k"), JSON.stringify([1, 2]));
  });

  it("discards a value of the wrong shape instead of returning it", () => {
    // The failure this whole module exists for: JSON.parse succeeds, the shape
    // is wrong, and the caller's .reduce throws during render.
    for (const poison of ["null", "{}", '{"items":[]}', '"[]"', "123", "[null]"]) {
      localStorage.setItem("k", poison);
      assert.deepEqual(readStored("k", isNumberArray, []), [], `for ${poison}`);
      assert.equal(localStorage.getItem("k"), null, `${poison} must be removed`);
    }
  });

  it("discards unparseable text", () => {
    localStorage.setItem("k", "{not json");
    assert.deepEqual(readStored("k", isNumberArray, []), []);
    assert.equal(localStorage.getItem("k"), null);
  });

  it("returns the fallback without writing when the key is absent", () => {
    assert.deepEqual(readStored("missing", isNumberArray, [7]), [7]);
    assert.equal(localStorage.length, 0);
  });
});

describe("readStoredArray", () => {
  it("keeps valid entries, drops the rest, and persists the repair", () => {
    localStorage.setItem("k", JSON.stringify([1, "two", 3, null]));
    assert.deepEqual(readStoredArray("k", isNumber), [1, 3]);
    assert.equal(localStorage.getItem("k"), JSON.stringify([1, 3]));
  });

  it("treats a non-array as empty", () => {
    localStorage.setItem("k", JSON.stringify({ items: [1] }));
    assert.deepEqual(readStoredArray("k", isNumber), []);
  });
});

describe("writeStored", () => {
  it("swallows a storage failure rather than propagating it", () => {
    localStorage.failWrites = true;
    assert.doesNotThrow(() => writeStored("k", [1]));
  });
});

describe("clearClientState", () => {
  it("clears both storages except the preserved keys", () => {
    localStorage.setItem("cart", "[]");
    localStorage.setItem("consent", "accepted");
    sessionStorage.setItem("scratch", "1");
    sessionStorage.setItem(RECOVERY_MARKER_KEY, "123");

    clearClientState(["consent", RECOVERY_MARKER_KEY]);

    assert.equal(localStorage.getItem("cart"), null);
    assert.equal(localStorage.getItem("consent"), "accepted");
    assert.equal(sessionStorage.getItem("scratch"), null);
    assert.equal(sessionStorage.getItem(RECOVERY_MARKER_KEY), "123");
  });
});

describe("recovery guard", () => {
  it("allows a first attempt and refuses a second one", () => {
    assert.equal(canAttemptRecovery(), true);
    assert.equal(attemptRecovery(), true);
    assert.equal(reload.mock.callCount(), 1);
    assert.equal(canAttemptRecovery(), false);
  });

  it("keeps its own marker through the wipe", () => {
    // Regression: an earlier version cleared the marker on every successful
    // layout render. The root layout still renders when the page below it
    // throws, so the guard was being cleared on exactly the loads that needed
    // it, and the page reloaded ~20 times a second.
    attemptRecovery();
    assert.notEqual(sessionStorage.getItem(RECOVERY_MARKER_KEY), null);
    assert.equal(canAttemptRecovery(), false);
    assert.ok(RECOVERY_PRESERVED_KEYS.includes(RECOVERY_MARKER_KEY));
  });

  it("allows a fresh attempt once the window has passed", () => {
    sessionStorage.setItem(RECOVERY_MARKER_KEY, String(Date.now() - 11 * 60 * 1000));
    assert.equal(canAttemptRecovery(), true);
  });

  it("refuses to recover when the attempt cannot be recorded", () => {
    // Without a durable marker there is no way to bound the attempts, and an
    // unbounded reload loop is worse than showing the fallback.
    sessionStorage.failWrites = true;
    assert.equal(attemptRecovery(), false);
    assert.equal(reload.mock.callCount(), 0);
  });

  it("preserves caller-supplied keys alongside the marker", () => {
    localStorage.setItem("consent", "accepted");
    localStorage.setItem("cart", "[]");
    attemptRecovery(["consent"]);
    assert.equal(localStorage.getItem("consent"), "accepted");
    assert.equal(localStorage.getItem("cart"), null);
    assert.notEqual(sessionStorage.getItem(RECOVERY_MARKER_KEY), null);
  });
});

describe("client-error rate limit", () => {
  beforeEach(() => resetRateLimitState());

  const headers = (map: Record<string, string>) => ({
    get: (name: string) => map[name] ?? null,
  });

  it("admits the window then rejects the overflow", () => {
    const now = 1_000;
    for (let i = 0; i < MAX_REPORTS_PER_WINDOW; i += 1) {
      assert.equal(isOverLimit("1.2.3.4", now), false, `request ${i + 1} must be admitted`);
    }
    assert.equal(isOverLimit("1.2.3.4", now), true);
  });

  it("counts each caller separately", () => {
    const now = 1_000;
    for (let i = 0; i <= MAX_REPORTS_PER_WINDOW; i += 1) isOverLimit("noisy", now);
    assert.equal(isOverLimit("noisy", now), true);
    assert.equal(isOverLimit("quiet", now), false);
  });

  it("starts a fresh window once the old one expires", () => {
    const now = 1_000;
    for (let i = 0; i <= MAX_REPORTS_PER_WINDOW; i += 1) isOverLimit("1.2.3.4", now);
    assert.equal(isOverLimit("1.2.3.4", now), true);
    assert.equal(isOverLimit("1.2.3.4", now + RATE_WINDOW_MS + 1), false);
  });

  it("stays bounded when every tracked window is live", () => {
    // The limiter must not become the memory leak it exists to prevent.
    const now = 1_000;
    for (let i = 0; i < MAX_TRACKED_CLIENTS + 500; i += 1) isOverLimit(`client-${i}`, now);
    // Nothing threw and the table was dropped rather than grown; a fresh caller
    // is still admitted afterwards.
    assert.equal(isOverLimit("after-the-flood", now), false);
  });

  it("reads the original client from proxy headers", () => {
    assert.equal(clientKeyFromHeaders(headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
    assert.equal(clientKeyFromHeaders(headers({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
    assert.equal(clientKeyFromHeaders(headers({})), "unknown");
    // An empty forwarded header must not produce an empty bucket key.
    assert.equal(clientKeyFromHeaders(headers({ "x-forwarded-for": "", "x-real-ip": "7.7.7.7" })), "7.7.7.7");
  });
});
