"use client";

import type { ElementName, SignalResponse, SlimChart, SlimPillar } from "@/lib/ming/client-types";

const ELEMENTS: ElementName[] = ["Wood", "Fire", "Earth", "Metal", "Water"];

const fmtInstant = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const signed = (n: number) => `${n >= 0 ? "+" : "\u2212"}${Math.abs(n).toFixed(1)}`;

function PillarColumn({ label, pillar }: { label: string; pillar: SlimPillar }) {
  return (
    <div className="flex flex-col items-center gap-1 border-r border-rule px-2 py-3 last:border-r-0">
      <span className="ming-label">{label}</span>
      <span className="font-display text-2xl leading-none text-ink">{pillar.stem.cn}</span>
      <span className="font-display text-2xl leading-none text-ink">{pillar.branch.cn}</span>
      <span className="mt-1 text-center text-[11px] leading-tight text-ink-faint">
        {pillar.stem.py} {pillar.branch.py}
        <br />
        {pillar.stem.element} / {pillar.branch.element}
      </span>
    </div>
  );
}

function Chart({ title, chart }: { title: string; chart: SlimChart }) {
  return (
    <div>
      <p className="ming-label mb-2">{title}</p>
      <div className="grid grid-cols-4 rounded-[2px] border border-rule bg-paper-raised">
        <PillarColumn label="Year" pillar={chart.year} />
        <PillarColumn label="Month" pillar={chart.month} />
        <PillarColumn label="Day" pillar={chart.day} />
        <PillarColumn label="Hour" pillar={chart.hour} />
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-rule py-2 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="ming-label shrink-0 sm:w-52 sm:pt-0.5">{term}</dt>
      <dd className="text-sm leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}

export function Calculation({ data }: { data: SignalResponse }) {
  const { natal, today, worked, signal, reading } = data;
  const m = natal.meta;
  const r = signal.reasoning;
  const tz = worked.birthZone;

  return (
    <div className="mt-8 border-t border-rule-strong pt-8">
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-ink-soft">
        Everything above the line is chosen by the arithmetic below. The pillars, the
        relationships between them, and the selection keys are computed. The sentences
        themselves are written by hand and picked by those keys — MING does not generate
        language at runtime.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <Chart title="Your chart" chart={natal} />
        <Chart title={`Day chart \u2014 ${worked.targetDate}`} chart={today} />
      </div>

      <div className="mt-8">
        <p className="ming-label mb-2">How the chart was derived</p>
        <dl>
          <Row term="Birth moment">
            {m.civil.year}-{String(m.civil.month).padStart(2, "0")}-
            {String(m.civil.day).padStart(2, "0")} {String(m.civil.hour).padStart(2, "0")}:
            {String(m.civil.minute).padStart(2, "0")} local clock in {tz}, which the IANA
            time-zone database resolves to UTC{signed(m.zoneOffsetMinutes / 60)} that day
            {" "}({new Date(worked.birthInstantUTC).toISOString().replace(".000Z", "Z")}).
          </Row>
          <Row term="True solar time">
            {m.usedTrueSolarTime ? (
              <>
                Longitude {worked.birthLongitude.toFixed(2)}° gives {signed(m.longitudeMinutes)} min
                against Greenwich, the zone offset removes {signed(-m.zoneOffsetMinutes)} min, and
                the equation of time adds {signed(m.equationOfTimeMinutes)} min. Net{" "}
                {signed(m.solarCorrectionMinutes)} min, so the hour and day pillars are read at{" "}
                {String(m.effective.hour).padStart(2, "0")}:
                {String(m.effective.minute).padStart(2, "0")} sun time.
              </>
            ) : (
              <>Not applied — pillars read from the civil clock.</>
            )}
          </Row>
          <Row term="Year pillar">
            The BaZi year turns at Lichun, not 1 January. Lichun for year{" "}
            {m.baziYear} fell at {fmtInstant(worked.lichunForBaziYear, tz)} local, so this birth
            sits in the {m.baziYear} year: {natal.year.cn} ({natal.year.stem.py}{" "}
            {natal.year.branch.py}), from ({m.baziYear} − 1984) mod 60 with 1984 as a jiazi year.
          </Row>
          <Row term="Month pillar">
            Sun at {m.solarLongitude.toFixed(3)}° apparent ecliptic longitude, which is{" "}
            {(((m.solarLongitude - 315 + 360) % 360)).toFixed(3)}° past Lichun — month{" "}
            {m.monthIdx + 1} of twelve, branch {natal.month.branch.cn} (
            {natal.month.branch.py}). The Five Tigers rule takes the year stem{" "}
            {natal.year.stem.cn} to a {natal.month.stem.cn} stem for that month.
          </Row>
          <Row term="Day pillar">
            Continuous sexagenary count on the effective date {m.effective.year}-
            {String(m.effective.month).padStart(2, "0")}-
            {String(m.effective.day).padStart(2, "0")}: {natal.day.cn} ({natal.day.stem.py}{" "}
            {natal.day.branch.py}). The day stem {natal.day.stem.cn} is the day master —
            the character the whole reading is measured against.
          </Row>
          <Row term="Hour pillar">
            {String(m.effective.hour).padStart(2, "0")}:
            {String(m.effective.minute).padStart(2, "0")} falls in the{" "}
            {natal.hour.branch.cn} double-hour. The Five Rats rule takes the day stem{" "}
            {natal.day.stem.cn} to a {natal.hour.stem.cn} stem: {natal.hour.cn}.
          </Row>
        </dl>
      </div>

      <div className="mt-8">
        <p className="ming-label mb-2">Element balance in your chart</p>
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">
          Eight visible characters plus the stems hidden inside each branch, weighted
          0.6 / 0.3 / 0.15 by qi layer. That weighting is MING&rsquo;s own scoring, not a
          classical rule — the classical tables record the order of hidden stems but not
          numeric weights.
        </p>
        <div className="space-y-1.5">
          {ELEMENTS.map((e) => {
            const share = reading.elementShare[e];
            return (
              <div key={e} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-ink-soft">{e}</span>
                <div className="h-2 flex-1 bg-rule/60">
                  <div
                    className="h-full bg-ink"
                    style={{ width: `${Math.min(100, share * 260).toFixed(1)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-faint">
                  {(share * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Support versus drain on the day master scores {reading.strength.support.toFixed(2)} to{" "}
          {reading.strength.drain.toFixed(2)} — a ratio of{" "}
          {(reading.strength.ratio * 100).toFixed(0)}%, which MING reads as a{" "}
          <strong className="font-semibold text-ink">{reading.strength.band}</strong> day
          master. Those bands are MING&rsquo;s own too.
        </p>
      </div>

      <div className="mt-8">
        <p className="ming-label mb-2">Why these four lines and not others</p>
        <dl>
          <Row term="Observation">
            Today&rsquo;s day stem {today.day.stem.cn} against your day master{" "}
            {r.dayMaster.cn} is {r.dayStemGod.classic} ({r.dayStemGod.cn}) — {r.dayStemGod.plain}.
            Your chart is {r.dayStemGod.state} in {r.dayStemGod.element} (
            {(r.dayStemGod.natalShare * 100).toFixed(0)}%). Key{" "}
            <code className="text-ink">{signal.keys.observation}</code>.
          </Row>
          <Row term="Current theme">
            The season branch {r.season.branch.cn} is {r.season.branch.element}, which stands in
            the <em>{r.season.direction}</em> direction to your {r.dayMaster.element} day master,
            read against a {r.strength.band} day master. Key{" "}
            <code className="text-ink">{signal.keys.theme}</code>. This line tracks the stretch
            you are in, so it holds for the season rather than changing daily.
          </Row>
          <Row term="Action">
            The primary hidden stem of today&rsquo;s branch {today.day.branch.cn} is{" "}
            {r.branchGod.stem.cn}, which reads as {r.branchGod.classic} ({r.branchGod.cn}) from
            your day master. Key <code className="text-ink">{signal.keys.action}</code>.
          </Row>
          <Row term="Reflection">
            {r.relation.pillar ? (
              <>
                Today&rsquo;s branch {today.day.branch.cn} forms a{" "}
                <strong className="font-semibold text-ink">{r.relation.relation}</strong> with your{" "}
                {r.relation.pillar} branch.
              </>
            ) : (
              <>
                Today&rsquo;s branch {today.day.branch.cn} forms no clash, harmony or repeat with
                your chart, so the question comes from its element ({today.day.branch.element}).
              </>
            )}{" "}
            Key <code className="text-ink">{signal.keys.notice}</code>.
          </Row>
        </dl>
      </div>

      {m.lateZi || m.minutesToHourBoundary <= 15 || m.degreesToTermBoundary < 0.05 ? (
        <div className="mt-8 border-l-2 border-seal bg-seal-wash px-4 py-3">
          <p className="ming-label mb-1" style={{ color: "var(--ming-seal)" }}>
            Worth knowing about your birth time
          </p>
          <ul className="space-y-1 text-sm leading-relaxed text-ink-soft">
            {m.lateZi ? (
              <li>
                Your birth falls between 23:00 and 23:59 in sun time. Schools disagree about
                whether that hour belongs to the current day or the next one. MING keeps it on the
                current day and applies the hour rule to that day&rsquo;s stem; a calculator using
                the other convention will give you a different day and hour pillar.
              </li>
            ) : null}
            {m.minutesToHourBoundary <= 15 ? (
              <li>
                You are within {Math.round(m.minutesToHourBoundary)} minutes of a double-hour
                boundary. Birth records round minutes, so the hour pillar here is less certain
                than the rest of the chart.
              </li>
            ) : null}
            {m.degreesToTermBoundary < 0.05 ? (
              <li>
                Your birth is within a few hours of a solar-term boundary, which is what sets the
                month branch. Small errors in the recorded time matter more than usual.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        Solar positions come from the full VSOP87 series; solar-term instants agree with the
        Hong Kong Observatory published times to within a minute. Year, month and day pillars were
        checked against a second independent implementation across 4,000 charts from 1940 to 2035
        with no disagreement outside the 23:00 convention noted above.
      </p>
    </div>
  );
}
