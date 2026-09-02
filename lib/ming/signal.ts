/**
 * MING daily signal.
 *
 * The four lines are SELECTED by deterministic chart arithmetic and WRITTEN by hand.
 * No language is generated at runtime: every sentence below is authored copy, chosen
 * by an index derived from the natal chart and the target day's pillars.
 *
 *   observation <- Ten God of the target day's stem against the natal day master,
 *                  crossed with how loaded that element already is in the natal chart
 *   theme       <- direction of the target month's branch element against the day master,
 *                  crossed with the day master's strength band
 *   action      <- Ten God of the primary hidden stem of the target day's branch
 *   notice      <- strongest branch relation (clash / harmony / repeat) between the
 *                  target day's branch and the natal branches, tagged by which pillar
 *
 * Framing rule for every line: conditions and choices, never prediction.
 */
import {
  STEMS,
  TEN_GOD_META,
  tenGod,
  phaseDirection,
  elementLoad,
  loadState,
  dayMasterStrength,
  branchRelation,
  type Chart,
  type TenGod,
  type ElementName,
  type PhaseDirection,
  type StrengthBand,
  type LoadState,
  type BranchRelation,
  type ElementShare,
  type Strength,
  type Stem,
  type Branch,
} from "./bazi";

const OBSERVATION: Record<`${TenGod}.${LoadState}`, string> = {
  'friend.scarce': 'Something today asks you to stand on your own, and that is not your usual default. Independence can feel like exposure before it feels like strength.',
  'friend.present': 'You are more sure of your own position today than you may be letting on. The open question is whether you say it plainly or wait to be agreed with first.',
  'friend.saturated': 'You already know what you think, and today hands you more of the same conviction. Certainty this smooth is worth testing against one person who does not share it.',
  'rival.scarce': 'Someone may want the same thing you want today, and you are not especially practiced at that. Wanting it out loud is not the same as taking it from anyone.',
  'rival.present': 'There is a pull today between holding your share and handing it over. Generosity you resent afterwards was not generosity.',
  'rival.saturated': 'You may catch yourself measuring — output, pace, who got there first. The comparison is real, and it is still not information about your work.',
  'craft.scarce': 'You may want to make something today without being able to say why. Appetite is data, even before it points anywhere useful.',
  'craft.present': 'Output comes more easily today than it usually does. Easy is not the same as unimportant: finish something small rather than opening something large.',
  'craft.saturated': 'There is more you could produce today than you can actually finish. Enjoying the work is not the same as moving it.',
  'voice.scarce': 'Something you normally leave unsaid may get close to the surface today. Sharpness that surprises you is worth examining before it is worth using.',
  'voice.present': 'You can see clearly what is wrong with something today. Being accurate and choosing the moment are two separate decisions.',
  'voice.saturated': 'Your read on the flaw is probably right and probably early. The cost of being right early is that nobody stays for the second half.',
  'opening.scarce': 'An opening may show up today that does not match how you normally get things. Unfamiliar is not the same as unsuitable.',
  'opening.present': 'There is movement available today if you go toward it. Not every open door is worth walking through, and not choosing is also a choice.',
  'opening.saturated': 'There is more on offer today than you can hold. Reaching for all of it is the dependable way to end up with none of it.',
  'holding.scarce': 'Today rewards upkeep over momentum, which is probably not where your attention wants to go. Ten minutes now removes a much larger cost later.',
  'holding.present': 'The steady version of what you are building is available today. It is less interesting than the ambitious version and considerably more likely to survive.',
  'holding.saturated': 'You may be holding more than needs holding. Worth asking which of it you maintain out of value and which out of habit.',
  'pressure.scarce': 'Something may push at you today without following any rule you recognise. Pressure with no format is still pressure — name it before you answer it.',
  'pressure.present': 'There is real demand on you today. You can meet it, redirect it, or delay it, and picking one beats defaulting into the first.',
  'pressure.saturated': 'Urgency is loud today and you are practiced at absorbing it. Absorbing is also what teaches the next demand to arrive sooner.',
  'structure.scarce': 'A rule or an expectation is more visible today than you are used to. Structure you did not ask for can still be worth reading before you push back on it.',
  'structure.present': 'What is expected of you is unusually clear today. Clarity about what is expected is also clarity about what is not.',
  'structure.saturated': 'You are carrying a lot of should today. Some of it is genuine obligation and some of it is inherited, and they do not deserve equal weight.',
  'refuge.scarce': 'Support may arrive today on terms you did not expect. Help that does not look like help is easy to turn down by reflex.',
  'refuge.present': 'There is room to step back and think today. Thinking turns into avoidance at a point you can usually feel arriving.',
  'refuge.saturated': 'You have no shortage of reasons to stay inside your own head today. Interior work has sharply diminishing returns after the second lap.',
  'support.scarce': 'You may need backing today more than you want to admit. Asking early costs much less than asking once it is urgent.',
  'support.present': 'There is dependable support around you today. Using it does not draw down anyone\u2019s account.',
  'support.saturated': 'Comfort is easy to reach today. The comfort you do not actually need is the expensive kind.',
};

const THEME: Record<`${PhaseDirection}.${StrengthBand}`, string> = {
  'peer.weak': 'The stretch you are in is on your side even when you do not feel resourced. Leaning on what is already around you counts as strength.',
  'peer.balanced': 'You and this stretch want broadly the same things. That agreement is exactly what makes overcommitting easy.',
  'peer.strong': 'This period amplifies what you already are. More of yourself is not automatically the answer.',
  'resource.weak': 'This period feeds you. Taking the support is the work right now, not a break from it.',
  'resource.balanced': 'More is coming in than going out at the moment. Good conditions for learning something you cannot use yet.',
  'resource.strong': 'You are well supplied and the conditions keep supplying. At some point receiving becomes a way of not deciding.',
  'output.weak': 'This period pulls output out of you and there is less to give than usual. Choosing what not to make is the real decision.',
  'output.balanced': 'The conditions want something made. Pick one and let the rest stay unmade.',
  'output.strong': 'You have the capacity and the period wants it spent. Spending it on the wrong thing is the risk, not running out.',
  'wealth.weak': 'There is something workable here and less energy to work it with than you would like. Smaller scope, same direction.',
  'wealth.balanced': 'Conditions are workable. Effort converts into result at roughly a fair rate right now.',
  'wealth.strong': 'You can take on more than this period strictly requires. Whether you should is a separate question.',
  'authority.weak': 'The period presses and you are not at full strength. Reducing what you owe beats trying to meet all of it.',
  'authority.balanced': 'There is genuine demand right now and you can meet a decent share of it. Deciding the share is your job, not the demand\u2019s.',
  'authority.strong': 'You can carry what this period is asking. Being able to carry it is how people end up carrying what was never theirs.',
};

const ACTION: Record<TenGod, string> = {
  friend: 'State your actual position once, without softening it into a question.',
  rival: 'Name one thing you want that someone else also wants. Only name it.',
  craft: 'Finish one small thing you already started. Do not open a new one.',
  voice: 'Write the criticism down in full and do not send it today.',
  opening: 'Say yes to the smallest of the options in front of you and decline the largest.',
  holding: 'Do the ten-minute upkeep you keep moving to tomorrow.',
  pressure: 'Answer one demand with a specific time rather than a specific outcome.',
  structure: 'Take one obligation and check whether anyone still actually expects it.',
  refuge: 'Take twenty minutes with no input at all \u2014 no feed, no music, no talking.',
  support: 'Ask one person for something small and specific.',
};

const NOTICE: Record<string, string> = {
  'clash.day': 'What are you defending that nobody has actually attacked?',
  'clash.month': 'Whose expectations are you working against today, and did they ever state them out loud?',
  'clash.hour': 'What are you hurrying toward that would survive being a week later?',
  'clash.year': 'Which old rule of yours is this friction really about?',
  'harmony.day': 'What gets easier the moment you stop treating this as a problem to solve?',
  'harmony.month': 'Who is easy to work with right now, and have you ever told them so?',
  'harmony.hour': 'What would you do next if this went well \u2014 and are you ready for that?',
  'harmony.year': 'What are you agreeing to because it is comfortable rather than because it is right?',
  'same.day': 'Where are you repeating yourself and calling it consistency?',
  'same.month': 'What has shown up more than once this month that you keep filing as coincidence?',
  'same.hour': 'What do you do at the same time every day without ever deciding to?',
  'same.year': 'What have you believed about yourself for so long that you stopped checking?',
  'none.Wood': 'What are you growing that you have not looked at closely in a while?',
  'none.Fire': 'What are you visible for at the moment, and did you choose it?',
  'none.Earth': 'What are you holding steady for someone else, and who is holding it for you?',
  'none.Metal': 'What would you cut if the decision cost you nothing?',
  'none.Water': 'What are you waiting to be certain about, and what would "certain enough" look like?',
};

const PILLAR_ORDER = ["day", "month", "hour", "year"] as const;
type PillarKey = (typeof PILLAR_ORDER)[number];
const RELATION_RANK: Record<BranchRelation, number> = { clash: 3, harmony: 2, same: 1, none: 0 };

export type Signal = {
  observation: string;
  theme: string;
  action: string;
  notice: string;
  keys: { observation: string; theme: string; action: string; notice: string };
  reasoning: {
    dayMaster: Stem;
    dayStemGod: {
      key: TenGod;
      cn: string;
      classic: string;
      plain: string;
      element: ElementName;
      natalShare: number;
      state: LoadState;
    };
    season: { branch: Branch; direction: PhaseDirection };
    strength: Strength;
    branchGod: { key: TenGod; cn: string; classic: string; plain: string; stem: Stem };
    relation: { relation: BranchRelation; pillar: PillarKey | null };
    elementShare: ElementShare;
  };
};

/**
 * @param natal chart for the birth moment
 * @param today chart for the target day
 */
export function buildSignal(natal: Chart, today: Chart): Signal {
  const dm = natal.dayMasterIdx;
  const { share } = elementLoad(natal);
  const strength = dayMasterStrength(natal);

  // 1. observation — what today's stem is doing to this particular chart
  const dayStemGod = tenGod(dm, today.day.stemIdx);
  const dayStemElement = STEMS[today.day.stemIdx].element;
  const state = loadState(share[dayStemElement]);
  const observation = OBSERVATION[`${dayStemGod}.${state}`];

  // 2. theme — the stretch the chart is in, from the season against the day master
  const seasonDir = phaseDirection(STEMS[dm].element, today.month.branch.element);
  const theme = THEME[`${seasonDir}.${strength.band}`];

  // 3. action — from the primary hidden stem of today's branch
  const branchPrimary = today.day.branch.hidden[0];
  const branchGod = tenGod(dm, branchPrimary);
  const action = ACTION[branchGod];

  // 4. notice — strongest branch relation with the natal chart
  let best: { relation: BranchRelation; pillar: PillarKey | null; rank: number } = {
    relation: "none",
    pillar: null,
    rank: 0,
  };
  for (const key of PILLAR_ORDER) {
    const rel = branchRelation(today.day.branchIdx, natal[key].branchIdx);
    const rank = RELATION_RANK[rel];
    if (rank > best.rank) best = { relation: rel, pillar: key, rank };
  }
  const noticeKey =
    best.rank > 0 && best.pillar
      ? `${best.relation}.${best.pillar}`
      : `none.${today.day.branch.element}`;
  const notice = NOTICE[noticeKey];

  return {
    observation,
    theme,
    action,
    notice,
    keys: {
      observation: `${dayStemGod}.${state}`,
      theme: `${seasonDir}.${strength.band}`,
      action: branchGod,
      notice: noticeKey,
    },
    reasoning: {
      dayMaster: STEMS[dm],
      dayStemGod: {
        key: dayStemGod,
        ...TEN_GOD_META[dayStemGod],
        element: dayStemElement,
        natalShare: share[dayStemElement],
        state,
      },
      season: { branch: today.month.branch, direction: seasonDir },
      strength,
      branchGod: { key: branchGod, ...TEN_GOD_META[branchGod], stem: STEMS[branchPrimary] },
      relation: { relation: best.relation, pillar: best.pillar },
      elementShare: share,
    },
  };
}

export const COPY_COUNTS = {
  observation: Object.keys(OBSERVATION).length,
  theme: Object.keys(THEME).length,
  action: Object.keys(ACTION).length,
  notice: Object.keys(NOTICE).length,
};
