import {
  differenceInCalendarDays as dateFnsDifferenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";

declare const dateOnlyBrand: unique symbol;
declare const instantBrand: unique symbol;

export type DateOnly = string & { readonly [dateOnlyBrand]: true };
export type Instant = string & { readonly [instantBrand]: true };

export type DecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "missing" | "invalid" | "ambiguous" };

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const instantPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function missing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

export function decodeDateOnly(value: unknown): DecodeResult<DateOnly> {
  if (missing(value)) return { ok: false, reason: "missing" };
  if (value instanceof Date) {
    return isValid(value)
      ? { ok: false, reason: "ambiguous" }
      : { ok: false, reason: "invalid" };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: false, reason: "ambiguous" }
      : { ok: false, reason: "invalid" };
  }
  if (typeof value !== "string") return { ok: false, reason: "invalid" };

  const text = value.trim();
  if (dateOnlyPattern.test(text)) {
    const parsed = parseISO(text);
    return isValid(parsed) && format(parsed, "yyyy-MM-dd") === text
      ? { ok: true, value: text as DateOnly }
      : { ok: false, reason: "invalid" };
  }

  return !Number.isNaN(Date.parse(text))
    ? { ok: false, reason: "ambiguous" }
    : { ok: false, reason: "invalid" };
}

export function decodeInstant(value: unknown): DecodeResult<Instant> {
  if (missing(value)) return { ok: false, reason: "missing" };
  if (value instanceof Date) {
    return isValid(value)
      ? { ok: true, value: value.toISOString() as Instant }
      : { ok: false, reason: "invalid" };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: false, reason: "ambiguous" }
      : { ok: false, reason: "invalid" };
  }
  if (typeof value !== "string") return { ok: false, reason: "invalid" };

  const text = value.trim();
  if (instantPattern.test(text)) {
    const parsed = parseISO(text);
    return isValid(parsed)
      ? { ok: true, value: parsed.toISOString() as Instant }
      : { ok: false, reason: "invalid" };
  }

  return !Number.isNaN(Date.parse(text))
    ? { ok: false, reason: "ambiguous" }
    : { ok: false, reason: "invalid" };
}

export function dateToDateOnly(value: Date, timeZone: string): DateOnly {
  if (!isValid(value)) throw new RangeError("Cannot convert an invalid Date.");

  const parts = new Intl.DateTimeFormat("en-CA-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  const decoded = decodeDateOnly(result);
  if (!decoded.ok) throw new RangeError(`Cannot convert Date in time zone "${timeZone}".`);
  return decoded.value;
}

export function instantToDateOnly(value: Instant, timeZone: string): DateOnly {
  return dateToDateOnly(new Date(value), timeZone);
}

export function instantFromEpochMilliseconds(value: number): Instant {
  if (!Number.isFinite(value)) throw new RangeError("Epoch milliseconds must be finite.");
  const date = new Date(value);
  if (!isValid(date)) throw new RangeError("Epoch milliseconds are outside the supported range.");
  return date.toISOString() as Instant;
}

export function formatDateOnly(
  value: DateOnly,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  },
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00.000Z`),
  );
}

export function formatInstant(
  value: Instant,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(value));
}

export function calendarDayDifference(left: DateOnly, right: DateOnly): number {
  return dateFnsDifferenceInCalendarDays(parseISO(left), parseISO(right));
}
