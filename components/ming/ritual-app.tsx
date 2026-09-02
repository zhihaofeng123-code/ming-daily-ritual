"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculation } from "@/components/ming/calculation";
import { PlaceField, type PlaceValue } from "@/components/ming/place-field";
import { readStored, writeStored } from "@/lib/client-storage";
import { isBirthDetails, type BirthDetails, type SignalResponse } from "@/lib/ming/client-types";
import { buildUrlStateHref } from "@/lib/url-state";

const STORAGE_KEY = "ming.birth.v1";

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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

function Mark() {
  return (
    <span className="ming-mark" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
    </span>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="MING home">
        <Mark />
        <span>MING</span>
      </a>
      <div className="header-note">FOUR PILLARS · 八字</div>
      <a className="header-action" href="#reading">
        Read your chart <ArrowRight aria-hidden="true" size={15} />
      </a>
    </header>
  );
}

const features = [
  {
    index: "01",
    title: "Understand yourself",
    label: "YOUR CHART · 命",
    body: "Eight characters describe the materials you were given: wood, fire, earth, metal and water. Not a personality type. A working map of what comes naturally, what asks more of you, and why.",
    image: "/ming/understand-yourself.png",
    alt: "Expressive Chinese calligraphy for life over a celestial chart",
  },
  {
    index: "02",
    title: "Understand your timing",
    label: "YOUR SEASON · 時",
    body: "Your chart stays still. The calendar does not. MING reads the day and the season against your pillars, so you can see where there is momentum, friction, or room to wait.",
    image: "/ming/understand-timing.png",
    alt: "Chinese calligraphy for time inside a celestial timing wheel",
  },
  {
    index: "03",
    title: "Understand your relationships",
    label: "YOUR OVERLAP · 合",
    body: "Put two charts together and the structure becomes visible: where you reinforce each other, where you compete for the same role, and what each person brings that the other lacks.",
    image: "/ming/understand-relationships.png",
    alt: "Chinese calligraphy for harmony over two intersecting charts",
  },
  {
    index: "04",
    title: "Two minutes every morning",
    label: "YOUR DAILY NOTE · 辰",
    body: "One condition to notice. One theme moving underneath it. One practical choice. One private question. A short ritual grounded in the calendar rather than a prediction.",
    image: "/ming/morning-ritual.png",
    alt: "Chinese calligraphy for morning with four daily ritual symbols",
  },
];

function BrandStory() {
  return (
    <>
      <section className="manifesto" id="method">
        <p className="eyebrow">NOT A HOROSCOPE</p>
        <h2>An almanac tells you the conditions. You decide what to do with them.</h2>
        <p>
          Four Pillars, also called BaZi, turns the year, month, day and hour of your birth
          into eight Chinese characters. MING keeps the original calendar logic and makes
          its meaning legible in English.
        </p>
      </section>

      <section className="feature-list" aria-label="What MING helps you understand">
        {features.map((feature, index) => (
          <article className={`feature ${index % 2 ? "feature-reverse" : ""}`} key={feature.title}>
            <div className="feature-copy">
              <div className="feature-meta">
                <span>{feature.index}</span>
                <span>{feature.label}</span>
              </div>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
              {index === 2 ? <div className="feature-rule">NO SCORE · NO VERDICT · JUST THE PATTERN</div> : null}
            </div>
            <div className="feature-art">
              <Image src={feature.image} alt={feature.alt} fill sizes="(max-width: 760px) 100vw, 50vw" />
            </div>
          </article>
        ))}
      </section>
    </>
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
      (value): value is BirthDetails | null => value === null || isBirthDetails(value),
      null,
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

  useEffect(() => {
    if (!hydrated || editing || !details) return;
    const href = buildUrlStateHref(
      { pathname, search: searchParams.toString() },
      { d: details.date, t: details.time, tz: details.tz, lat: details.lat, lon: details.lon, place: details.place, day: target },
    );
    if (href !== `${pathname}${window.location.search}`) {
      router.replace(href as Parameters<typeof router.replace>[0], { scroll: false });
    }
  }, [hydrated, editing, details, target, pathname, searchParams, router]);

  const load = useCallback(async (birth: BirthDetails, targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...birth, target: targetDate, viewerTz: tz }),
      });
      const json = (await response.json()) as SignalResponse & { error?: string };
      if (!response.ok) {
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
  }, [tz]);

  useEffect(() => {
    if (details && !editing) void load(details, target);
  }, [details, editing, target, load]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!place || !date || !time) return;
    const next: BirthDetails = { date, time, place: place.place, tz: place.tz, lat: place.lat, lon: place.lon };
    writeStored(STORAGE_KEY, next);
    setDetails(next);
    setEditing(false);
    setShowCalc(false);
    window.setTimeout(() => document.querySelector("#reading")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const shiftDay = (delta: number) => {
    const [y, m, d] = target.split("-").map(Number);
    setTarget(new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10));
  };

  if (!hydrated) return <div className="min-h-screen bg-paper" />;

  return (
    <main id="top" className="ming-site">
      <Header />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span>PERSONAL ALMANAC</span><span>BAZi · 八字</span></p>
          <h1>Know your nature.<br /><em>Read your timing.</em></h1>
          <p className="hero-intro">
            Your Four Pillars, translated from the Chinese calendar into a daily practice.
            Precise enough to show its work. Human enough to use every morning.
          </p>
          <a href="#method" className="text-link">How MING reads time <ArrowDown size={15} /></a>
          <div className="hero-art" aria-hidden="true">
            <Image src="/ming/ming-logo.png" alt="" fill priority sizes="(max-width: 760px) 100vw, 50vw" />
          </div>
        </div>

        <div className="birth-panel" id="reading">
          {editing ? (
            <form onSubmit={submit}>
              <p className="panel-index">01 / ENTER YOUR BIRTH MOMENT</p>
              <h2>Meet your eight characters.</h2>
              <p className="panel-intro">The exact date, clock time, and city on your birth record.</p>
              <div className="birth-fields">
                <div>
                  <label htmlFor="ming-date" className="ming-label">Date of birth</label>
                  <input id="ming-date" className="ming-field" type="date" required min="1902-01-01" max="2099-12-31" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div>
                  <label htmlFor="ming-time" className="ming-label">Time of birth</label>
                  <input id="ming-time" className="ming-field" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
                </div>
                <div className="birth-place">
                  <label className="ming-label" htmlFor="ming-place-input">Place of birth</label>
                  <PlaceField value={place} onChange={setPlace} />
                </div>
              </div>
              <p className="field-note">MING converts the recorded clock time to local solar time.</p>
              <button type="submit" className="ming-button" disabled={!date || !time || !place}>
                Read today <ArrowRight size={17} />
              </button>
              {details ? <button type="button" className="ming-quiet panel-cancel" onClick={() => setEditing(false)}>Return to your reading</button> : null}
            </form>
          ) : (
            <section className="signal-panel" aria-live="polite">
              <div className="signal-date">
                <div><p className="panel-index">TODAY’S SIGNAL</p><p>{longDate(target, tz)}</p></div>
                <div className="date-controls">
                  <button type="button" aria-label="Previous day" onClick={() => shiftDay(-1)}><ChevronLeft size={17} /></button>
                  <button type="button" onClick={() => setTarget(localToday(tz))}>Today</button>
                  <button type="button" aria-label="Next day" onClick={() => shiftDay(1)}><ChevronRight size={17} /></button>
                </div>
              </div>
              {error ? <div className="signal-error">{error}</div> : null}
              {loading && !data ? <div className="signal-loading"><i /><i /><i /></div> : null}
              {data ? (
                <article className={loading ? "signal-content is-loading" : "signal-content"}>
                  <div className="signal-glyph" aria-hidden="true">{data.today.day.cn}</div>
                  <h2>{data.signal.observation}</h2>
                  <p className="signal-theme">{data.signal.theme}</p>
                  <div className="signal-line"><span>TRY</span><p>{data.signal.action}</p></div>
                  <div className="signal-line"><span>NOTICE</span><p>{data.signal.notice}</p></div>
                  <p className="chart-stamp">{data.natal.year.cn} · {data.natal.month.cn} · {data.natal.day.cn} · {data.natal.hour.cn}<br />{data.place} · {data.natal.day.stem.py} day master</p>
                  <div className="signal-actions">
                    <button type="button" className="ming-quiet" onClick={() => setShowCalc((value) => !value)}>{showCalc ? "Hide calculation" : "Show calculation"}</button>
                    <button type="button" className="ming-quiet" onClick={() => setEditing(true)}>Change birth details</button>
                  </div>
                  {showCalc ? <Calculation data={data} /> : null}
                </article>
              ) : null}
            </section>
          )}
        </div>
      </section>

      <BrandStory />

      <section className="closing">
        <Mark />
        <p className="eyebrow">MING · 命</p>
        <h2>Your conditions, daily.<br />Your choices, always.</h2>
        <a href="#reading" className="closing-action">Read your chart <ArrowRight size={17} /></a>
      </section>

      <footer className="site-footer">
        <span>MING — A PERSONAL ALMANAC</span>
        <p>Four Pillars in plain English. Conditions and choices, never prediction.</p>
        <span>BAZi · 八字</span>
      </footer>
    </main>
  );
}
