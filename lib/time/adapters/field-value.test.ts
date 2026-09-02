import assert from "node:assert/strict";
import test from "node:test";
import { decodeFieldDateOnly, decodeFieldInstant } from "./field-value";

test("normalizes form and workspace field values before rendering", () => {
  assert.deepEqual(decodeFieldDateOnly("2026-08-05", "UTC"), {
    ok: true,
    value: "2026-08-05",
  });
  assert.deepEqual(decodeFieldDateOnly("2026-08-05T00:30:00Z", "America/Los_Angeles"), {
    ok: true,
    value: "2026-08-04",
  });
  assert.deepEqual(decodeFieldInstant("2026-08-05T08:30:00+08:00"), {
    ok: true,
    value: "2026-08-05T00:30:00.000Z",
  });
});
