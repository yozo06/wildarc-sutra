import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, translate, translator, holes, coverage, transliterate, scriptOf } from '../dist/i18n/index.js';
import { readManifest, writeManifest, pickPack, activePack, plan, canSay, clipId, NO_VOICES } from '../dist/audio/index.js';

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

const manifest = { default: 'sarvam', packs: { kn: { label: 'AI4Bharat', clips: [clipId('ನಮಸ್ಕಾರ'), clipId('ಹೌದು')] }, sarvam: { label: 'Sarvam', clips: [clipId('ನಮಸ್ಕಾರ')] }, empty: { label: 'Empty', clips: [] } } };

test('voice manifest: current format, first format, and rubbish', () => {
  const v = readManifest(manifest);
  assert.deepEqual(v.packs.map((p) => [p.id, p.label, p.clips.size]), [['kn', 'AI4Bharat', 2], ['sarvam', 'Sarvam', 1]]);
  assert.equal(v.fallback, 'sarvam');
  assert.equal(readManifest({ default: 'nope', packs: manifest.packs }).fallback, 'kn');
  const old = readManifest({ clips: ['e0bbc62d'] }, { id: 'kn', label: 'AI4Bharat' });
  assert.deepEqual([old.packs[0].id, old.packs[0].label, old.fallback], ['kn', 'AI4Bharat', 'kn']);
  for (const junk of [null, 5, 'x', [], { packs: 7 }, { clips: [] }]) assert.equal(readManifest(junk).packs.length, 0);
  assert.deepEqual(readManifest(writeManifest(v.packs, v.fallback)), v, 'write then read gives the same voices');
});

test('what to play: the chosen pack, then any pack, then the device voice, then silence', () => {
  const v = readManifest(manifest);
  assert.equal(activePack(v, ''), 'sarvam'); assert.equal(activePack(v, 'kn'), 'kn'); assert.equal(activePack(v, 'gone'), 'sarvam');
  assert.equal(pickPack(v.packs, 'sarvam', clipId('ಹೌದು')).id, 'kn');
  assert.deepEqual(plan(v, 'ನಮಸ್ಕಾರ', { base: 'audio' }), { t: 'clip', url: 'audio/sarvam/e0bbc62d.mp3', text: 'ನಮಸ್ಕಾರ' });
  assert.equal(plan(v, 'ನಮಸ್ಕಾರ', { base: 'audio', chosen: 'kn' }).url, 'audio/kn/e0bbc62d.mp3');
  assert.equal(plan(v, 'ಹೌದು', { base: 'a', ext: 'ogg' }).url, 'a/kn/' + clipId('ಹೌದು') + '.ogg', 'falls back to a pack that has it');
  assert.deepEqual(plan(v, 'ಇಲ್ಲ', { base: 'audio', deviceVoice: true }), { t: 'voice', text: 'ಇಲ್ಲ' });
  assert.deepEqual(plan(v, 'ಇಲ್ಲ', { base: 'audio' }), { t: 'silent' });
  assert.ok(canSay(v, 'ನಮಸ್ಕಾರ', { base: 'audio' })); assert.ok(!canSay(NO_VOICES, 'ನಮಸ್ಕಾರ', { base: 'audio' }));
});
