#!/usr/bin/env node
// Records an app's sentences with a text-to-speech service (Sarvam AI), once, into voice-pack
// files the `audio` library plays: <out>/<pack>/<clip id>.mp3 plus <out>/manifest.json.
//
// Sentences come as JSON, [{ "text": "नमस्ते", "lang": "hi" }, ...], from --sentences <file>
// or piped in. The key comes from the environment (SARVAM_API_KEY), never from an argument.
//
//   my-sentences | sutra-tts --list                                  how much there is (no key needed)
//   my-sentences | sutra-tts --sample --speakers ritu,kavya,gokul    a few sentences per voice, into
//                                                                    samples/tts/ with a page to listen
//   my-sentences | sutra-tts --speaker ritu                          record everything still missing
//
//   --out app/audio     where the packs live           --pack sarvam   --label Sarvam
//   --default <pack>    make this pack the default      --pace 0.9      0.5 (slow) to 2.0 (fast)
//   --force             record again what already exists
//   --prune             delete clips whose sentence no longer exists
//   --samples <dir>     where --sample writes           --endpoint <url>  another server (tests, a proxy)
//   --per-minute 50     never send requests faster than this (Sarvam's starter plan allows 60 a minute)
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { takes, tally, pending, samples, sortClips, withPack, isMp3, sarvamRequest, sarvamReply, worthRetrying, sampleFile, listenPage, SARVAM_KEY_HEADER, SARVAM_MODEL } from '../dist/tts/index.js';

const args = process.argv.slice(2);
const has = (name) => args.includes('--' + name);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt; };
const stop = (message, code = 1) => { console.error(message); process.exit(code); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const from = opt('sentences', '-');
const usage = 'usage: sutra-tts --sentences <file.json | -> [--list | --sample --speakers a,b | --speaker a]';
if (from === '-' && process.stdin.isTTY) stop('No sentences: pipe them in or pass --sentences <file.json>.\n' + usage, 2);
let raw;
// Piped input is read as a stream: reading a pipe in one go can fail before the other side has written.
const piped = async () => { let s = ''; process.stdin.setEncoding('utf8'); for await (const chunk of process.stdin) s += chunk; return s; };
try { raw = JSON.parse(from === '-' ? await piped() : readFileSync(from, 'utf8')); }
catch (e) { stop(`Could not read the sentences (${from === '-' ? 'piped in' : from}): ${e.message}\n${usage}`, 2); }
const read = takes(raw);
if (!read.ok) stop('The sentences have problems:\n  ' + read.error.slice(0, 20).join('\n  '), 2);
const all = read.value;

const out = resolve(opt('out', 'app/audio'));
const pack = { id: opt('pack', 'sarvam'), label: opt('label', 'Sarvam') };
if (!/^[a-z0-9][a-z0-9_-]*$/.test(pack.id)) stop(`A pack name is a folder name: small letters, digits, - and _ only. Got "${pack.id}".`, 2);
const dir = join(out, pack.id);
const manifestFile = join(out, 'manifest.json');
const onDisk = () => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)) : []);

if (has('list')) {
  const t = tally(all);
  console.log(`${t.sentences} sentences, ${t.characters} characters: ${JSON.stringify(t.byLang)}; ${sortClips(onDisk(), all).keep.length} already recorded in ${pack.id}`);
  process.exit(0);
}

const key = process.env.SARVAM_API_KEY;
if (!key) stop('Set SARVAM_API_KEY in the environment, or run with --list. Nothing recorded.');
const pace = Number(opt('pace', '0.9'));
const endpoint = opt('endpoint', '');
// Requests are sent one at a time, never closer together than the plan's limit allows.
const gap = 60000 / Math.max(1, Number(opt('per-minute', '50')) || 50);
let last = 0;
const turn = async () => { const wait = last + gap - Date.now(); if (wait > 0) await sleep(wait); last = Date.now(); };

async function record(take, speaker) {
  const req = sarvamRequest(take, { speaker, pace });
  if (!req.ok) throw new Error(req.error);
  for (let attempt = 0; ; attempt++) {
    await turn();
    const res = await fetch(endpoint || req.value.url, { method: 'POST', headers: { 'content-type': 'application/json', [SARVAM_KEY_HEADER]: key }, body: JSON.stringify(req.value.body) });
    if (res.ok) {
      const audio = sarvamReply(await res.json());
      if (!audio.ok) throw new Error(audio.error);
      const clip = Buffer.from(audio.value, 'base64');
      if (!isMp3(clip)) throw new Error('the reply is not MP3 audio');
      return clip;
    }
    if (worthRetrying(res.status, attempt)) { await sleep(2000 * (attempt + 1)); continue; }
    throw new Error(`Sarvam ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

if (has('sample')) {
  const speakers = opt('speakers', opt('speaker', '')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!speakers.length) stop('Name the voices to try: --sample --speakers ritu,kavya,gokul', 2);
  const root = resolve(opt('samples', 'samples/tts'));
  const picks = samples(all);
  let made = 0, chars = 0; const heard = [];
  for (const speaker of speakers) {
    let ok = 0;
    for (const [i, take] of picks.entries()) {
      try { const clip = await record(take, speaker); mkdirSync(join(root, speaker), { recursive: true }); writeFileSync(join(root, speaker, sampleFile(i, take)), clip); ok++; chars += take.say.length; }
      catch (e) { console.error(`${speaker} [${take.lang}]: ${e.message}`); if (i === 0) break; }   // a voice that fails its first sentence is skipped
    }
    made += ok; if (ok) heard.push(speaker);
    console.log(ok ? `sampled ${speaker} (${ok} of ${picks.length})` : `skipped ${speaker}`);
  }
  if (made) writeFileSync(join(root, 'index.html'), listenPage(heard, picks, `${SARVAM_MODEL}, pace ${pace}. Pick a voice, then record everything with --speaker <name>.`));
  console.log(`${made} samples in ${root} (${SARVAM_MODEL}, pace ${pace}, ${chars} characters used). Open index.html there to listen.`);
  process.exit(made ? 0 : 1);
}

const speaker = opt('speaker', '').toLowerCase();
if (!speaker) stop('Choose what to do: --list, --sample --speakers a,b, or --speaker <name>.', 2);
mkdirSync(dir, { recursive: true });
const todo = pending(all, onDisk(), has('force'));
console.log(`Sarvam ${SARVAM_MODEL}, voice ${speaker}, pace ${pace}: ${all.length} sentences, ${todo.length} to record`);
let made = 0; const failed = [];
for (const take of todo) {
  try { writeFileSync(join(dir, take.clip + '.mp3'), await record(take, speaker)); made++; }
  catch (e) {
    failed.push(`[${take.lang}] ${take.text} | ${e.message}`);
    if (made === 0) { console.error('The first request failed, stopping:\n  ' + failed[0]); break; }
    if (failed.length > 20) { console.error('Too many failures, stopping.'); break; }
  }
  if (made && made % 50 === 0) console.log(`  ${made} recorded…`);
}
const { keep, orphans } = sortClips(onDisk(), all);
if (has('prune')) for (const c of orphans) rmSync(join(dir, c + '.mp3'));
const before = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null;
writeFileSync(manifestFile, JSON.stringify(withPack(before, pack, keep, opt('default', ''))) + '\n');
console.log(`recorded ${made}, already there ${all.length - todo.length}, failed ${failed.length}; ${keep.length} of ${all.length} sentences now have a clip in ${pack.id}` + (orphans.length ? `; ${orphans.length} leftover clip(s) ${has('prune') ? 'deleted' : 'kept (use --prune to delete)'}` : ''));
for (const f of failed) console.log('  FAILED: ' + f);
process.exit(failed.length ? 1 : 0);
