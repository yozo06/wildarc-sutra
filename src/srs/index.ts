// Spaced repetition on a Leitner ladder. A card climbs one box per right answer and
// waits longer each time; a miss sends it back to the bottom, due at once.
import { DAY } from '../core/time.js';
import type { Rec } from '../core/fn.js';

/** What we remember about one card. A tuple, so thousands fit in a small save. */
export type CardRecord = readonly [box: number, dueAt: number, reps: number, lapses: number];

/** Days to wait after reaching each box. Box 0 is due now. */
export const INTERVALS: readonly number[] = [0, 1, 2, 4, 8, 16];

export const NEW_CARD: CardRecord = [0, 0, 0, 0];

/** The record after one review at time `now`. */
export const review = (
  rec: CardRecord | undefined,
  right: boolean,
  now: number,
  intervals: readonly number[] = INTERVALS
): CardRecord => {
  const [box, , reps, lapses] = rec ?? NEW_CARD;
  if (!right) return [0, now, reps + 1, lapses + 1];
  const up = Math.min(intervals.length - 1, box + 1);
  return [up, now + (intervals[up] ?? 0) * DAY, reps + 1, lapses];
};

export const isDue = (rec: CardRecord | undefined, now: number): boolean => !!rec && rec[1] <= now;

export const boxOf = (cards: Rec<CardRecord>, id: string): number => cards[id]?.[0] ?? 0;

/** Ids of met cards that are due. `exists` drops cards the content no longer has. */
export const dueIds = (cards: Rec<CardRecord>, now: number, exists: (id: string) => boolean = () => true): readonly string[] =>
  Object.keys(cards).filter((id) => exists(id) && isDue(cards[id], now));

/** Ids of the cards missed most often, worst first. */
export const weakest = (cards: Rec<CardRecord>, n: number): readonly string[] =>
  Object.keys(cards)
    .filter((id) => (cards[id]?.[3] ?? 0) > 0)
    .sort((a, b) => (cards[b]?.[3] ?? 0) - (cards[a]?.[3] ?? 0))
    .slice(0, n);
