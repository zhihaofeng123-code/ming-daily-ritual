import { NextResponse } from "next/server";
import {
  computePillars,
  dayMasterStrength,
  elementLoad,
  jdToDate,
  lichunJD,
  zonedWallClockToMs,
  zoneOffsetMinutes,
  type Chart,
} from "@/lib/ming/bazi";
import { isKnownTimeZone } from "@/lib/ming/cities";
import { buildSignal } from "@/lib/ming/signal";

type Body = {
  date?: string;
  time?: string;
  tz?: string;
  lat?: number;
  lon?: number;
  place?: string;
  target?: string;
  viewerTz?: string;
  trueSolarTime?: boolean;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

function slimPillar(p: Chart["year"]) {
  return {
    cn: p.cn,
    stem: { cn: p.stem.cn, py: p.stem.py, element: p.stem.element, yang: p.stem.yang },
    branch: {
      cn: p.branch.cn,
      py: p.branch.py,
      element: p.branch.element,
      animal: p.branch.animal,
    },
  };
}
const slimChart = (c: Chart) => ({
  year: slimPillar(c.year),
  month: slimPillar(c.month),
  day: slimPillar(c.day),
  hour: slimPillar(c.hour),
  meta: c.meta,
});

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const dateMatch = DATE_RE.exec(body.date ?? "");
  const timeMatch = TIME_RE.exec(body.time ?? "");
  const targetMatch = DATE_RE.exec(body.target ?? "");
  if (!dateMatch) return NextResponse.json({ error: "Birth date is required." }, { status: 400 });
  if (!timeMatch) return NextResponse.json({ error: "Birth time is required." }, { status: 400 });
  if (!targetMatch) return NextResponse.json({ error: "Target day is required." }, { status: 400 });

  const tz = body.tz ?? "";
  if (!tz || !isKnownTimeZone(tz)) {
    return NextResponse.json({ error: "Birth place time zone is not recognised." }, { status: 400 });
  }
  const viewerTz = body.viewerTz && isKnownTimeZone(body.viewerTz) ? body.viewerTz : tz;
  const lat = typeof body.lat === "number" ? body.lat : 0;
  const lon = typeof body.lon === "number" ? body.lon : 0;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "Birth place coordinates are out of range." }, { status: 400 });
  }

  const [, by, bm, bd] = dateMatch.map(Number) as unknown as [string, number, number, number];
  const [, bh, bmin] = timeMatch.map(Number) as unknown as [string, number, number];
  const [, ty, tm, td] = targetMatch.map(Number) as unknown as [string, number, number, number];
  if (by < 1902 || by > 2099) {
    return NextResponse.json(
      { error: "Birth year must be between 1902 and 2099 for reliable time-zone history." },
      { status: 400 }
    );
  }

  const useTst = body.trueSolarTime !== false;
  const birthMs = zonedWallClockToMs(by, bm, bd, bh, bmin, tz);

  let natal: Chart;
  let today: Chart;
  try {
    natal = computePillars(birthMs, tz, lon, useTst);
    // Today's pillars are read at local noon so the day pillar sits far from any
    // midnight or double-hour boundary; only the calendar day and season matter here.
    today = computePillars(zonedWallClockToMs(ty, tm, td, 12, 0, viewerTz), viewerTz, 0, false);
  } catch {
    return NextResponse.json({ error: "Could not compute a chart for that moment." }, { status: 400 });
  }

  const signal = buildSignal(natal, today);
  const { share, load } = elementLoad(natal);

  return NextResponse.json({
    signal,
    natal: slimChart(natal),
    today: slimChart(today),
    place: body.place ?? "",
    reading: {
      elementLoad: load,
      elementShare: share,
      strength: dayMasterStrength(natal),
    },
    worked: {
      birthInstantUTC: new Date(birthMs).toISOString(),
      birthZone: tz,
      birthZoneOffsetMinutes: zoneOffsetMinutes(birthMs, tz),
      birthLongitude: lon,
      lichunForBaziYear: jdToDate(lichunJD(natal.meta.baziYear)).toISOString(),
      solarLongitudeAtBirth: natal.meta.solarLongitude,
      targetDate: body.target,
      viewerTz,
    },
  });
}
