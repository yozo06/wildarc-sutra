import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, isDue, dueIds, boxOf, weakest, INTERVALS } from '../dist/srs/index.js';
import { touch, current, tally, NO_STREAK } from '../dist/habit/index.js';
import { DAY, addDays } from '../dist/core/index.js';
import { forAll, gBool, gInt, gList } from './prop.mjs';

const NOW = Date.UTC(2026, 10, 11, 12);

test('srs: right answers climb the ladder, a miss resets', () => {
  let r = review(undefined, true, NOW);
  assert.deepEqual(r, [1, NOW + INTERVALS[1] * DAY, 1, 0]);
  r = review(review(r, true, NOW), true, NOW);
  assert.equal(r[0], 3); assert.equal(r[1], NOW + 4 * DAY);
  const miss = review(r, false, NOW);
  assert.deepEqual(miss, [0, NOW, 4, 1]);
  assert.equal(r[0], 3, 'input not changed');
  for (let i = 0; i < 10; i++) r = review(r, true, NOW);
  assert.equal(r[0], INTERVALS.length - 1);
  assert.ok(isDue(miss, NOW)); assert.ok(!isDue(r, NOW)); assert.ok(!isDue(undefined, NOW));
  assert.deepEqual(dueIds({ a: miss, b: r, gone: miss }, NOW, (id) => id !== 'gone'), ['a']);
  assert.equal(boxOf({ a: miss, b: r }, 'b'), 5); assert.equal(boxOf({}, 'zz'), 0);
  assert.deepEqual(weakest({ a: [0, 0, 5, 2], b: [1, 0, 5, 4], c: [1, 0, 5, 0] }, 5), ['b', 'a']);
});

test('srs laws: box stays on the ladder, reps count every review, lapses count every miss', () => {
  forAll(gList(gBool, 40), (answers) => {
    const rec = answers.reduce((r, right, i) => review(r, right, NOW + i * DAY), undefined);
    if (!rec) return;
    assert.ok(rec[0] >= 0 && rec[0] < INTERVALS.length);
    assert.equal(rec[2], answers.length);
    assert.equal(rec[3], answers.filter((a) => !a).length);
    assert.ok(rec[1] >= NOW);
  });
});

test('streak: consecutive days, a gap, and a freeze', () => {
  let s = NO_STREAK; const d0 = '2026-11-11';
  for (let d = 0; d < 7; d++) s = touch(s, addDays(d0, d));
  assert.equal(s.n, 7); assert.equal(s.fz, 1, 'a week earns a freeze');
  assert.equal(current(s, addDays(d0, 8)), 7, 'the freeze keeps a one-day gap alive');
  s = touch(s, addDays(d0, 8));
  assert.equal(s.n, 8); assert.equal(s.fz, 0); assert.equal(s.saved, addDays(d0, 8));
  assert.equal(current(s, addDays(d0, 10)), 0, 'no freeze left');
  s = touch(s, addDays(d0, 11));
  assert.equal(s.n, 1); assert.equal(s.best, 8);
});

test('streak laws', () => {
  forAll(gList(gInt(0, 3), 60), (gaps) => {
    let s = NO_STREAK, day = '2026-01-01';
    for (const g of gaps) {
      day = addDays(day, g);
      const next = touch(s, day);
      assert.deepEqual(touch(next, day), next, 'a second visit the same day changes nothing');
      assert.ok(next.n >= 1 && next.n <= next.best && next.fz >= 0 && next.fz <= 2);
      assert.equal(next.last, day);
      assert.equal(current(next, day), next.n);
      if (g === 1) assert.equal(next.n, s.n + 1, 'the next day always extends the streak');
      s = next;
    }
  });
});

test('tally keeps a running total per day and forgets old days', () => {
  let t = {};
  for (let i = 0; i < 100; i++) t = tally(t, addDays('2026-01-01', i), 5);
  t = tally(t, addDays('2026-01-01', 99), 2);
  assert.equal(Object.keys(t).length, 90);
  assert.equal(t[addDays('2026-01-01', 99)], 7);
  assert.equal(t['2026-01-01'], undefined);
});
