import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readManifest, writeManifest, pickPack, activePack, plan, canSay, clipId, NO_VOICES } from '../dist/audio/index.js';

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
