"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculation } from "@/components/ming/calculation";
import { PlaceField, type PlaceValue } from "@/components/ming/place-field";
import { readStored, writeStored } from "@/lib/client-storage";
import { isBirthDetails, type BirthDetails, type SignalResponse } from "@/lib/ming/client-types";
import { buildUrlStateHref } from "@/lib/url-state";

const STORAGE_KEY = "ming.birth.v1";

/**
 * A signal view must be reconstructable from the URL alone, so it can be linked,
 * reloaded, and captured. Query state is the source of truth when present;
 * localStorage only seeds a first visit that arrives with a bare URL.
 */
function detailsFromParams(params: URLSearchParams): BirthDetails | null {
  const candidate = {
    date: params.get("d") ?? "",
    time: params.get("t") ?? "",
    place: params.get("place") ?? "",
    tz: params.get("tz") ?? "",
    lat: Number(params.get("lat")),
    lon: Number(params.get("lon")),
  };
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lon)) return null;
  return isBirthDetails(candidate) ? candidate : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const viewerTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

function localToday(tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return p; // en-CA gives YYYY-MM-DD
}

function longDate(ymd: string, tz: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function Wordmark() {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-lg font-semibold tracking-[0.2em] text-ink">MING</span>
      <span className="h-px flex-1 bg-rule-strong" />
    </div>
  );
}

export function RitualApp() {
  const tz = useMemo(viewerTz, []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [details, setDetails] = useState<BirthDetails | null>(null);
  const [editing, setEditing] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<PlaceValue | null>(null);

  const [target, setTarget] = useState(() => localToday(viewerTz()));
  const [data, setData] = useState<SignalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = detailsFromParams(params);
    const stored = readStored<BirthDetails | null>(
      STORAGE_KEY,
      (v): v is BirthDetails | null => v === null || isBirthDetails(v),
      null
    );
    const initial = fromUrl ?? stored;
    const dayParam = params.get("day");
    if (dayParam && DATE_RE.test(dayParam)) setTarget(dayParam);
    if (initial) {
      setDetails(initial);
      setDate(initial.date);
      setTime(initial.time);
      setPlace({ place: initial.place, tz: initial.tz, lat: initial.lat, lon: initial.lon });
      setEditing(false);
    }
    setHydrated(true);
  }, []);

  // Keep the address bar in step so the current signal is linkable and reloadable.
  useEffect(() => {
    if (!hydrated || editing || !details) return;
    const href = buildUrlStateHref(
      { pathname, search: searchParams.toString() },
      {
        d: details.date,
        t: details.time,
        tz: details.tz,
        lat: details.lat,
        lon: details.lon,
        place: details.place,
        day: target,
      }
    );
    if (href !== `${pathname}${window.location.search}`) {
      // Typed routes cannot know a runtime-built query string; the href is
      // App-relative by construction in buildUrlStateHref.
      router.replace(href as Parameters<typeof router.replace>[0], { scroll: false });
    }
  }, [hydrated, editing, details, target, pathname, searchParams, router]);

  const load = useCallback(
    async (d: BirthDetails, targetDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...d, target: targetDate, viewerTz: tz }),
        });
        const json = (await res.json()) as SignalResponse & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not read that chart.");
          setData(null);
        } else {
          setData(json);
        }
      } catch {
        setError("Could not reach the engine. Check your connection and try again.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [tz]
  );

  useEffect(() => {
    if (details && !editing) void load(details, target);
  }, [details, editing, target, load]);

  const canSubmit = Boolean(date && time && place);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place || !date || !time) return;
    const next: BirthDetails = {
      date,
      time,
      place: place.place,
      tz: place.tz,
      lat: place.lat,
      lon: place.lon,
    };
    writeStored(STORAGE_KEY, next);
    setDetails(next);
    setEditing(false);
    setShowCalc(false);
  };

  const shiftDay = (delta: number) => {
    const [y, m, d] = target.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + delta));
    setTarget(next.toISOString().slice(0, 10));
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-[38rem]">
        <Wordmark />

        {editing ? (
          <form onSubmit={submit} className="mt-10">
            <h1 className="font-display text-[2rem] leading-[1.15] tracking-tight text-ink sm:text-[2.5rem]">
              One moment in time, read back to you every morning.
            </h1>
            <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-ink-soft">
              MING builds your chart from the position of the sun at your birth, then reads each
              day against it. Two minutes, four lines. It describes conditions and choices, never
              what will happen.
            </p>

            <div className="mt-9 space-y-6">
              <div>
                <label htmlFor="ming-date" className="ming-label mb-2 block">
                  Date of birth
                </label>
                <input
                  id="ming-date"
                  className="ming-field"
                  type="date"
                  required
                  min="1902-01-01"
                  max="2099-12-31"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ming-time" className="ming-label mb-2 block">
                  Time of birth
                </label>
                <input
                  id="ming-time"
                  className="ming-field"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-faint">
                  The clock reading on the record. MING converts it to sun time itself.
                </p>
              </div>
              <div>
                <label className="ming-label mb-2 block" htmlFor="ming-place-input">
                  Place of birth
                </label>
                <PlaceField value={place} onChange={setPlace} />
              </div>
            </div>

            <div className="mt-8">
              <button type="submit" className="ming-button" disabled={!canSubmit}>
                Read today
              </button>
              {details ? (
                <button
                  type="button"
                  className="ming-quiet mt-4 block"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="mt-10">
            <div className="flex items-center justify-between gap-4">
              <p className="ming-label">{longDate(target, tz)}</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous day"
                  className="px-2 py-1 text-sm text-ink-faint hover:text-seal"
                  onClick={() => shiftDay(-1)}
                >
                  &larr;
                </button>
                <button
                  type="button"
                  aria-label="Today"
                  className="px-2 py-1 text-xs text-ink-faint hover:text-seal"
                  onClick={() => setTarget(localToday(tz))}
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next day"
                  className="px-2 py-1 text-sm text-ink-faint hover:text-seal"
                  onClick={() => shiftDay(1)}
                >
                  &rarr;
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-6 border-l-2 border-seal bg-seal-wash px-4 py-3 text-sm text-ink-soft">
                {error}
              </div>
            ) : null}

            {loading && !data ? (
              <div className="mt-6 space-y-3" aria-live="polite">
                <div className="h-7 w-2/3 animate-pulse bg-rule/70" />
                <div className="h-5 w-full animate-pulse bg-rule/50" />
                <div className="h-5 w-5/6 animate-pulse bg-rule/50" />
              </div>
            ) : null}

            {data ? (
              <article className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
                <h1 className="mt-4 font-display text-[1.75rem] leading-tight tracking-tight text-ink">
                  Today&rsquo;s Signal
                </h1>
                <p className="mt-4 font-display text-[1.375rem] leading-[1.45] text-ink sm:text-[1.5rem]">
                  {data.signal.observation}
                </p>
                <p className="mt-4 font-display text-[1.1rem] leading-[1.55] text-ink-soft">
                  {data.signal.theme}
                </p>

                <div className="mt-8 border-t border-rule pt-6">
                  <p className="ming-label mb-1.5">Try</p>
                  <p className="text-[1.0625rem] leading-relaxed text-ink">{data.signal.action}</p>
                </div>
                <div className="mt-6 border-t border-rule pt-6">
                  <p className="ming-label mb-1.5">Notice</p>
                  <p className="text-[1.0625rem] leading-relaxed text-ink">{data.signal.notice}</p>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <button
                    type="button"
                    className="ming-quiet"
                    onClick={() => setShowCalc((v) => !v)}
                  >
                    {showCalc ? "Hide the calculation" : "Show the calculation"}
                  </button>
                  <button type="button" className="ming-quiet" onClick={() => setEditing(true)}>
                    Change your details
                  </button>
                </div>

                <p className="mt-4 text-xs text-ink-faint">
                  {data.place} · {data.natal.day.stem.py} day master ·{" "}
                  {data.natal.year.cn} {data.natal.month.cn} {data.natal.day.cn}{" "}
                  {data.natal.hour.cn}
                </p>

                {showCalc ? <Calculation data={data} /> : null}
              </article>
            ) : null}
          </div>
        )}

        <footer className="mt-16 border-t border-rule pt-5">
          <p className="text-xs leading-relaxed text-ink-faint">
            MING reads conditions, not outcomes. Nothing here predicts events, and nothing here is
            medical, legal or financial advice.
          </p>
        </footer>
      </div>
    </main>
  );
}
