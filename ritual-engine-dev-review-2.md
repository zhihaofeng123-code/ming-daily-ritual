# MING daily ritual — second pass, on the "Review fixes" draft

Reviewer: Dev. Subject: draft `553e4e4c8a3a`, branch `draft/review-fixes`, preview
`ming-daily-ritual-review-fixes-553e4e4c.preview.kylon.app`. Follows
[the first review](/rooms/f8664cffbf96/file/6be64f06bf04).

Two questions asked: do the 60 new observation variants hold the register, and does the dated season read as
deliberate. I also re-ran the numbers, because the first pass found the author's own dispersion test could not detect
the defect it was meant to detect.

## Method

Source pulled from the draft checkout and the engine imported directly, the same way `app/api/signal/route.ts` calls
it. Measurements below are over **250 random births** (1940–2035, drawn from the app's own city table so time zone and
longitude are real) × **365 consecutive days each** — 91,250 generated signals — plus **1,990 random birth pairs**
compared day by day across a full year. Screenshots taken against the live preview.

## The four blockers: all genuinely fixed, verified independently

| Claim | Author | Measured | |
|---|---|---|---|
| 142 authored strings, all reachable | 142 | 142 (90 observation + 15 theme + 10 action + 27 reflection); every one selected at least once in 91,250 signals | ✓ |
| First observation repeat moves 10 days → 30 | 30 | exactly 30 for **every** one of 250 births — min, median and max all 30 | ✓ |
| 271 distinct four-line readings a year | 271 | 270 for chart A over 2026; population median 294, range 247–295 | ✓ |
| A and B share a closing question on 0 of 365 days | 0 | 0 — and A shares **no line at all** with B, C or D on any of 365 days | ✓ |
| Missing coordinates return 400, not Greenwich | — | confirmed in `app/api/signal/route.ts`: lat and lon are range-checked and never defaulted | ✓ |
| Day chart read in the birth zone | — | confirmed: `computePillars(zonedWallClockToMs(…, 12, 0, tz), tz, lon, false)` — (chart, date) is now a pure function | ✓ |
| Term warning at six hours; bars scale to chart peak | — | confirmed in `components/ming/calculation.tsx`; the copy and the gate now agree | ✓ |

The loop fix is real and it is the right shape: rotating on `dayCycleIndex + natal.dayCycleIndex mod 3` moves the
personal repeat to 30 days *and* de-synchronises two users, which a plain rotation would not have done.

## The same defect now lives in the two lines that were not touched

`Try` and `Notice` got no variants, and they are keyed on the day **branch** alone. Measured over a full year for
chart A:

- **10 distinct actions and 10 distinct reflection questions in 365 days.** Occurrence counts are identical for both
  slots: `[61, 60, 31, 31, 31, 31, 30, 30, 30, 30]`. Two of the ten fire **sixty times a year**.
- **First repeat: 6 days**, for every one of the 250 births — min, median and max all 6. (Twelve branches map onto ten
  Ten Gods, so two of them collide.)
- **The same closing question lands on two consecutive mornings, thirty times a year.** For chart A that is *"What are
  you working on whose value you could not explain out loud?"* on 8–9 January, 20–21 January, 1–2 February, 13–14
  February, 25–26 February, 9–10 March, and so on every twelfth day. Cause is precise and cheap to fix: the element
  fallback is keyed on the day branch's *element*, and the branch cycle contains four adjacent same-element pairs
  (寅卯 Wood, 巳午 Fire, 申酉 Metal, 亥子 Water). Adding the branch's yin/yang polarity to that key splits all four and
  removes every consecutive-day repeat.

This matters more than the observation loop did. The observation is the long abstract line people skim; `Try` and
`Notice` are the short concrete ones they are supposed to act on and remember. Repetition is most visible exactly
where it was left.

## Two charts can still be nearly the same person

Over 1,990 random pairs, across a full year:

- **8.7% of pairs read the identical `Try` line every single day of the year.** The action is a function of the day
  master stem and the day branch only, so any two users sharing a day master share the whole year's actions.
- 1.2% share the identical season line all year.
- Sharing all four lines is rare on average (0.3 days a year per pair) but not bounded: the worst pair I found —
  a 1989 Manaus birth and a 2033 Olmaliq birth — matched on observation 365/365, action 365/365, season 361/365 and
  reflection 243/365, giving **the same complete reading on 240 of 365 days**.

Chart-to-chart comparison is the invite loop. Two friends who happen to share a day master will compare screenshots
and find the same `Try` line every day, which reads as the app not really reading either of them. The variant rotation
has only three slots and only one bit of natal entropy (`natal.dayCycleIndex mod 3`); the load-state bands are three
buckets. Widening either one shrinks the collision class.

## Register of the 60 new variants

They hold. Same voice, no mystical drift, second person, the two-sentence pattern intact — assertion then a turn on it.
The best of the new lines are better than the originals: *"You can take it. That has never been the question."*
(`pressure.saturated`), *"Withdrawal is a tool, not an address."* (`refuge.saturated`), *"Options are only an asset once
one of them is closed."* (`opening.saturated`), *"You are better resourced today than you are behaving as though you
are."* (`support.present`), *"Correct is the easy part."* (`voice.present`).

Three things to fix.

**1. Nineteen of the sixty new lines talk about the chart instead of to the person.** *"This chart accumulates and
today adds to the pile."* *"Opportunity is thin in this chart."* *"Your chart is crowded with people who want what you
want."* *"There is little in your chart that props you up from the inside."* Variant 1 speaks to a reader; these speak
about a model. Because the slot rotates deterministically, a daily user meets that register on a fixed cadence and
will feel the seam. It also asks the primary audience — people who know little or no BaZi, per the brief — to accept a
claim about a model they cannot evaluate, in the one line that is supposed to be about them. The fix is structural
rather than editorial: model talk now has a proper home in the promoted "Why these four lines" panel. Keep two or three
of these lines, move the rest of that job into the panel.

**2. Two new lines break the framing rule the rest of the corpus keeps.**

- `craft.saturated` — *"You will not run short of ideas today. Running short of endings is the likelier problem."*
  This is the only `will` in 142 strings, and it is a forecast about the day. The old corpus had zero.
- `support.present` — *"Someone is willing to back you today at no particular cost to themselves."* A flat assertion
  about a third party's willingness, unhedged. This is the construction we removed from `rival.scarce` last round,
  re-entering through a new variant.

**3.** `opening.saturated` went from *"the dependable way to end up with none of it"* to *"the reliable way"*. That is
a synonym swap; the guaranteed-outcome claim is unchanged. Low priority, but it was not actually addressed.

## The dated season: yes, it reads deliberate

`SEASON · UNTIL 7 SEPTEMBER`, small caps, indented behind a rule, visually separated from the daily line. A reader now
has an answer to "why is this the same as yesterday" without opening anything. It also promotes the piece of MING that
the daily apps structurally do not have, which was the point.

Two nits:

- **No year.** A screenshot in December of a September season is undated. Add it, or use a relative form.
- **Showing only the end date understates the span.** Chart A on 2 September reads "until 7 September" — five days —
  so a first-time user meets the season at its narrowest and learns that it is a short thing. Show the span:
  `SEASON · 8 AUG – 7 SEP`. Same information, and it teaches the 30-day arc on first contact.

Also worth keeping: the calculation panel now states *"variant 1 of 3 today"* and explains the rotation. Disclosing
your own de-duplication mechanism to the user is unusual and it is the right instinct — it is the thing no competitor
in this category does.

## The number to give the founder

271 distinct four-line readings a year is true and I verified it. But the reading is built from **55 distinct sentences
a year** for one chart — 30 openings, 5 seasons, 10 actions, 10 questions — recombined. Both numbers are honest; only
one of them describes what a user experiences on day 200. Say the 55 first and the 271 second, otherwise this is the
same shape of claim as "76,500 combinations" and it will be corrected by a user before it is corrected internally.

## Priority

1. Add polarity to the reflection fallback key — kills the consecutive-day repeat, one line of code.
2. Give `Try` and `Notice` the variant treatment the observation got, or key them on more than the branch.
3. Fix the two framing regressions (`craft.saturated`, `support.present`).
4. Widen the variant rotation entropy so same-day-master pairs de-collide.
5. Move most of the chart-talk lines into the "Why these four lines" panel.
6. Season label: add the span and the year.

None of these is a blocker for the reader test. Items 1 and 3 are small enough to do before it; the rest can wait for
what the readers actually flag. The test itself is unchanged and is still the thing that matters: ten people, their own
charts, two weeks, record the day each one first says "I have seen this one." My prediction after these fixes is that
it comes from `Try` or `Notice` around day six, not from the opening line at day thirty.

## Evidence

- Measurement run: 250 births × 365 days plus 1,990 pair comparisons, engine imported from the draft checkout of
  `draft/review-fixes`; raw source archive at `/workspace/rooms/f8664cffbf96/review/ming-v2-src.zip`.
- First-pass review and the old-build capture:
  [ritual-engine-dev-review.md](/rooms/f8664cffbf96/file/6be64f06bf04) ·
  [ritual-engine-raw-outputs.md](/preview/workspaces/fc8a8e44157c/files/aaf4cfd252f6?room=f8664cffbf96)
- Audience evidence on repetition tolerance is unchanged from the first pass and cited there:
  [Co-Star reviews at WorldsApps](https://worldsapps.com/reviews-co-star-personalized-astrology) ·
  [The Pattern reviews at JustUseApp](https://justuseapp.com/en/app/1071085727/the-pattern/reviews) ·
  [Routines, The Pattern vs Co-Star](https://app.routines.club/blogs/cosmic/the-pattern-vs-co-star)
