// The only places time and chance enter an app. Everything downstream is pure.
import type { Clock } from '../core/time.js';
import type { Seed } from '../core/rng.js';

/** Read the device clock once. */
export const readClock = (): Clock => {
  const d = new Date();
  return { now: d.getTime(), offset: -d.getTimezoneOffset() };
};

/** A fresh seed for the core rng. */
export const freshSeed = (): Seed => {
  try {
    return crypto.getRandomValues(new Int32Array(1))[0] ?? 0;
  } catch {
    return (Math.random() * 0x7fffffff) | 0;
  }
};
