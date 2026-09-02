import "server-only";
import rows from "./cities.json";

export type City = {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
};

type Row = [string, string, string, number, number, string, number];

const CITIES: City[] = (rows as Row[]).map(([name, region, country, lat, lon, tz]) => ({
  name,
  region,
  country,
  lat,
  lon,
  tz,
}));

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const HAYSTACK = CITIES.map((c) => normalize(`${c.name} ${c.region} ${c.country}`));
const NAMES = CITIES.map((c) => normalize(c.name));

/** Ranked prefix-then-substring search. Population order is the tiebreak (source order). */
export function searchCities(query: string, limit = 8): City[] {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (let i = 0; i < CITIES.length; i++) {
    if (NAMES[i].startsWith(q)) {
      starts.push(CITIES[i]);
      if (starts.length >= limit) break;
    } else if (HAYSTACK[i].includes(q)) {
      if (contains.length < limit) contains.push(CITIES[i]);
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

export function isKnownTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
