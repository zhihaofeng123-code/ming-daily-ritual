/** Shapes the browser receives from /api/signal. Kept separate so the client
 *  bundle never imports the VSOP87 tables. */
export type ElementName = "Wood" | "Fire" | "Earth" | "Metal" | "Water";

export type SlimPillar = {
  cn: string;
  stem: { cn: string; py: string; element: ElementName; yang: boolean };
  branch: { cn: string; py: string; element: ElementName; animal: string };
};

export type ChartMeta = {
  instantISO: string;
  solarLongitude: number;
  baziYear: number;
  lichunISO: string;
  monthIdx: number;
  civil: { year: number; month: number; day: number; hour: number; minute: number };
  effective: { year: number; month: number; day: number; hour: number; minute: number };
  zoneOffsetMinutes: number;
  equationOfTimeMinutes: number;
  longitudeMinutes: number;
  solarCorrectionMinutes: number;
  usedTrueSolarTime: boolean;
  minutesToHourBoundary: number;
  degreesToTermBoundary: number;
  lateZi: boolean;
};

export type SlimChart = {
  year: SlimPillar;
  month: SlimPillar;
  day: SlimPillar;
  hour: SlimPillar;
  meta: ChartMeta;
};

export type SignalResponse = {
  signal: {
    observation: string;
    theme: string;
    action: string;
    notice: string;
    keys: { observation: string; theme: string; action: string; notice: string };
    reasoning: {
      dayMaster: { cn: string; py: string; element: ElementName; yang: boolean };
      dayStemGod: {
        key: string;
        cn: string;
        classic: string;
        plain: string;
        element: ElementName;
        natalShare: number;
        state: string;
      };
      season: { branch: { cn: string; py: string; element: ElementName }; direction: string };
      strength: { support: number; drain: number; ratio: number; band: string };
      branchGod: { key: string; cn: string; classic: string; plain: string; stem: { cn: string; py: string } };
      relation: { relation: string; pillar: string | null };
      elementShare: Record<ElementName, number>;
    };
  };
  natal: SlimChart;
  today: SlimChart;
  place: string;
  reading: {
    elementLoad: Record<ElementName, number>;
    elementShare: Record<ElementName, number>;
    strength: { support: number; drain: number; ratio: number; band: string };
  };
  worked: {
    birthInstantUTC: string;
    birthZone: string;
    birthZoneOffsetMinutes: number;
    birthLongitude: number;
    lichunForBaziYear: string;
    solarLongitudeAtBirth: number;
    targetDate: string;
    viewerTz: string;
  };
};

export type BirthDetails = {
  date: string;
  time: string;
  place: string;
  tz: string;
  lat: number;
  lon: number;
};

export function isBirthDetails(value: unknown): value is BirthDetails {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.time === "string" &&
    /^\d{2}:\d{2}$/.test(v.time) &&
    typeof v.place === "string" &&
    typeof v.tz === "string" &&
    v.tz.length > 0 &&
    typeof v.lat === "number" &&
    typeof v.lon === "number"
  );
}
