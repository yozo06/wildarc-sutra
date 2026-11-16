import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pipe, hash, rng, dayOf, addDays, daysBetween, dayNumber, DAY, fold, sequence, embed, only, observe, just, ok, err, map, chain, collect, withDefault } from '../dist/core/index.js';
import { forAll, gInt, gList, gText } from './prop.mjs';

test('pipe applies left to right', () => {
  assert.equal(pipe(2, (x) => x + 1, (x) => x * 10, String), '30');
  assert.equal(pipe('x'), 'x');
});

test('hash is stable: these ids name audio files that already exist', () => {
  assert.equal(hash('ನಮಸ್ಕಾರ'), 'e0bbc62d');
  assert.equal(hash('ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ'), 'fa6d0626');
  assert.equal(hash('  ನಮಸ್ಕಾರ \n'), 'e0bbc62d', 'outer space is ignored');
  assert.equal(hash('a‌b'), hash('ab'), 'joiners are ignored');
});

test('rng: same seed, same sequence; values in range', () => {
  forAll(gInt(-1e9, 1e9), (seed) => {
    const [a, s1] = rng.next(seed), [b] = rng.next(seed);
    assert.equal(a, b);
    assert.ok(a >= 0 && a < 1);
    const [k] = rng.int(s1, 6);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 6);
  });
});

test('rng.shuffle returns a permutation and leaves its input alone', () => {
  forAll(gList(gInt(0, 99), 20), (xs) => {
    const before = xs.slice();
    const [ys] = rng.shuffle(xs.length + 5, xs);
    assert.deepEqual(xs, before);
    assert.deepEqual([...ys].sort((a, b) => a - b), [...xs].sort((a, b) => a - b));
  });
  const [a] = rng.shuffle(7, [1, 2, 3, 4, 5, 6, 7, 8]), [b] = rng.shuffle(7, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(a, b);
  assert.notDeepEqual(rng.shuffle(1, [1, 2, 3, 4, 5, 6, 7, 8])[0], rng.shuffle(2, [1, 2, 3, 4, 5, 6, 7, 8])[0]);
});

test('rng.seedFrom gives everyone the same seed for the same text', () => {
  assert.equal(rng.seedFrom('2026-11-16'), rng.seedFrom('2026-11-16'));
  assert.notEqual(rng.seedFrom('2026-11-16'), rng.seedFrom('2026-11-17'));
});

test('days follow the learner\'s own time zone', () => {
  const utc = Date.UTC(2026, 10, 15, 20, 0); // 20:00 UTC on the 15th
  assert.equal(dayOf({ now: utc, offset: 0 }), '2026-11-15');
  assert.equal(dayOf({ now: utc, offset: 330 }), '2026-11-16', 'already the 16th in India');
  assert.equal(dayOf({ now: utc, offset: -480 }), '2026-11-15');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29', 'leap year');
  assert.equal(daysBetween('2026-11-16', '2026-11-23'), 7);
  assert.equal(dayNumber('1970-01-02') * DAY, DAY);
});

test('day arithmetic laws', () => {
  forAll(gList(gInt(-400, 400), 2), ([a = 0, b = 0]) => {
    const d = addDays('2026-11-16', a);
    assert.equal(daysBetween(d, addDays(d, b)), b);
    assert.equal(addDays(addDays(d, b), -b), d);
  });
});

test('Result: map, chain, collect', () => {
  assert.deepEqual(map(ok(2), (x) => x + 1), ok(3));
  assert.deepEqual(map(err('no'), (x) => x + 1), err('no'));
  assert.deepEqual(chain(ok(2), (x) => (x > 1 ? ok('big') : err('small'))), ok('big'));
  assert.equal(withDefault(err('no'), 7), 7);
  assert.deepEqual(collect([ok(1), ok(2)]), ok([1, 2]));
  assert.deepEqual(collect([ok(1), err('a'), err('b')]), err(['a', 'b']));
});

// A counter that asks for a beep every time it reaches a multiple of 3.
const counter = (n, e) => { const m = e === 'inc' ? n + 1 : e === 'reset' ? 0 : n; return [m, m > 0 && m % 3 === 0 && m !== n ? [`beep ${m}`] : []]; };

test('fold replays events; state is a function of what happened', () => {
  assert.deepEqual(fold(counter, 0, ['inc', 'inc', 'inc', 'noop', 'inc', 'inc', 'inc']), [6, ['beep 3', 'beep 6']]);
  forAll(gList(gInt(0, 2), 30), (codes) => {
    const events = codes.map((c) => ['inc', 'reset', 'noop'][c]);
    const cut = Math.floor(events.length / 2);
    const [mid, fx1] = fold(counter, 0, events.slice(0, cut));
    const [end, fx2] = fold(counter, mid, events.slice(cut));
    assert.deepEqual(fold(counter, 0, events), [end, [...fx1, ...fx2]], 'folding in two halves equals folding once');
  });
});

test('sequence, embed, only and observe chain small updates into a bigger one', () => {
  const whole = { clicks: 0, log: [] };
  const clicks = embed((w) => w.clicks, (w, clicks) => ({ ...w, clicks }), counter);
  const logger = (w, e) => just({ ...w, log: [...w.log, e] });
  const app = observe(sequence(only((e) => (e === 'noop' ? undefined : e), clicks), logger), (before, _e, after) => (after.clicks < before.clicks ? ['was reset'] : []));
  const [state, effects] = fold(app, whole, ['inc', 'inc', 'inc', 'noop', 'reset']);
  assert.deepEqual(state, { clicks: 0, log: ['inc', 'inc', 'inc', 'noop', 'reset'] });
  assert.deepEqual(effects, ['beep 3', 'was reset']);
  assert.deepEqual(whole, { clicks: 0, log: [] }, 'the starting state is untouched');
});

test('hash accepts any text', () => { forAll(gText(30), (s) => /^[0-9a-f]{8}$/.test(hash(s))); });
