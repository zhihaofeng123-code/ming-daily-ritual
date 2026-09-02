import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDayDifference,
  dateToDateOnly,
  decodeDateOnly,
  decodeInstant,
  formatDateOnly,
  formatInstant,
  instantFromEpochMilliseconds,
  instantToDateOnly,
} from "./index";

test("decodes only canonical DateOnly values", () => {
  assert.deepEqual(decodeDateOnly("2024-02-29"), { ok: true, value: "2024-02-29" });
  assert.deepEqual(decodeDateOnly("2023-02-29"), { ok: false, reason: "invalid" });
  assert.deepEqual(decodeDateOnly("08/05/2026"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(decodeDateOnly(new Date(Number.NaN)), { ok: false, reason: "invalid" });
  assert.deepEqual(decodeDateOnly(""), { ok: false, reason: "missing" });
});

test("decodes only ISO instants with an explicit offset", () => {
  assert.deepEqual(decodeInstant("2026-08-05T12:30:00Z"), {
    ok: true,
    value: "2026-08-05T12:30:00.000Z",
  });
  assert.deepEqual(decodeInstant("2026-08-05T20:30:00+08:00"), {
    ok: true,
    value: "2026-08-05T12:30:00.000Z",
  });
  assert.deepEqual(decodeInstant("2026-08-05T12:30:00"), {
    ok: false,
    reason: "ambiguous",
  });
  assert.deepEqual(decodeInstant(Number.NaN), { ok: false, reason: "invalid" });
  assert.deepEqual(decodeInstant("not a date"), { ok: false, reason: "invalid" });
});

test("converts epoch milliseconds and requires a time zone for calendar dates", () => {
  const instant = instantFromEpochMilliseconds(1_785_974_400_000);
  assert.equal(instant, "2026-08-06T00:00:00.000Z");
  assert.equal(instantToDateOnly(instant, "UTC"), "2026-08-06");
  assert.equal(instantToDateOnly(instant, "America/Los_Angeles"), "2026-08-05");
  assert.equal(dateToDateOnly(new Date("2026-08-05T00:00:00Z"), "Asia/Singapore"), "2026-08-05");
});

test("handles leap days, DST, formatting, and calendar-day differences", () => {
  const leapDay = decodeDateOnly("2024-02-29");
  const dstStart = decodeDateOnly("2024-03-10");
  const dstEnd = decodeDateOnly("2024-03-11");
  assert.ok(leapDay.ok && dstStart.ok && dstEnd.ok);
  assert.equal(calendarDayDifference(dstEnd.value, dstStart.value), 1);
  assert.equal(formatDateOnly(leapDay.value, { dateStyle: "long" }), "February 29, 2024");

  const beforeDstJump = decodeInstant("2024-03-10T07:30:00Z");
  const afterDstJump = decodeInstant("2024-03-10T10:30:00Z");
  assert.ok(beforeDstJump.ok && afterDstJump.ok);
  assert.equal(instantToDateOnly(beforeDstJump.value, "America/Los_Angeles"), "2024-03-09");
  assert.equal(instantToDateOnly(afterDstJump.value, "America/Los_Angeles"), "2024-03-10");

  const instant = decodeInstant("2024-03-10T09:30:00Z");
  assert.ok(instant.ok);
  assert.match(formatInstant(instant.value, "America/Los_Angeles"), /Mar 10, 2024/);
});

test("rejects the String(Date).slice regression instead of parsing it as 2001", () => {
  const source = new Date("2026-08-05T12:00:00Z");
  const truncated = String(source).slice(0, 10);
  assert.equal(truncated, "Wed Aug 05");
  assert.deepEqual(decodeDateOnly(truncated), { ok: false, reason: "ambiguous" });
  assert.equal(dateToDateOnly(source, "UTC"), "2026-08-05");
});
