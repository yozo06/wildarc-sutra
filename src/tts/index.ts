// Text to speech, done once, ahead of time. Every sentence an app speaks is recorded into
// <audio>/<pack>/<clip id>.mp3 and listed in <audio>/manifest.json, which the `audio` library
// reads on the phone. Learners never call a speech service, so the app works offline and costs
// nothing to use.
//
// This is the pure half: which sentences still need recording, what to ask the service, how to
// read its reply, what the manifest becomes. bin/sutra-tts.mjs is the thin shell that sends the
// requests and writes the files; .github/workflows/tts.yml runs it for any app.
import { hash } from '../core/hash.js';
import { ok, err, type Result } from '../core/result.js';

/** One sentence to record. */
export interface Take {
  /** The file name, without extension. Same as `audio.clipId(text)`, so the app finds it. */
  readonly clip: string;
  /** The sentence as the app shows it. */
  readonly text: string;
  /** The sentence as it should be spoken (cleaned up, or an override). */
  readonly say: string;
  /** The app's own language id: 'hi', 'or', 'kn', 'en' … */
  readonly lang: string;
  /** Marked as a good sentence for trying out voices. */
  readonly sample: boolean;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** A sentence made ready for a voice: invisible joiners removed, a middle dot read as a pause, spaces tidied. */
export const speakable = (text: string): string =>
  text.replace(/[​-‍﻿]/g, '').replace(/·/g, ',').replace(/\s+/g, ' ').trim();

/**
 * Read an app's sentences: a list of { text, lang } with optional `say` (speak this instead of
 * `text`) and `sample: true`. One take per distinct clip, in the order first seen.
 */
export const takes = (json: unknown): Result<readonly Take[], readonly string[]> => {
  if (!Array.isArray(json)) return err(['expected a list like [{ "text": "Hello", "lang": "en" }]']);
  const problems: string[] = [];
  const seen = new Map<string, Take>();
  json.forEach((x, i) => {
    const text = isObj(x) && typeof x['text'] === 'string' ? x['text'] : '';
    const lang = isObj(x) && typeof x['lang'] === 'string' ? x['lang'].trim() : '';
    const override = isObj(x) && typeof x['say'] === 'string' ? x['say'] : '';
    const say = speakable(override || text);
    if (!text.trim() || !lang || !say) { problems.push(`sentence ${i + 1}: needs "text" and "lang"`); return; }
    const clip = hash(text);
    const sample = isObj(x) && x['sample'] === true;
    const before = seen.get(clip);
    if (!before) seen.set(clip, { clip, text, say, lang, sample });
    else if (sample && !before.sample) seen.set(clip, { ...before, sample: true });
  });
  return problems.length ? err(problems) : ok([...seen.values()]);
};

/** How much there is to record. */
export const tally = (all: readonly Take[]): { readonly sentences: number; readonly characters: number; readonly byLang: Readonly<Record<string, number>> } => ({
  sentences: all.length,
  characters: all.reduce((n, t) => n + t.say.length, 0),
  byLang: all.reduce<Record<string, number>>((by, t) => ({ ...by, [t.lang]: (by[t.lang] ?? 0) + 1 }), {}),
});

/** What is still to record: everything not on disk yet, or everything when forced. */
export const pending = (all: readonly Take[], have: Iterable<string>, force = false): readonly Take[] => {
  const got = new Set(have);
  return force ? all : all.filter((t) => !got.has(t.clip));
};

/** A few sentences that show a voice well: the ones marked `sample`, else the longest few in each language. */
export const samples = (all: readonly Take[], perLang = 2): readonly Take[] => {
  const marked = all.filter((t) => t.sample);
  if (marked.length) return marked;
  const langs = [...new Set(all.map((t) => t.lang))];
  return langs.flatMap((l) => all.filter((t) => t.lang === l).sort((a, b) => b.say.length - a.say.length).slice(0, perLang));
};

/** Split the clips on disk into the ones the app still uses and the leftovers from changed sentences. */
export const sortClips = (onDisk: Iterable<string>, all: readonly Take[]): { readonly keep: readonly string[]; readonly orphans: readonly string[] } => {
  const wanted = new Set(all.map((t) => t.clip));
  const files = [...new Set(onDisk)].sort();
  return { keep: files.filter((c) => wanted.has(c)), orphans: files.filter((c) => !wanted.has(c)) };
};

/**
 * The manifest after recording a pack: that pack lists exactly `clips`, every other pack is left
 * as it was, and an empty pack is dropped. `fallback` names the default pack; without it the old
 * default stays if it still exists.
 */
export const withPack = (manifest: unknown, pack: { readonly id: string; readonly label: string }, clips: Iterable<string>, fallback?: string): unknown => {
  const old = isObj(manifest) && isObj(manifest['packs']) ? manifest['packs'] : {};
  const list = [...new Set(clips)].sort();
  const packs: Record<string, unknown> = Object.fromEntries(Object.entries(old).filter(([id]) => id !== pack.id));
  if (list.length) packs[pack.id] = { label: pack.label, clips: list };
  const ids = Object.keys(packs);
  const wanted = fallback || (isObj(manifest) && typeof manifest['default'] === 'string' ? manifest['default'] : '');
  return { default: ids.includes(wanted) ? wanted : ids[0] ?? null, packs };
};

/** True if these bytes start like an MP3 file (an ID3 tag or an audio frame) and are not trivially short. */
export const isMp3 = (b: ArrayLike<number>): boolean =>
  b.length > 300 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0));

// ----- Sarvam AI (https://docs.sarvam.ai, text to speech) -----

export const SARVAM_URL = 'https://api.sarvam.ai/text-to-speech';
/** The request header that carries the key. The shell adds it; the key is never part of the data here. */
export const SARVAM_KEY_HEADER = 'api-subscription-key';
/** Bulbul v3 is the model that covers all eleven languages, Odia included. */
export const SARVAM_MODEL = 'bulbul:v3';
/** An app's language id → Sarvam's code. Sarvam writes Odia as od-IN. */
export const SARVAM_LANGS: Readonly<Record<string, string>> = {
  hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', or: 'od-IN', od: 'od-IN', en: 'en-IN',
};

export interface Voice {
  /** A Bulbul voice name, e.g. 'ritu'. */
  readonly speaker: string;
  /** 0.5 (slow) to 2.0 (fast); 1 is normal. */
  readonly pace?: number;
  readonly model?: string;
}

export interface TtsRequest {
  readonly url: string;
  readonly body: Readonly<Record<string, string | number>>;
}

/** What to send Sarvam for one sentence, or why it cannot be sent. */
export const sarvamRequest = (take: { readonly say: string; readonly lang: string }, voice: Voice): Result<TtsRequest> => {
  const code = SARVAM_LANGS[take.lang];
  const pace = voice.pace ?? 1;
  if (!code) return err(`Sarvam has no voice for language "${take.lang}"`);
  if (!take.say) return err('nothing to say');
  if (take.say.length > 2500) return err(`too long for one request: ${take.say.length} characters, the limit is 2500`);
  if (!voice.speaker.trim()) return err('no voice chosen');
  if (!(pace >= 0.5 && pace <= 2)) return err(`pace must be between 0.5 and 2, got ${voice.pace}`);
  return ok({
    url: SARVAM_URL,
    body: { text: take.say, language_code: code, speaker: voice.speaker.trim().toLowerCase(), model: voice.model ?? SARVAM_MODEL, pace, output_audio_codec: 'mp3' },
  });
};

/** The audio in Sarvam's reply, still base64 (the shell decodes it), or why there is none. */
export const sarvamReply = (json: unknown): Result<string> => {
  const audios = isObj(json) && Array.isArray(json['audios']) ? json['audios'].filter((a): a is string => typeof a === 'string' && a.length > 0) : [];
  return audios.length ? ok(audios.join('')) : err('no audio in the reply');
};

/** Should a failed request be tried again? Busy or broken servers yes; a refused request no. */
export const worthRetrying = (status: number, attempt: number, limit = 5): boolean => (status === 429 || status >= 500) && attempt < limit;

// ----- choosing a voice -----

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** The file a sample is saved as, inside the voice's own folder. */
export const sampleFile = (index: number, take: { readonly lang: string }): string => `${index + 1}-${take.lang}.mp3`;

/** A page for comparing voices side by side: one row per sentence, one player per voice. Opens straight from disk. */
export const listenPage = (speakers: readonly string[], picks: readonly Take[], note = ''): string =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voice samples</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:10px 8px;text-align:left;vertical-align:top}audio{width:210px;height:36px}small{color:#666}</style>
<h1>Voice samples</h1>${note ? `<p><small>${esc(note)}</small></p>` : ''}
<table><tr><th>Sentence</th>${speakers.map((s) => `<th>${esc(s)}</th>`).join('')}</tr>
${picks.map((t, i) => `<tr><td><small>${esc(t.lang)}</small><br>${esc(t.text)}</td>${speakers.map((s) => `<td><audio controls preload="none" src="${esc(s)}/${sampleFile(i, t)}"></audio></td>`).join('')}</tr>`).join('\n')}
</table>
`;
