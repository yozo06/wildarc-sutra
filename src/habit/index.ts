// The daily habit: streaks that forgive one missed day, and a per-day tally.
import { addDays } from '../core/time.js';
import type { Day } from '../core/time.js';
import type { Rec } from '../core/fn.js';

export interface Streak {
  /** Length of the current run of days. */
  readonly n: number;
  readonly best: number;
  /** Last active day, or '' if never active. */
  readonly last: Day | '';
  /** Freezes in hand. A freeze bridges one missed day. */
  readonly fz: number;
  /** The day a freeze last rescued the streak, if any. */
  readonly saved?: Day;
}

export interface StreakRules {
  /** A freeze is earned every this many days in a row. */
  readonly freezeEvery: number;
  readonly maxFreezes: number;
}

export const NO_STREAK: Streak = { n: 0, best: 0, last: '', fz: 0 };
export const STREAK_RULES: StreakRules = { freezeEvery: 7, maxFreezes: 2 };

/** The streak after the learner was active on `today`. Being active twice in a day changes nothing. */
export const touch = (s: Streak, today: Day, rules: StreakRules = STREAK_RULES): Streak => {
  if (s.last === today) return s;
  const continued = s.last === addDays(today, -1);
  const rescued = !continued && s.last === addDays(today, -2) && s.fz > 0;
  const n = continued || rescued ? s.n + 1 : 1;
  const fz = (rescued ? s.fz - 1 : s.fz) + (n % rules.freezeEvery === 0 ? 1 : 0);
  const base = { n, best: Math.max(s.best, n), last: today, fz: Math.min(rules.maxFreezes, fz) };
  return rescued ? { ...base, saved: today } : s.saved === undefined ? base : { ...base, saved: s.saved };
};

/** The streak as it stands on `today`: 0 once it has lapsed. */
export const current = (s: Streak, today: Day): number => {
  if (s.last === today || s.last === addDays(today, -1)) return s.n;
  if (s.last === addDays(today, -2) && s.fz > 0) return s.n;
  return 0;
};

/** Add `amount` to a day's tally, keeping only the most recent `keep` days. */
export const tally = (days: Rec<number>, day: Day, amount: number, keep = 90): Rec<number> => {
  const added = { ...days, [day]: (days[day] ?? 0) + amount };
  const recent = Object.keys(added).sort().slice(-keep);
  return Object.fromEntries(recent.map((d) => [d, added[d] ?? 0]));
};
