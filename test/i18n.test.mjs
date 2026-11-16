import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, translate, translator, holes, coverage, transliterate, scriptOf } from '../dist/i18n/index.js';

test('translate falls back to the base text and fills holes', () => {
  const hi = { 'Start': 'शुरू करें', 'Day {n} of {total}': '{total} में से दिन {n}', 'Empty': '  ' };
  assert.equal(translate(hi, 'Start'), 'शुरू करें');
  assert.equal(translate(hi, 'Day {n} of {total}', { n: 3, total: 7 }), '7 में से दिन 3');
  assert.equal(translate(hi, 'Not translated yet'), 'Not translated yet');
  assert.equal(translate(hi, 'Empty'), 'Empty', 'a blank translation counts as missing');
  assert.equal(translate(hi, 'ep1.title', undefined, 'A new city'), 'A new city');
  assert.equal(translator(hi)('Start'), 'शुरू करें');
  assert.equal(fill('Hello {name}, {unknown}', { name: 'Asha' }), 'Hello Asha, {unknown}');
  assert.deepEqual(holes('{b} then {a}'), ['{a}', '{b}']);
});

test('coverage finds missing, broken and stale translations', () => {
  const base = { a: 'One', b: 'Day {n}', c: 'Three', d: 'Hi {name}' };
  const c = coverage(base, { a: 'एक', b: 'दिन', d: 'नमस्ते {name}', old: 'x' });
  assert.equal(c.total, 4); assert.equal(c.have, 3);
  assert.deepEqual(c.missing, ['c']); assert.deepEqual(c.broken, ['b']); assert.deepEqual(c.unknown, ['old']);
});

test('one Indian script to another', () => {
  assert.equal(transliterate('ನಮಸ್ಕಾರ, ಹೇಗಿದ್ದೀರಾ?', 'kannada', 'devanagari'), 'नमस्कार, हेगिद्दीरा?');
  assert.equal(transliterate('ನಮಸ್ಕಾರ, ಹೇಗಿದ್ದೀರಾ?', 'kannada', 'odia'), 'ନମସ୍କାର, ହେଗିଦ୍ଦୀରା?');
  assert.equal(transliterate('ವೆಂಕಟ ಒಂದು', 'kannada', 'odia'), 'ୱେଂକଟ ଓଂଦୁ', 'Odia has no short e/o and writes v as ୱ');
  assert.equal(transliterate('नमस्ते', 'devanagari', 'kannada'), 'ನಮಸ್ತೇ', 'Hindi e is the long one');
  assert.equal(transliterate('नमस्ते', 'devanagari', 'telugu'), 'నమస్తే');
  assert.equal(transliterate('हाउ मच?', 'devanagari', 'odia'), 'ହାଉ ମଚ?');
  assert.equal(transliterate('कॉलेज ऑफिस', 'devanagari', 'odia'), 'କଲେଜ ଅଫିସ', 'English o-sounds use the Odia a');
  assert.equal(transliterate('ठीक है। ok 12', 'devanagari', 'odia'), 'ଠୀକ ହୈ। ok 12', 'the danda, Latin text and digits pass through');
  assert.equal(transliterate('abc', 'kannada', 'odia'), 'abc');
  assert.equal(transliterate('ಕ', 'kannada', 'kannada'), 'ಕ');
  assert.equal(scriptOf('ଓ'), 'odia'); assert.equal(scriptOf('क'), 'devanagari'); assert.equal(scriptOf('a'), undefined);
});

test('script conversion round-trips where both scripts have the letters', () => {
  for (const w of ['ನಮಸ್ಕಾರ', 'ಕನ್ನಡ', 'ಧನ್ಯವಾದಗಳು', 'ಗೊತ್ತಿಲ್ಲ']) {
    assert.equal(transliterate(transliterate(w, 'kannada', 'devanagari'), 'devanagari', 'kannada'), w);
    assert.equal(transliterate(transliterate(w, 'kannada', 'telugu'), 'telugu', 'kannada'), w);
  }
});
