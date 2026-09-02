"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  formatDateOnly,
  formatInstant,
  instantToDateOnly,
} from "@/lib/time";
import {
  decodeFieldDateOnly,
  decodeFieldInstant,
} from "@/lib/time/adapters/field-value";
import { commitOnEnter, type FieldValueEditProps, type FieldValueViewProps } from "./shared";

const DATE_FORMAT_PRESETS: Record<string, Intl.DateTimeFormatOptions> = {
  "MM/DD/YYYY": { month: "2-digit", day: "2-digit", year: "numeric" },
  "DD/MM/YYYY": { day: "2-digit", month: "2-digit", year: "numeric" },
  "YYYY-MM-DD": { year: "numeric", month: "2-digit", day: "2-digit" },
  "MMM D, YYYY": { month: "short", day: "numeric", year: "numeric" },
};

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatDate(value: unknown, field: FieldValueViewProps["field"]) {
  const includeTime = field.config?.include_time ?? false;
  const options = field.config?.date_format
    ? { ...DATE_FORMAT_PRESETS[field.config.date_format] }
    : { ...DATE_FORMAT_PRESETS["MM/DD/YYYY"] };
  if (includeTime) {
    const decoded = decodeFieldInstant(value);
    if (!decoded.ok) return String(value ?? "");
    options.hour = "numeric";
    options.minute = "2-digit";
    options.hour12 = true;
    return formatInstant(decoded.value, localTimeZone(), options);
  }

  const decoded = decodeFieldDateOnly(value, "UTC");
  return decoded.ok ? formatDateOnly(decoded.value, options) : String(value ?? "");
}

function inputDateValue(value: unknown, includeTime: boolean) {
  if (includeTime) {
    const instant = decodeFieldInstant(value);
    return instant.ok ? instantToDateOnly(instant.value, localTimeZone()) : "";
  }
  const dateOnly = decodeFieldDateOnly(value, "UTC");
  return dateOnly.ok ? dateOnly.value : "";
}

function inputTimeValue(value: unknown) {
  const instant = decodeFieldInstant(value);
  if (!instant.ok) return "";
  const date = new Date(instant.value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function selectedDateValue(dateValue: string) {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function combineDateTime(dateValue: string, timeValue: string, includeTime: boolean) {
  if (!dateValue) return null;
  if (!includeTime) return dateValue;
  const date = new Date(`${dateValue}T${timeValue || "00:00"}:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateInputFromDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function DateFieldView({ value, field, className }: FieldValueViewProps) {
  return <span className={className ?? "truncate text-sm tabular-nums"}>{formatDate(value, field)}</span>;
}

export function DateFieldEdit({ value, field, onChange, onCommit, autoFocus }: FieldValueEditProps) {
  const includeTime = field.config?.include_time ?? false;
  const dateValue = inputDateValue(value, includeTime);
  const timeValue = inputTimeValue(value);
  const selectedDate = selectedDateValue(dateValue);
  return (
    <div className="w-fit max-w-[calc(100vw-2rem)]">
      <Calendar
        mode="single"
        selected={selectedDate}
        defaultMonth={selectedDate}
        autoFocus={autoFocus && !includeTime}
        onSelect={(date) => {
          const nextDateValue = date ? dateInputFromDate(date) : "";
          const next = combineDateTime(nextDateValue, timeValue, includeTime);
          onChange(next);
          if (!includeTime) onCommit(next);
        }}
      />
      {includeTime ? (
        <div className="border-t border-border/60 p-2">
          <InputGroup className="h-9 w-full border-0 bg-transparent px-2 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <InputGroupAddon align="inline-start" className="pl-0 text-xs uppercase">
              Time
            </InputGroupAddon>
            <InputGroupInput
              autoFocus={autoFocus}
              type="time"
              name={field.key}
              value={timeValue}
              className="px-0 tabular-nums"
              onChange={(event) => {
                const next = combineDateTime(dateValue, event.target.value, true);
                onChange(next);
              }}
              onKeyDown={(event) => {
                const next = combineDateTime(dateValue, event.currentTarget.value, true);
                commitOnEnter(event, next, onCommit);
              }}
            />
          </InputGroup>
        </div>
      ) : null}
    </div>
  );
}
