import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takes, tally, pending, samples, sortClips, withPack, isMp3, speakable, sarvamRequest, sarvamReply, worthRetrying, sampleFile, listenPage, SARVAM_LANGS, SARVAM_URL } from '../dist/tts/index.js';
import { clipId, readManifest } from '../dist/audio/index.js';

const SENTENCES = [
  { text: 'नमस्ते', lang: 'hi' },
  { text: 'आपका नाम क्या है?', lang: 'hi' },
  { text: 'ନମସ୍କାର', lang: 'or' },
  { text: 'Hello', lang: 'en' },
  { text: 'नमस्ते', lang: 'hi' },                       // said twice in the app, recorded once
  { text: 'ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ · ಬನ್ನಿ', lang: 'kn' },
];

test('sentences become takes: one per clip, named the way the player looks them up', () => {
  const all = takes(SENTENCES).value;
  assert.equal(all.length, 5);
  for (const t of all) assert.equal(t.clip, clipId(t.text), 'recording and playing agree on the file name');
  assert.equal(all[4].say, 'ಮೆಜೆಸ್ಟಿಕ್ಗೆ , ಬನ್ನಿ', 'joiners dropped, middle dot read as a pause');
  assert.equal(takes([{ text: 'A·B', lang: 'en', say: 'A and B' }]).value[0].say, 'A and B');
  assert.deepEqual(tally(all), { sentences: 5, characters: all.reduce((n, t) => n + t.say.length, 0), byLang: { hi: 2, or: 1, en: 1, kn: 1 } });
  assert.equal(speakable('  a \n b  '), 'a b');
  for (const junk of [null, {}, 'x', 5]) assert.equal(takes(junk).ok, false);
  const bad = takes([{ text: 'ok', lang: 'en' }, { text: '', lang: 'en' }, { text: 'no language' }, 7]);
  assert.deepEqual([bad.ok, bad.error.length, bad.error[0]], [false, 3, 'sentence 2: needs "text" and "lang"']);
});

test('what to record, what to sample, what to throw away', () => {
  const all = takes(SENTENCES).value;
  const have = [all[0].clip, 'deadbeef'];
  assert.deepEqual(pending(all, have).map((t) => t.text), all.slice(1).map((t) => t.text));
  assert.equal(pending(all, have, true).length, 5, 'forced: everything again');
  assert.equal(pending(all, all.map((t) => t.clip)).length, 0, 'a second run records nothing');
  assert.deepEqual(sortClips(have, all), { keep: [all[0].clip], orphans: ['deadbeef'] });
  assert.deepEqual(samples(all, 1).map((t) => t.text), ['आपका नाम क्या है?', 'ନମସ୍କାର', 'Hello', SENTENCES[5].text], 'the longest in each language');
  const marked = takes([...SENTENCES, { text: 'Hello', lang: 'en', sample: true }]).value;
  assert.deepEqual(samples(marked).map((t) => t.text), ['Hello'], 'marked sentences win');
});

test('the manifest keeps other packs and stays readable by the player', () => {
  const old = { default: 'kn', packs: { kn: { label: 'AI4Bharat', clips: ['b', 'a'] } } };
  const next = withPack(old, { id: 'sarvam', label: 'Sarvam' }, ['z', 'y', 'z']);
  assert.deepEqual(next, { default: 'kn', packs: { kn: { label: 'AI4Bharat', clips: ['b', 'a'] }, sarvam: { label: 'Sarvam', clips: ['y', 'z'] } } });
  assert.equal(withPack(old, { id: 'sarvam', label: 'Sarvam' }, ['y'], 'sarvam').default, 'sarvam');
  assert.equal(withPack(old, { id: 'sarvam', label: 'Sarvam' }, ['y'], 'nope').default, 'kn', 'a default that does not exist is ignored');
  assert.deepEqual(withPack(next, { id: 'sarvam', label: 'Sarvam' }, []), old, 'an empty pack is dropped');
  assert.deepEqual(withPack(null, { id: 'sarvam', label: 'Sarvam' }, []), { default: null, packs: {} });
  const v = readManifest(withPack({ default: null, packs: {} }, { id: 'sarvam', label: 'Sarvam' }, [clipId('Hello')]));
  assert.deepEqual([v.fallback, v.packs[0].clips.has(clipId('Hello'))], ['sarvam', true]);
});

test('the Sarvam request and reply, as the reference describes them', () => {
  const r = sarvamRequest({ say: 'ନମସ୍କାର', lang: 'or' }, { speaker: ' Ritu ', pace: 0.9 });
  assert.deepEqual(r.value, { url: SARVAM_URL, body: { text: 'ନମସ୍କାର', language_code: 'od-IN', speaker: 'ritu', model: 'bulbul:v3', pace: 0.9, output_audio_codec: 'mp3' } });
  assert.ok(!JSON.stringify(r.value).includes('key'), 'the key is never part of the data');
  assert.equal(sarvamRequest({ say: 'Hi', lang: 'en' }, { speaker: 'ritu' }).value.body.pace, 1);
  assert.equal(Object.keys(SARVAM_LANGS).length, 12);
  for (const [take, voice] of [[{ say: 'x', lang: 'fr' }, { speaker: 'ritu' }], [{ say: '', lang: 'hi' }, { speaker: 'ritu' }], [{ say: 'x'.repeat(2501), lang: 'hi' }, { speaker: 'ritu' }], [{ say: 'x', lang: 'hi' }, { speaker: ' ' }], [{ say: 'x', lang: 'hi' }, { speaker: 'ritu', pace: 3 }]])
    assert.equal(sarvamRequest(take, voice).ok, false);
  assert.deepEqual(sarvamReply({ request_id: 'r', audios: ['QUJD', 'REVG'] }), { ok: true, value: 'QUJDREVG' });
  for (const junk of [null, {}, { audios: [] }, { audios: [''] }, { audios: 'x' }]) assert.equal(sarvamReply(junk).ok, false);
  assert.deepEqual([worthRetrying(429, 0), worthRetrying(503, 4), worthRetrying(503, 5), worthRetrying(400, 0), worthRetrying(403, 0)], [true, true, false, false, false]);
  const id3 = new Uint8Array(400); id3.set([0x49, 0x44, 0x33]); const frame = new Uint8Array(400); frame.set([0xff, 0xfb]);
  assert.deepEqual([isMp3(id3), isMp3(frame), isMp3(new Uint8Array(400)), isMp3(id3.slice(0, 100))], [true, true, false, false]);
});

test('the listening page shows every voice beside every sentence and escapes text', () => {
  const picks = takes([{ text: 'A <b> & "c"', lang: 'en' }, { text: 'नमस्ते', lang: 'hi' }]).value;
  const page = listenPage(['ritu', 'gokul'], picks, 'pace 0.9');
  assert.equal(sampleFile(1, picks[1]), '2-hi.mp3');
  assert.equal((page.match(/<audio /g) || []).length, 4);
  assert.ok(page.includes('src="gokul/2-hi.mp3"') && page.includes('A &lt;b&gt; &amp; &quot;c&quot;') && page.includes('नमस्ते') && !page.includes('<b>'));
});

// ----- the command, against a stand-in for Sarvam -----

const bin = fileURLToPath(new URL('../bin/sutra-tts.mjs', import.meta.url));
const fakeMp3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33]), Buffer.alloc(500, 1)]).toString('base64');
const run = (args, { input = JSON.stringify(SENTENCES), env = {}, cwd } = {}) => new Promise((done) => {
  const p = spawn(process.execPath, [bin, ...args], { cwd, env: { PATH: process.env.PATH, ...env } });
  let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  p.on('close', (code) => done({ code, out })); p.stdin.end(input);
});
const sarvam = (reply) => new Promise((ready) => {
  const seen = [];
  const s = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { seen.push({ key: req.headers['api-subscription-key'], body: JSON.parse(b) }); const [status, json] = reply(seen.length, JSON.parse(b)); res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); }); });
  s.listen(0, '127.0.0.1', () => ready({ url: `http://127.0.0.1:${s.address().port}/text-to-speech`, seen, close: () => s.close() }));
});

test('sutra-tts: list, sample, record, record again, prune, and never show the key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sutra-tts-'));
  const out = join(dir, 'app/audio'); mkdirSync(join(out, 'kn'), { recursive: true });
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ default: 'kn', packs: { kn: { label: 'AI4Bharat', clips: ['aaaa1111'] } } }));
  const KEY = 'sk_test_do_not_print';
  const api = await sarvam((n, body) => (body.speaker === 'nobody' ? [400, { error: { message: 'Invalid speaker' } }] : [200, { request_id: 'r' + n, audios: [fakeMp3] }]));
  try {
    const list = await run(['--list', '--out', out]);
    assert.deepEqual([list.code, list.out.trim()], [0, '5 sentences, 55 characters: {"hi":2,"or":1,"en":1,"kn":1}; 0 already recorded in sarvam']);
    assert.equal(api.seen.length, 0, 'listing calls nobody and needs no key');

    const noKey = await run(['--speaker', 'ritu', '--out', out]);
    assert.deepEqual([noKey.code, /SARVAM_API_KEY/.test(noKey.out)], [1, true]);

    const env = { SARVAM_API_KEY: KEY };
    const sample = await run(['--sample', '--speakers', 'ritu,nobody,Gokul', '--samples', join(dir, 'samples'), '--endpoint', api.url, '--out', out], { env });
    assert.equal(sample.code, 0, sample.out);
    assert.ok(/sampled ritu \(5 of 5\)/.test(sample.out) && /skipped nobody/.test(sample.out) && /nobody \[hi\]: Sarvam 400/.test(sample.out) && /sampled gokul/.test(sample.out), sample.out);
    assert.deepEqual(readdirSync(join(dir, 'samples')).sort(), ['gokul', 'index.html', 'ritu']);
    const page = readFileSync(join(dir, 'samples/index.html'), 'utf8');
    assert.ok(page.includes('ritu/1-hi.mp3') && page.includes('gokul/5-kn.mp3') && !page.includes('nobody/'), 'only the voices that worked are on the page');
    assert.ok(!existsSync(join(out, 'sarvam')), 'sampling never touches the app');

    api.seen.length = 0;
    const full = await run(['--speaker', 'ritu', '--pace', '0.8', '--default', 'sarvam', '--endpoint', api.url, '--out', out], { env });
    assert.equal(full.code, 0, full.out);
    assert.ok(/recorded 5, already there 0, failed 0; 5 of 5 sentences now have a clip in sarvam/.test(full.out), full.out);
    assert.equal(api.seen.length, 5);
    assert.deepEqual(api.seen[2], { key: KEY, body: { text: 'ନମସ୍କାର', language_code: 'od-IN', speaker: 'ritu', model: 'bulbul:v3', pace: 0.8, output_audio_codec: 'mp3' } });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.deepEqual([manifest.default, manifest.packs.kn.clips, manifest.packs.sarvam.clips.length], ['sarvam', ['aaaa1111'], 5]);
    assert.ok(existsSync(join(out, 'sarvam', clipId('Hello') + '.mp3')));

    api.seen.length = 0; writeFileSync(join(out, 'sarvam/0ld0ld00.mp3'), 'x');
    const again = await run(['--speaker', 'ritu', '--prune', '--endpoint', api.url, '--out', out], { env, input: JSON.stringify([...SENTENCES, { text: 'Thank you', lang: 'en' }]) });
    assert.ok(/1 to record/.test(again.out) && /recorded 1, already there 5, failed 0; 6 of 6/.test(again.out) && /1 leftover clip\(s\) deleted/.test(again.out), again.out);
    assert.deepEqual([api.seen.length, existsSync(join(out, 'sarvam/0ld0ld00.mp3')), JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')).default], [1, false, 'sarvam']);

    for (const r of [list, noKey, sample, full, again]) assert.ok(!r.out.includes(KEY), 'the key never appears in output');
  } finally { api.close(); }
});

test('sutra-tts: a refused first request stops at once; a busy server is retried; rubbish is refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sutra-tts-'));
  const env = { SARVAM_API_KEY: 'k' };
  const refuse = await sarvam(() => [403, { error: { message: 'Invalid API key' } }]);
  const busy = await sarvam((n) => (n === 1 ? [429, {}] : [200, { audios: [fakeMp3] }]));
  const wav = await sarvam(() => [200, { audios: [Buffer.from('RIFF' + 'x'.repeat(500)).toString('base64')] }]);
  try {
    const a = await run(['--speaker', 'ritu', '--endpoint', refuse.url, '--out', join(dir, 'a')], { env });
    assert.deepEqual([a.code, refuse.seen.length, /The first request failed, stopping/.test(a.out), /Sarvam 403/.test(a.out)], [1, 1, true, true], a.out);
    const b = await run(['--speaker', 'ritu', '--endpoint', busy.url, '--out', join(dir, 'b')], { env, input: JSON.stringify([{ text: 'Hello', lang: 'en' }]) });
    assert.deepEqual([b.code, busy.seen.length], [0, 2], b.out);
    const c = await run(['--speaker', 'ritu', '--endpoint', wav.url, '--out', join(dir, 'c')], { env });
    assert.ok(c.code === 1 && /not MP3 audio/.test(c.out), c.out);
    const d = await run(['--list'], { input: '{"not": "a list"}' });
    assert.ok(d.code === 2 && /expected a list/.test(d.out), d.out);
    const e = await run(['--speaker', 'ritu', '--endpoint', busy.url, '--out', join(dir, 'e')], { env, input: JSON.stringify([{ text: 'Bonjour', lang: 'fr' }]) });
    assert.ok(e.code === 1 && /no voice for language "fr"/.test(e.out), e.out);
  } finally { refuse.close(); busy.close(); wav.close(); }
});
