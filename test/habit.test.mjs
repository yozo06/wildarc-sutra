import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touch, current, tally, NO_STREAK } from '../dist/habit/index.js';
import { addDays } from '../dist/core/index.js';
import { forAll, gInt, gList } from './prop.mjs';

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
