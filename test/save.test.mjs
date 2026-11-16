import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCode, decodeCode, utf8Encode, utf8Decode, toBase64Url, fromBase64Url, max, latest, prefer, each, record, struct, ours, withDefaults } from '../dist/save/index.js';
import { forAll, gInt, gList, gRecord, gText, gTuple } from './prop.mjs';

test('save codes survive a round trip, in any language', () => {
  forAll(gTuple(gText(20), gRecord(gInt(-5, 5000)), gList(gText(6), 4)), ([name, nums, list]) => {
    const value = { n: name, s: { nums, list } };
    assert.deepEqual(decodeCode('AB1', encodeCode('AB1', value)), { ok: true, value });
  });
  forAll(gText(40), (s) => {
    assert.equal(utf8Decode(utf8Encode(s)), s);
    assert.deepEqual(fromBase64Url(toBase64Url(utf8Encode(s))), utf8Encode(s));
    assert.ok(/^[A-Za-z0-9_-]*$/.test(toBase64Url(utf8Encode(s))));
  });
});

test('save codes match the ones Kannada Kali already hands out', () => {
  const code = 'KK1.eyJuIjoi4LKV8J-YgCIsInMiOnsidiI6MSwieHAiOjV9fQ';
  assert.equal(encodeCode('KK1', { n: 'ಕ😀', s: { v: 1, xp: 5 } }), code);
  assert.deepEqual(decodeCode('KK1', 'my code is\n ' + code.slice(0, 20) + ' \n' + code.slice(20) + '\n(sent from my phone)'), { ok: true, value: { n: 'ಕ😀', s: { v: 1, xp: 5 } } });
});

test('a bad code is an answer, not a crash', () => {
  assert.deepEqual(decodeCode('KK1', 'hello'), { ok: false, error: 'no-code' });
  assert.deepEqual(decodeCode('KK1', 'KK1.'), { ok: false, error: 'no-code' });
  assert.deepEqual(decodeCode('KK1', 'KK1.!!!!'), { ok: false, error: 'no-code' });
  assert.deepEqual(decodeCode('KK1', 'KK1.abcd'), { ok: false, error: 'unreadable' });
  assert.deepEqual(decodeCode('KK1', 'XX1.eyJ4IjoxfQ'), { ok: false, error: 'no-code' });
});

// A save shaped like a real one: xp, last day, card records, stars per stop, badges.
const mergeSave = struct({
  xp: max,
  last: latest,
  cards: record(prefer((r) => r[2])),
  st: record(each(max)),
  badges: record(ours()),
});
const gCard = gTuple(gInt(0, 5), gInt(0, 999), gInt(0, 30), gInt(0, 9));
const gSave = (s) => {
  const [[xp, day, cards, st, badges], s2] = gTuple(gInt(0, 9999), gInt(10, 28), gRecord(gCard), gRecord(gTuple(gInt(0, 3), gInt(0, 20))), gRecord(gInt(1, 1)))(s);
  return [{ xp, last: '2026-11-' + day, cards, st, badges }, s2];
};

test('merge laws: merging is safe to repeat and order does not matter', () => {
  forAll(gTuple(gSave, gSave, gSave), ([a, b, c]) => {
    assert.deepEqual(mergeSave(a, a), a, 'merging a save with itself changes nothing');
    assert.deepEqual(mergeSave(mergeSave(a, b), b), mergeSave(a, b), 'importing the same code twice changes nothing');
    assert.deepEqual(mergeSave(mergeSave(a, b), c), mergeSave(a, mergeSave(b, c)), 'grouping does not matter');
    const ab = mergeSave(a, b), ba = mergeSave(b, a);
    assert.equal(ab.xp, ba.xp); assert.equal(ab.last, ba.last); assert.deepEqual(ab.st, ba.st);
    assert.deepEqual(Object.keys(ab.cards).sort(), Object.keys(ba.cards).sort());
    assert.ok(ab.xp >= a.xp && ab.xp >= b.xp, 'nothing is lost');
    for (const k of Object.keys(a.cards)) assert.ok(ab.cards[k][2] >= a.cards[k][2]);
  });
});

test('merge pieces', () => {
  assert.equal(max(3, 9), 9); assert.equal(latest('2026-11-02', '2026-10-30'), '2026-11-02');
  assert.deepEqual(each(max)([1, 5], [3, 2]), [3, 5]);
  assert.deepEqual(record(max, (k) => k !== 'gone')({ a: 1, gone: 9 }, { a: 4, b: 2, gone: 9 }), { a: 4, b: 2 });
  assert.deepEqual(struct({ xp: max })({ xp: 1, name: 'mine' }, { xp: 5, name: 'theirs' }), { xp: 5, name: 'mine' });
});

test('withDefaults fills what an old save lacks and keeps what it has', () => {
  const defaults = { v: 1, xp: 0, set: { sound: 1, goal: 50 }, cards: {} };
  assert.deepEqual(withDefaults(defaults, { xp: 40, set: { goal: 20 }, extra: true }), { v: 1, xp: 40, set: { sound: 1, goal: 20 }, cards: {}, extra: true });
  assert.deepEqual(withDefaults(defaults, null), defaults);
  assert.deepEqual(withDefaults(defaults, { set: 'broken', cards: null }), { v: 1, xp: 0, set: { sound: 1, goal: 50 }, cards: {} });
});
