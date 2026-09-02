import { computePillars, dayPillarForCivilDate, lichunJD, jdToDate, zonedWallClockToMs } from "../../lib/ming/bazi";
import { buildSignal } from "../../lib/ming/signal";
// @ts-expect-error untyped test-only dependency
import lunar from "lunar-javascript";
const { Solar } = lunar as { Solar: { fromYmdHms: (y: number, m: number, d: number, h: number, mi: number, s: number) => { getLunar: () => { getEightChar: () => { setSect: (n: number) => void; getYear: () => string; getMonth: () => string; getDay: () => string; getTime: () => string } } } } };

let fail = 0;
const check = (name: string, got: string, want: string) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(46)} ${got}${ok ? "" : `   (expected ${want})`}`);
};

console.log("--- solar terms vs Hong Kong Observatory published times");
const terms: [string, number, string][] = [
  ["Lichun 2024", 2024, "2024-02-04T08:27"],
  ["Lichun 2025", 2025, "2025-02-03T14:10"],
  ["Lichun 2026", 2026, "2026-02-03T20:02"],
];
for (const [name, y, want] of terms) {
  check(name, jdToDate(lichunJD(y)).toISOString().slice(0, 16), want);
}

console.log("\n--- day pillars vs published sexagenary anchors");
check("1970-01-01", dayPillarForCivilDate(1970, 1, 1).py, "Xin Si");
check("2000-01-01", dayPillarForCivilDate(2000, 1, 1).py, "Wu Wu");
check("2019-01-27 (jiazi anchor)", dayPillarForCivilDate(2019, 1, 27).py, "Jia Zi");
check("2024-06-15", dayPillarForCivilDate(2024, 6, 15).py, "Geng Xu");

console.log("\n--- full chart vs pyswisseph-derived fixture");
const f = computePillars(Date.UTC(2024, 5, 15, 12, 0), "UTC", 0, false);
check("2024-06-15 12:00 UTC", [f.year.py, f.month.py, f.day.py, f.hour.py].join(" | "), "Jia Chen | Geng Wu | Geng Xu | Ren Wu");

console.log("\n--- 4000 random charts vs lunar-javascript (independent implementation)");
const buckets: Record<string, number> = { year: 0, month: 0, day: 0, hour: 0 };
let lateZi = 0;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
for (let i = 0; i < 4000; i++) {
  const y = rnd(1940, 2035), mo = rnd(1, 12), d = rnd(1, 28), h = rnd(0, 23), mi = rnd(0, 59);
  if (h === 23) { lateZi++; continue; }
  const mine = computePillars(Date.UTC(y, mo - 1, d, h - 8, mi), "Etc/GMT-8", 0, false);
  const ec = Solar.fromYmdHms(y, mo, d, h, mi, 0).getLunar().getEightChar();
  ec.setSect(2);
  const t = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
  const o = [mine.year.cn, mine.month.cn, mine.day.cn, mine.hour.cn];
  (["year", "month", "day", "hour"] as const).forEach((k, idx) => { if (o[idx] !== t[idx]) buckets[k]++; });
}
for (const k of ["year", "month", "day", "hour"]) check(`${k} pillar mismatches`, String(buckets[k]), "0");
console.log(`      (${lateZi} late-Zi charts skipped: documented convention split)`);

console.log("\n--- different inputs must give different output");
const people: [string, number, number, number, number, number, string, number][] = [
  ["A", 1994, 3, 17, 7, 42, "America/Los_Angeles", -122.4194],
  ["B", 1988, 11, 2, 21, 10, "Asia/Taipei", 121.5654],
  ["C", 2001, 6, 30, 14, 5, "Europe/London", -0.1276],
];
const seen = new Set<string>();
let rows = 0;
for (const [, y, mo, d, h, mi, tz, lon] of people) {
  const natal = computePillars(zonedWallClockToMs(y, mo, d, h, mi, tz), tz, lon, true);
  for (let k = 0; k < 40; k++) {
    const t = new Date(Date.UTC(2026, 8, 2 + k, 12));
    const day = computePillars(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 12), "UTC", 0, false);
    const s = buildSignal(natal, day);
    seen.add([s.observation, s.theme, s.action, s.notice].join("|"));
    rows++;
  }
}
console.log(`      ${rows} signals produced, ${seen.size} distinct (${((seen.size / rows) * 100).toFixed(0)}% unique)`);
if (seen.size < rows * 0.6) { fail++; console.log("FAIL  output not sufficiently input-dependent"); }

console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
