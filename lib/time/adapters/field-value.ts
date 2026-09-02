import {
  dateToDateOnly,
  decodeDateOnly,
  decodeInstant,
  instantToDateOnly,
  type DateOnly,
  type DecodeResult,
  type Instant,
} from "../index";

export function decodeFieldDateOnly(
  value: unknown,
  timeZone: string,
): DecodeResult<DateOnly> {
  const dateOnly = decodeDateOnly(value);
  if (dateOnly.ok || dateOnly.reason === "missing") return dateOnly;
  if (value instanceof Date) {
    try {
      return { ok: true, value: dateToDateOnly(value, timeZone) };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  const instant = decodeInstant(value);
  return instant.ok
    ? { ok: true, value: instantToDateOnly(instant.value, timeZone) }
    : dateOnly;
}

export function decodeFieldInstant(value: unknown): DecodeResult<Instant> {
  return decodeInstant(value);
}
