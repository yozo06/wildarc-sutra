import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, isDue, dueIds, boxOf, weakest, INTERVALS } from '../dist/srs/index.js';
import { DAY } from '../dist/core/index.js';
import { forAll, gBool, gList } from './prop.mjs';

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
