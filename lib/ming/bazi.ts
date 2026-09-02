/**
 * MING Four Pillars (BaZi) engine — real calculation, no lookup tables of results.
 *
 * Rules and sources (each cited on the rule it supports):
 *
 * - Year pillar turns at Lichun, the instant the Sun reaches 315 deg apparent
 *   ecliptic longitude. Not 1 January and not Lunar New Year.
 *   https://mingming3.com/en/bazi/articles/bazi_format
 *   https://bazi8.net/en/learn/methodology
 * - Month branch is set by the twelve "jie" solar terms, 30 deg apart: Lichun opens
 *   Yin month, each following jie advances the branch, Xiaohan opens Chou month.
 *   https://mingming3.com/en/bazi/articles/bazi_format
 * - Month stem from the year stem by the Five Tigers rule: Jia/Ji -> Bing,
 *   Yi/Geng -> Wu, Bing/Xin -> Geng, Ding/Ren -> Ren, Wu/Gui -> Jia at Yin month,
 *   advancing one stem per month branch.
 *   https://wiki.openfate.ai/en/bazi/calendar/five-tigers-method
 * - Day pillar from the continuous sexagenary day count keyed to the Julian Day
 *   Number at noon: stem = 1 + mod(JDnoon - 1, 10) and branch = 1 + mod(JDnoon + 1, 12),
 *   both 1-based, anchored on 27 January 2019 = jiazi.
 *   https://ytliu0.github.io/ChineseCalendar/sexagenary.html
 * - Hour branch from the twelve double-hours, Zi spanning 23:00-00:59; hour stem from
 *   the day stem by the Five Rats rule: Jia/Ji -> Jia, Yi/Geng -> Bing, Bing/Xin -> Wu,
 *   Ding/Ren -> Geng, Wu/Gui -> Ren at Zi hour.
 *   https://wiki.openfate.ai/en/bazi/calendar/five-rats-method
 * - Hidden stems of the twelve branches: 子癸; 丑己癸辛; 寅甲丙戊; 卯乙; 辰戊乙癸;
 *   巳丙戊庚; 午丁己; 未己丁乙; 申庚壬戊; 酉辛; 戌戊辛丁; 亥壬甲.
 *   https://wiki.openfate.ai/en/bazi/hidden-stems-roots/twelve-branch-hidden-stems-table
 * - Ten Gods from the day master by five-phase direction plus yin-yang polarity.
 *   https://wiki.openfate.ai/en/bazi/ten-gods/how-the-ten-gods-are-derived
 * - Solar position from the full VSOP87 series via the `astronomia` library
 *   (Jean Meeus, "Astronomical Algorithms", 2nd ed.). Verified against the Hong Kong
 *   Observatory published solar-term times: https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm
 *
 * NOT classical, and flagged as MING's own scoring wherever it appears: the numeric
 * weights for element load (0.6 / 0.3 / 0.15 by hidden-stem qi layer) and the
 * day-master strength bands. The hidden-stem source states the table
 * "does not establish 60/30 or another universal" weighting and that "a product using
 * numerical weights must document its separate algorithm".
 */
import solar from "astronomia/solar";
import eqtime from "astronomia/eqtime";
import { Planet } from "astronomia/planetposition";
import vsop87Bearth from "astronomia/data/vsop87Bearth";
import deltat from "astronomia/deltat";

const earth = new Planet(vsop87Bearth);
const rev360 = (x: number) => ((x % 360) + 360) % 360;
const mod = (n: number, m: number) => ((n % m) + m) % m;

// ------------------------------------------------------------------ calendar

export function gregorianToJD(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}
export const jdToDate = (jd: number) => new Date((jd - 2440587.5) * 86400000);
const decimalYear = (jd: number) => 2000 + (jd - 2451545) / 365.25;

/** Apparent solar ecliptic longitude in degrees, for a Julian Day expressed in UT. */
export function sunLonUT(jdUT: number): number {
  const jde = jdUT + deltat.deltaT(decimalYear(jdUT)) / 86400;
  return rev360((solar.apparentVSOP87(earth, jde).lon * 180) / Math.PI);
}

/** Equation of time in minutes (apparent solar time minus mean solar time). */
export function eqTimeMinutes(jdUT: number): number {
  const jde = jdUT + deltat.deltaT(decimalYear(jdUT)) / 86400;
  return eqtime.e(jde, earth) * (180 / Math.PI) * 4;
}

const angleDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

/** JD (UT) at which apparent solar longitude reaches `target`, searching forward. */
export function findSolarTerm(target: number, startJdUT: number, searchDays = 400): number | null {
  const t = rev360(target);
  let prev = startJdUT;
  let prevLon = sunLonUT(prev);
  for (let i = 1; i <= searchDays; i++) {
    const cur = startJdUT + i;
    const curLon = sunLonUT(cur);
    if (rev360(prevLon - t) > rev360(curLon - t)) {
      let lo = prev;
      let hi = cur;
      for (let k = 0; k < 60 && hi - lo > 0.5 / 86400; k++) {
        const mid = (lo + hi) / 2;
        if (angleDiff(sunLonUT(mid), t) < 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prev = cur;
    prevLon = curLon;
  }
  return null;
}

const termCache = new Map<number, number>();
/** Cached Lichun instant (Sun at 315 deg) as a JD in UT, for a Gregorian year. */
export function lichunJD(gregYear: number): number {
  const hit = termCache.get(gregYear);
  if (hit !== undefined) return hit;
  const v = findSolarTerm(315, gregorianToJD(gregYear, 1, 28), 12);
  if (v === null) throw new Error(`Lichun not found for ${gregYear}`);
  termCache.set(gregYear, v);
  return v;
}

// ---------------------------------------------------------------- time zones

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

/** Wall-clock parts of an absolute instant in an IANA zone. */
export function partsInZone(ms: number, tz: string): WallClock & { second: number } {
  const p: Record<string, number> = {};
  for (const { type, value } of dtf(tz).formatToParts(ms)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
    second: p.second,
  };
}

/**
 * UTC offset in minutes the zone had at that instant. Uses the runtime's IANA
 * tz database, so historical rules and daylight saving are handled, not assumed.
 */
export function zoneOffsetMinutes(ms: number, tz: string): number {
  const p = partsInZone(ms, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - Math.floor(ms / 1000) * 1000) / 60000;
}

/** Local wall clock in an IANA zone -> absolute instant (epoch ms). Two-pass DST fix. */
export function zonedWallClockToMs(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string
): number {
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  let ms = naive - zoneOffsetMinutes(naive, tz) * 60000;
  ms = naive - zoneOffsetMinutes(ms, tz) * 60000;
  return ms;
}

// ------------------------------------------------------------------ symbols

export type ElementName = "Wood" | "Fire" | "Earth" | "Metal" | "Water";
export type Stem = { cn: string; py: string; element: ElementName; yang: boolean };
export type Branch = {
  cn: string;
  py: string;
  element: ElementName;
  animal: string;
  hidden: number[];
};

export const STEMS: Stem[] = [
  { cn: "甲", py: "Jia", element: "Wood", yang: true },
  { cn: "乙", py: "Yi", element: "Wood", yang: false },
  { cn: "丙", py: "Bing", element: "Fire", yang: true },
  { cn: "丁", py: "Ding", element: "Fire", yang: false },
  { cn: "戊", py: "Wu", element: "Earth", yang: true },
  { cn: "己", py: "Ji", element: "Earth", yang: false },
  { cn: "庚", py: "Geng", element: "Metal", yang: true },
  { cn: "辛", py: "Xin", element: "Metal", yang: false },
  { cn: "壬", py: "Ren", element: "Water", yang: true },
  { cn: "癸", py: "Gui", element: "Water", yang: false },
];

export const BRANCHES: Branch[] = [
  { cn: "子", py: "Zi", element: "Water", animal: "Rat", hidden: [9] },
  { cn: "丑", py: "Chou", element: "Earth", animal: "Ox", hidden: [5, 9, 7] },
  { cn: "寅", py: "Yin", element: "Wood", animal: "Tiger", hidden: [0, 2, 4] },
  { cn: "卯", py: "Mao", element: "Wood", animal: "Rabbit", hidden: [1] },
  { cn: "辰", py: "Chen", element: "Earth", animal: "Dragon", hidden: [4, 1, 9] },
  { cn: "巳", py: "Si", element: "Fire", animal: "Snake", hidden: [2, 4, 6] },
  { cn: "午", py: "Wu", element: "Fire", animal: "Horse", hidden: [3, 5] },
  { cn: "未", py: "Wei", element: "Earth", animal: "Goat", hidden: [5, 3, 1] },
  { cn: "申", py: "Shen", element: "Metal", animal: "Monkey", hidden: [6, 8, 4] },
  { cn: "酉", py: "You", element: "Metal", animal: "Rooster", hidden: [7] },
  { cn: "戌", py: "Xu", element: "Earth", animal: "Dog", hidden: [4, 7, 3] },
  { cn: "亥", py: "Hai", element: "Water", animal: "Pig", hidden: [8, 0] },
];

export const ELEMENTS: ElementName[] = ["Wood", "Fire", "Earth", "Metal", "Water"];
const GEN_NEXT: Record<ElementName, ElementName> = {
  Wood: "Fire",
  Fire: "Earth",
  Earth: "Metal",
  Metal: "Water",
  Water: "Wood",
};
const CTRL_NEXT: Record<ElementName, ElementName> = {
  Wood: "Earth",
  Earth: "Water",
  Water: "Fire",
  Fire: "Metal",
  Metal: "Wood",
};

export type PhaseDirection = "peer" | "output" | "wealth" | "authority" | "resource";

/** Direction of `other` seen from `self`. */
export function phaseDirection(self: ElementName, other: ElementName): PhaseDirection {
  if (self === other) return "peer";
  if (GEN_NEXT[self] === other) return "output";
  if (CTRL_NEXT[self] === other) return "wealth";
  if (CTRL_NEXT[other] === self) return "authority";
  return "resource";
}

export type TenGod =
  | "friend"
  | "rival"
  | "craft"
  | "voice"
  | "opening"
  | "holding"
  | "pressure"
  | "structure"
  | "refuge"
  | "support";

const TEN_GOD_TABLE: Record<PhaseDirection, { same: TenGod; diff: TenGod }> = {
  peer: { same: "friend", diff: "rival" },
  output: { same: "craft", diff: "voice" },
  wealth: { same: "opening", diff: "holding" },
  authority: { same: "pressure", diff: "structure" },
  resource: { same: "refuge", diff: "support" },
};

export const TEN_GOD_META: Record<TenGod, { cn: string; classic: string; plain: string }> = {
  friend: { cn: "比肩", classic: "Friend", plain: "your own footing" },
  rival: { cn: "劫財", classic: "Rob Wealth", plain: "competition for the same thing" },
  craft: { cn: "食神", classic: "Eating God", plain: "unhurried output" },
  voice: { cn: "傷官", classic: "Hurting Officer", plain: "unfiltered expression" },
  opening: { cn: "偏財", classic: "Indirect Wealth", plain: "an opening you did not plan" },
  holding: { cn: "正財", classic: "Direct Wealth", plain: "something worth keeping steady" },
  pressure: { cn: "七殺", classic: "Seven Killings", plain: "pressure without a rulebook" },
  structure: { cn: "正官", classic: "Direct Officer", plain: "structure and expectation" },
  refuge: { cn: "偏印", classic: "Indirect Resource", plain: "support on unusual terms" },
  support: { cn: "正印", classic: "Direct Resource", plain: "ordinary, reliable support" },
};

/** Ten God of stem index `otherIdx` seen from day-master stem index `dmIdx`. */
export function tenGod(dmIdx: number, otherIdx: number): TenGod {
  const dm = STEMS[dmIdx];
  const o = STEMS[otherIdx];
  const dir = phaseDirection(dm.element, o.element);
  return TEN_GOD_TABLE[dir][dm.yang === o.yang ? "same" : "diff"];
}

// ------------------------------------------------------------------- pillars

const FIVE_TIGERS_BASE = (yearStemIdx: number) => mod(mod(yearStemIdx, 5) * 2 + 2, 10);
const FIVE_RATS_BASE = (dayStemIdx: number) => mod(mod(dayStemIdx, 5) * 2, 10);

export type Pillar = {
  stemIdx: number;
  branchIdx: number;
  stem: Stem;
  branch: Branch;
  cn: string;
  py: string;
};

const makePillar = (s: number, b: number): Pillar => ({
  stemIdx: s,
  branchIdx: b,
  stem: STEMS[s],
  branch: BRANCHES[b],
  cn: STEMS[s].cn + BRANCHES[b].cn,
  py: `${STEMS[s].py} ${BRANCHES[b].py}`,
});

/** Sexagenary pillar of the calendar day containing local date y-m-d. */
export function dayPillarForCivilDate(y: number, m: number, d: number): Pillar {
  const jdn = gregorianToJD(y, m, d) + 0.5; // JD at noon of that date, an integer
  return makePillar(mod(jdn - 1, 10), mod(jdn + 1, 12));
}

export type ChartMeta = {
  instantISO: string;
  solarLongitude: number;
  baziYear: number;
  lichunISO: string;
  monthIdx: number;
  civil: WallClock;
  effective: WallClock;
  zoneOffsetMinutes: number;
  equationOfTimeMinutes: number;
  longitudeMinutes: number;
  solarCorrectionMinutes: number;
  usedTrueSolarTime: boolean;
  minutesToHourBoundary: number;
  degreesToTermBoundary: number;
  lateZi: boolean;
};

export type Chart = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  dayMasterIdx: number;
  meta: ChartMeta;
};

/**
 * Four Pillars for an absolute instant at a place.
 *
 * Day boundary convention: midnight of the effective local date. Births between
 * 23:00 and 23:59 fall in the Zi hour of the same civil day; schools disagree here
 * and `meta.lateZi` flags it rather than hiding it.
 */
export function computePillars(
  ms: number,
  tz: string,
  lonDeg: number,
  useTrueSolarTime = true
): Chart {
  const jdUT = ms / 86400000 + 2440587.5;
  const lon = sunLonUT(jdUT);

  // year: turns at Lichun (315 deg)
  const utcYear = new Date(ms).getUTCFullYear();
  const lichunThisYear = lichunJD(utcYear);
  const baziYear = jdUT < lichunThisYear ? utcYear - 1 : utcYear;
  const lichunUsed = jdUT < lichunThisYear ? lichunJD(utcYear - 1) : lichunThisYear;
  const yearCycle = mod(baziYear - 1984, 60); // 1984 was a jiazi year
  const yearP = makePillar(mod(yearCycle, 10), mod(yearCycle, 12));

  // month: jie interval measured from Lichun, 30 deg per branch
  const monthIdx = Math.floor(rev360(lon - 315) / 30); // 0 = Yin month
  const monthP = makePillar(
    mod(FIVE_TIGERS_BASE(yearP.stemIdx) + monthIdx, 10),
    mod(2 + monthIdx, 12)
  );

  // effective local clock
  const civilFull = partsInZone(ms, tz);
  const civil: WallClock = {
    year: civilFull.year,
    month: civilFull.month,
    day: civilFull.day,
    hour: civilFull.hour,
    minute: civilFull.minute,
  };
  const offsetMin = zoneOffsetMinutes(ms, tz);
  const eot = eqTimeMinutes(jdUT);
  const solarCorrectionMin = lonDeg * 4 - offsetMin + eot;
  let eff: WallClock = civil;
  if (useTrueSolarTime) {
    const shifted = new Date(
      Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, 0) +
        Math.round(solarCorrectionMin) * 60000
    );
    eff = {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
    };
  }

  // day: continuous sexagenary count on the effective date, midnight boundary
  const dayP = dayPillarForCivilDate(eff.year, eff.month, eff.day);

  // hour: Zi spans 23:00-00:59
  const minutesOfDay = eff.hour * 60 + eff.minute;
  const hourBranchIdx = Math.floor(mod(minutesOfDay + 60, 1440) / 120);
  const hourP = makePillar(mod(FIVE_RATS_BASE(dayP.stemIdx) + hourBranchIdx, 10), hourBranchIdx);

  const intoBlock = mod(minutesOfDay + 60, 120);
  const intoTerm = rev360(lon - 315) % 30;

  return {
    year: yearP,
    month: monthP,
    day: dayP,
    hour: hourP,
    dayMasterIdx: dayP.stemIdx,
    meta: {
      instantISO: new Date(ms).toISOString(),
      solarLongitude: lon,
      baziYear,
      lichunISO: jdToDate(lichunUsed).toISOString(),
      monthIdx,
      civil,
      effective: eff,
      zoneOffsetMinutes: offsetMin,
      equationOfTimeMinutes: eot,
      longitudeMinutes: lonDeg * 4,
      solarCorrectionMinutes: solarCorrectionMin,
      usedTrueSolarTime: useTrueSolarTime,
      minutesToHourBoundary: Math.min(intoBlock, 120 - intoBlock),
      degreesToTermBoundary: Math.min(intoTerm, 30 - intoTerm),
      lateZi: eff.hour === 23,
    },
  };
}

// ------------------------------------------------------------- chart reading

/** MING's own weighting by hidden-stem qi layer (primary, middle, residual). */
const HIDDEN_WEIGHTS = [0.6, 0.3, 0.15];

export type ElementShare = Record<ElementName, number>;

/** Weighted five-element load across all eight characters plus hidden stems. */
export function elementLoad(chart: Chart): { load: ElementShare; share: ElementShare } {
  const load: ElementShare = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = chart[key];
    load[p.stem.element] += 1;
    p.branch.hidden.forEach((s, i) => {
      load[STEMS[s].element] += HIDDEN_WEIGHTS[i] ?? 0.15;
    });
  }
  const total = ELEMENTS.reduce((a, e) => a + load[e], 0);
  const share = {} as ElementShare;
  for (const e of ELEMENTS) share[e] = load[e] / total;
  return { load, share };
}

export type LoadState = "scarce" | "present" | "saturated";
/** MING's own bands. */
export function loadState(share: number): LoadState {
  if (share < 0.12) return "scarce";
  if (share > 0.3) return "saturated";
  return "present";
}

export type StrengthBand = "weak" | "balanced" | "strong";
export type Strength = { support: number; drain: number; ratio: number; band: StrengthBand };

/** MING's own scoring: support vs drain, with the month pillar weighted double for season. */
export function dayMasterStrength(chart: Chart): Strength {
  const dm = STEMS[chart.dayMasterIdx];
  let support = 0;
  let drain = 0;
  const add = (element: ElementName, weight: number) => {
    const dir = phaseDirection(dm.element, element);
    if (dir === "peer" || dir === "resource") support += weight;
    else drain += weight;
  };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = chart[key];
    const seasonal = key === "month" ? 2 : 1;
    if (key !== "day") add(p.stem.element, seasonal);
    p.branch.hidden.forEach((s, i) => add(STEMS[s].element, (HIDDEN_WEIGHTS[i] ?? 0.15) * seasonal));
  }
  const ratio = support / (support + drain);
  // Bands are set so the three readings occur at roughly equal rates across the
  // population of possible charts, checked over 4,000 random birth moments.
  const band: StrengthBand = ratio < 0.32 ? "weak" : ratio > 0.48 ? "strong" : "balanced";
  return { support, drain, ratio, band };
}

export type BranchRelation = "clash" | "harmony" | "same" | "none";

/**
 * Six clashes (六冲) are branches six apart: 子午 丑未 寅申 卯酉 辰戌 巳亥.
 * Six harmonies (六合) are the pairs 子丑 寅亥 卯戌 辰酉 巳申 午未, i.e. (i + j) mod 12 === 1.
 */
export function branchRelation(a: number, b: number): BranchRelation {
  if (a === b) return "same";
  if (mod(a - b, 12) === 6) return "clash";
  if (mod(a + b, 12) === 1) return "harmony";
  return "none";
}
