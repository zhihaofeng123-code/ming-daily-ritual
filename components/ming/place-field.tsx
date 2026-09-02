"use client";

import { useEffect, useRef, useState } from "react";

export type PlaceValue = { place: string; tz: string; lat: number; lon: number };
type City = { name: string; region: string; country: string; lat: number; lon: number; tz: string };

const describe = (c: City) => [c.name, c.region && c.region !== c.name ? c.region : null, c.country].filter(Boolean).join(", ");

export function PlaceField({
  value,
  onChange,
}: {
  value: PlaceValue | null;
  onChange: (v: PlaceValue | null) => void;
}) {
  const [query, setQuery] = useState(value?.place ?? "");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/cities?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { cities?: City[] }) => {
          setResults(Array.isArray(d.cities) ? d.cities : []);
          setActive(0);
        })
        .catch(() => undefined);
    }, 140);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (c: City) => {
    const label = describe(c);
    setQuery(label);
    setOpen(false);
    onChange({ place: label, tz: c.tz, lat: c.lat, lon: c.lon });
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        className="ming-field"
        type="text"
        autoComplete="off"
        placeholder="Start typing a city"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[2px] border border-rule-strong bg-paper-raised shadow-[0_8px_24px_rgba(23,22,15,0.10)]">
          {results.map((c, i) => (
            <li key={`${c.name}-${c.region}-${c.country}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === active ? "bg-seal-wash text-ink" : "text-ink-soft"
                }`}
              >
                <span className="text-ink">{c.name}</span>
                <span className="text-ink-faint">
                  {" "}
                  {[c.region && c.region !== c.name ? c.region : null, c.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value ? (
        <p className="mt-1.5 text-xs text-ink-faint">
          {value.tz} · {value.lat.toFixed(2)}, {value.lon.toFixed(2)}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-faint">
          Needed for the time zone in force that day and the longitude correction.
        </p>
      )}
    </div>
  );
}
