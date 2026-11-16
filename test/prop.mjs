// A tiny property-test helper built on sutra's own seeded randomness:
// generate many inputs from seeds and check that a law holds for each.
import { rng } from '../dist/core/index.js';

/** A generator takes a seed and returns [value, next seed]. */
export const gInt = (lo, hi) => (s) => { const [k, s2] = rng.int(s, hi - lo + 1); return [lo + k, s2]; };
export const gBool = (s) => { const [k, s2] = rng.int(s, 2); return [k === 1, s2]; };
export const gList = (g, max = 8) => (s) => { let [n, s2] = rng.int(s, max + 1); const out = []; for (let i = 0; i < n; i++) { const [v, s3] = g(s2); out.push(v); s2 = s3; } return [out, s2]; };
export const gOneOf = (...xs) => (s) => rng.pick(s, xs);
export const gTuple = (...gs) => (s) => { const out = []; let cur = s; for (const g of gs) { const [v, s2] = g(cur); out.push(v); cur = s2; } return [out, cur]; };
const CHARS = [...'abcXYZ019 _-{}"\\/.,ಕನ್ನಡहिन्दीଓଡ଼ିଆ😀é€'];
export const gText = (max = 12) => (s) => { const [cs, s2] = gList(gOneOf(...CHARS), max)(s); return [cs.join(''), s2]; };
export const gRecord = (g, keys = ['a', 'b', 'c', 'd', 'e']) => (s) => { const out = {}; let cur = s; for (const k of keys) { const [inc, s2] = gBool(cur); cur = s2; if (inc) { const [v, s3] = g(cur); out[k] = v; cur = s3; } } return [out, cur]; };

/** Check `law` on `runs` generated values; on failure, report the seed so the case can be replayed. */
export const forAll = (gen, law, runs = 300) => {
  for (let i = 0; i < runs; i++) {
    const [value] = gen(i * 7919 + 1);
    let passed;
    try { passed = law(value) !== false; } catch (e) { throw new Error(`law threw for seed ${i * 7919 + 1}: ${JSON.stringify(value)}\n${e.stack}`); }
    if (!passed) throw new Error(`law failed for seed ${i * 7919 + 1}: ${JSON.stringify(value)}`);
  }
};
