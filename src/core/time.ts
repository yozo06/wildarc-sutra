// Calendar days without reading the clock. The shell reads the clock once and
// passes it in; from there on a day is just a string and arithmetic is exact.

export const DAY = 86_400_000;

/** A calendar day in the learner's own time zone: 'YYYY-MM-DD'. Sorts correctly as text. */
export type Day = string;

/** One reading of the clock: the instant, and the device's offset from UTC in minutes (India is +330). */
export interface Clock {
  readonly now: number;
  readonly offset: number;
}

/** The learner's calendar day at that reading. */
export const dayOf = (c: Clock): Day => new Date(c.now + c.offset * 60_000).toISOString().slice(0, 10);

/** Days since 1970-01-01 for a 'YYYY-MM-DD' day. */
export const dayNumber = (d: Day): number => Math.round(Date.parse(d + 'T00:00:00Z') / DAY);

export const fromDayNumber = (n: number): Day => new Date(n * DAY).toISOString().slice(0, 10);

export const addDays = (d: Day, n: number): Day => fromDayNumber(dayNumber(d) + n);

/** Whole days from `a` to `b`; negative if `b` is earlier. */
export const daysBetween = (a: Day, b: Day): number => dayNumber(b) - dayNumber(a);
