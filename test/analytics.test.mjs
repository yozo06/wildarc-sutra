import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meter, NEW_METER, namesFor, goatcounterUrl, goatcounterEndpoint, RULES } from '../dist/analytics/index.js';
import { fold, addDays } from '../dist/core/index.js';
import { forAll, gInt, gList, gOneOf, gTuple } from './prop.mjs';

const lets = meter({ app: 'lets', lang: 'hi' });
const D0 = '2026-11-16';
const names = (effects) => effects.flatMap((f) => f.hits.map((h) => h.name));
/** Run signals with a perfect connection: every send is confirmed at once. */
const online = (update, start, signals) => signals.reduce(([m, out], s) => {
  let [m2, fx] = update(m, s); const sent = [...out];
  while (fx.length) { const hits = fx.flatMap((f) => f.hits); sent.push(...hits.map((h) => h.name)); [m2, fx] = update(m2, { t: 'sent', n: hits.length }); }
  return [m2, sent];
}, [start, []]);

test('first open counts a new learner and an active day, once', () => {
  const [m, sent] = online(lets, NEW_METER, [{ t: 'open', day: D0 }, { t: 'open', day: D0 }, { t: 'open', day: D0 }]);
  assert.deepEqual(sent, ['lets/hi/new', 'lets/hi/day']);
  assert.deepEqual([m.first, m.last, m.days, m.queue.length], [D0, D0, 1, 0]);
});

test('coming back: each milestone is counted once, on or after its day', () => {
  const [m, sent] = online(lets, NEW_METER, [
    { t: 'open', day: D0 }, { t: 'open', day: addDays(D0, 1) }, { t: 'open', day: addDays(D0, 2) },
    { t: 'open', day: addDays(D0, 9) }, { t: 'open', day: addDays(D0, 10) }, { t: 'open', day: addDays(D0, 45) },
  ]);
  assert.deepEqual(sent, [
    'lets/hi/new', 'lets/hi/day',
    'lets/hi/day', 'lets/hi/back/d1',
    'lets/hi/day',
    'lets/hi/day', 'lets/hi/back/d3', 'lets/hi/back/d7',
    'lets/hi/day',
    'lets/hi/day', 'lets/hi/back/d14', 'lets/hi/back/d30',
  ]);
  assert.equal(m.days, 6);
});

test('units: start, done and the first place someone gave up are each counted once', () => {
  const [, sent] = online(lets, NEW_METER, [
    { t: 'open', day: D0 }, { t: 'start', day: D0, unit: 'ep1' }, { t: 'quit', day: D0, unit: 'ep1', at: 4 },
    { t: 'start', day: D0, unit: 'ep1' }, { t: 'done', day: D0, unit: 'ep1' }, { t: 'done', day: D0, unit: 'ep1' },
    { t: 'count', day: D0, name: 'said aloud' }, { t: 'count', day: D0, name: 'said aloud' }, { t: 'count', day: D0, name: 'voice/sarvam', once: true }, { t: 'count', day: D0, name: 'voice/sarvam', once: true },
  ]);
  assert.deepEqual(sent.slice(2), ['lets/hi/unit/ep1/start', 'lets/hi/unit/ep1/quit/4', 'lets/hi/unit/ep1/done', 'lets/hi/said-aloud', 'lets/hi/said-aloud', 'lets/hi/voice/sarvam']);
});

test('offline: hits wait in order, are sent once, and a failed send is retried later', () => {
  let [m, fx] = lets(NEW_METER, { t: 'open', day: D0 });
  assert.deepEqual(names(fx), ['lets/hi/new', 'lets/hi/day']); assert.equal(m.sending, 2);
  [m, fx] = lets(m, { t: 'start', day: D0, unit: 'ep1' });
  assert.deepEqual(fx, [], 'nothing new is sent while a send is in flight'); assert.equal(m.queue.length, 3);
  [m, fx] = lets(m, { t: 'failed' });
  assert.deepEqual(fx, []); assert.equal(m.queue.length, 3); assert.equal(m.sending, 0);
  [m, fx] = lets(m, { t: 'done', day: D0, unit: 'ep1' });
  assert.deepEqual(names(fx), ['lets/hi/new', 'lets/hi/day', 'lets/hi/unit/ep1/start', 'lets/hi/unit/ep1/done']);
  [m, fx] = lets(m, { t: 'sent', n: 3 });
  assert.deepEqual(names(fx), ['lets/hi/unit/ep1/done'], 'a partial send keeps the rest and tries again');
  [m, fx] = lets(m, { t: 'sent', n: 1 });
  assert.deepEqual([m.queue.length, m.sending, fx.length], [0, 0, 0]);
});

test('the offline queue is capped and never drops a hit that is mid-flight', () => {
  const small = meter({ app: 'a' }, { ...RULES, maxQueue: 5 });
  let [m] = small(NEW_METER, { t: 'open', day: D0 });
  for (let i = 0; i < 20; i++) [m] = small(m, { t: 'count', day: D0, name: 'n' + i });
  assert.equal(m.queue.length, 5);
  assert.deepEqual(m.queue.slice(0, 2).map((h) => h.name), ['a/new', 'a/day'], 'the two being sent are kept');
  assert.equal(m.queue[4].name, 'a/n19');
});

test('turning counting off stops everything and clears what was waiting', () => {
  let [m] = lets(NEW_METER, { t: 'open', day: D0 });
  [m] = lets(m, { t: 'opt', on: false });
  assert.deepEqual([m.on, m.queue.length, m.sending], [false, 0, 0]);
  const [m2, fx] = fold(lets, m, [{ t: 'open', day: addDays(D0, 1) }, { t: 'done', day: addDays(D0, 1), unit: 'ep2' }]);
  assert.deepEqual(fx, []); assert.deepEqual(m2, m);
  const [m3, fx3] = fold(lets, m, [{ t: 'opt', on: true }, { t: 'open', day: addDays(D0, 7) }]);
  assert.deepEqual(names(fx3), ['lets/hi/day', 'lets/hi/back/d1', 'lets/hi/back/d3', 'lets/hi/back/d7']); assert.equal(m3.on, true);
});

test('a hit is only ever a short name: no ids, no free text, nothing personal', () => {
  const gSignal = (s) => {
    const [[kind, offset, unit, at], s2] = gTuple(gOneOf('open', 'start', 'done', 'quit', 'count', 'sent', 'failed'), gInt(0, 40), gOneOf('ep1', 'ep 2', 'boss/majestic', 'ಪಾಠ', 'a?b=c&d'), gInt(-3, 30))(s);
    const day = addDays(D0, offset);
    return [kind === 'sent' ? { t: 'sent', n: at } : kind === 'failed' ? { t: 'failed' } : kind === 'count' ? { t: 'count', day, name: unit } : kind === 'quit' ? { t: 'quit', day, unit, at } : { t: kind, day, unit }, s2];
  };
  forAll(gList(gSignal, 40), (signals) => {
    const sorted = [...signals].sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''));
    const [m, fx] = fold(lets, NEW_METER, sorted);
    for (const name of [...names(fx), ...m.queue.map((h) => h.name)]) assert.match(name, /^lets\/hi\/[A-Za-z0-9_.\/-]+$/);
    assert.ok(m.queue.length <= RULES.maxQueue && m.sending <= m.queue.length);
    assert.equal(new Set(m.once).size, m.once.length, 'nothing is marked "once" twice');
    assert.deepEqual(fold(lets, NEW_METER, sorted), [m, fx], 'the same signals always give the same result');
  });
});

test('namesFor is the vocabulary', () => {
  assert.deepEqual(namesFor(NEW_METER, { t: 'open', day: D0 }), [{ name: 'new', once: true }, { name: 'day', once: false }]);
  assert.deepEqual(namesFor(NEW_METER, { t: 'sent', n: 1 }), []);
});

test('GoatCounter: a hit is one image request for a named event', () => {
  assert.equal(goatcounterEndpoint('lets'), 'https://lets.goatcounter.com/count');
  const url = new URL(goatcounterUrl(goatcounterEndpoint('lets'), { name: 'lets/hi/back/d7' }, 'k3'));
  assert.equal(url.origin + url.pathname, 'https://lets.goatcounter.com/count');
  assert.deepEqual(Object.fromEntries(url.searchParams), { p: 'lets/hi/back/d7', t: 'lets/hi/back/d7', e: 'true', rnd: 'k3' });
});
