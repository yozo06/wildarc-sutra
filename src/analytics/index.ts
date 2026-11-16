// Anonymous usage counts. The question this answers is "does this way of teaching
// keep people coming back, and where do they stop?", not "who did what".
//
// How it stays anonymous:
//   - There is no user id, device id or cookie. Nothing identifies a learner.
//   - The phone works out facts such as "came back a week later" from a small
//     record it keeps locally (the Meter) and sends only the name of that fact.
//   - A hit is a short name like "lets/hi/back/d7". That is all that leaves the phone.
//
// It is a pure state machine: signals in, a new Meter and "send these" out.
// The shell does the sending and reports back with a 'sent' or 'failed' signal.
import { daysBetween } from '../core/time.js';
import type { Day } from '../core/time.js';
import type { Step, Update } from '../core/program.js';

export * from './goatcounter.js';

/** One anonymous count. `name` is the whole message. */
export interface Hit {
  readonly name: string;
}

/** What the phone remembers in order to count without identifying anyone. Never sent. */
export interface Meter {
  /** False once the learner turns counting off. */
  readonly on: boolean;
  /** Day of the first open, '' before it. */
  readonly first: Day | '';
  /** Most recent active day. */
  readonly last: Day | '';
  /** Number of distinct days the app was opened. */
  readonly days: number;
  /** Names already counted that must only ever be counted once. */
  readonly once: readonly string[];
  /** Hits waiting for a connection. */
  readonly queue: readonly Hit[];
  /** How many hits from the front of the queue are being sent right now. */
  readonly sending: number;
}

export const NEW_METER: Meter = { on: true, first: '', last: '', days: 0, once: [], queue: [], sending: 0 };

/** Things the app tells the meter. Every signal carries the learner's calendar day. */
export type Signal =
  | { readonly t: 'open'; readonly day: Day }
  /** A unit of learning (an episode, a ride, a lesson) began. */
  | { readonly t: 'start'; readonly day: Day; readonly unit: string }
  | { readonly t: 'done'; readonly day: Day; readonly unit: string }
  /** The learner left a unit unfinished at step `at`. */
  | { readonly t: 'quit'; readonly day: Day; readonly unit: string; readonly at: number }
  /** Anything else worth counting. `once` counts it a single time per phone. */
  | { readonly t: 'count'; readonly day: Day; readonly name: string; readonly once?: boolean }
  /** The shell sent the first `n` queued hits. */
  | { readonly t: 'sent'; readonly n: number }
  | { readonly t: 'failed' }
  /** The learner switched counting on or off. */
  | { readonly t: 'opt'; readonly on: boolean };

export type Effect = { readonly t: 'send'; readonly hits: readonly Hit[] };

export interface Tags {
  /** Which app, e.g. 'lets' or 'kali'. */
  readonly app: string;
  /** Teaching language, e.g. 'hi'. Lets you compare languages. */
  readonly lang?: string;
}

export interface Rules {
  /** "Came back on or after day N" is counted once for each of these. */
  readonly milestones: readonly number[];
  /** Most hits kept while offline; the oldest are dropped beyond this. */
  readonly maxQueue: number;
}

export const RULES: Rules = { milestones: [1, 3, 7, 14, 30], maxQueue: 200 };

const safe = (s: string): string => s.replace(/[^A-Za-z0-9_.-]+/g, '-');

/** The names a signal turns into, before tagging. Pure; exported for tests and dashboards. */
export const namesFor = (m: Meter, s: Signal, rules: Rules = RULES): readonly { name: string; once: boolean }[] => {
  switch (s.t) {
    case 'open': {
      if (m.last === s.day) return [];
      const since = m.first === '' ? 0 : daysBetween(m.first, s.day);
      return [
        ...(m.first === '' ? [{ name: 'new', once: true }] : []),
        { name: 'day', once: false },
        ...rules.milestones.filter((d) => since >= d).map((d) => ({ name: `back/d${d}`, once: true })),
      ];
    }
    case 'start':
      return [{ name: `unit/${safe(s.unit)}/start`, once: true }];
    case 'done':
      return [{ name: `unit/${safe(s.unit)}/done`, once: true }];
    case 'quit':
      return [{ name: `unit/${safe(s.unit)}/quit/${Math.max(0, Math.floor(s.at))}`, once: true }];
    case 'count':
      return [{ name: s.name.split('/').map(safe).join('/'), once: !!s.once }];
    default:
      return [];
  }
};

const sendNext = (m: Meter): Step<Meter, Effect> =>
  m.sending === 0 && m.queue.length > 0 ? [{ ...m, sending: m.queue.length }, [{ t: 'send', hits: m.queue }]] : [m, []];

/** The meter's step function for one app and language. */
export const meter = (tags: Tags, rules: Rules = RULES): Update<Meter, Signal, Effect> => (m, s) => {
  if (s.t === 'opt') return [s.on ? { ...m, on: true } : { ...m, on: false, queue: [], sending: 0 }, []];
  if (s.t === 'sent') return sendNext({ ...m, queue: m.queue.slice(Math.min(s.n, m.sending)), sending: 0 });
  if (s.t === 'failed') return [{ ...m, sending: 0 }, []];
  if (!m.on) return [m, []];

  const prefix = [tags.app, tags.lang].filter((x): x is string => !!x).map(safe).join('/');
  const fresh = namesFor(m, s, rules).filter((n) => !(n.once && m.once.includes(n.name)));
  const opened = s.t === 'open' && m.last !== s.day;
  const queue = [...m.queue, ...fresh.map((n) => ({ name: `${prefix}/${n.name}` }))];
  const overflow = Math.max(0, queue.length - rules.maxQueue);
  const next: Meter = {
    ...m,
    first: opened && m.first === '' ? s.day : m.first,
    last: opened ? s.day : m.last,
    days: opened ? m.days + 1 : m.days,
    once: [...m.once, ...fresh.filter((n) => n.once).map((n) => n.name)],
    // Never drop hits that are mid-flight: only trim behind them.
    queue: overflow > 0 ? [...queue.slice(0, m.sending), ...queue.slice(m.sending + overflow)] : queue,
  };
  return sendNext(next);
};
