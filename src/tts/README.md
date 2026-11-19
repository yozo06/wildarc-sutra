# tts

Text to speech, done once, ahead of time. Every sentence an app speaks is recorded into
`<audio>/<pack>/<clip id>.mp3` and listed in `<audio>/manifest.json`, which the [`audio`](../audio)
library reads on the phone. Learners never call a speech service: the app works offline and costs
nothing to use. The service today is [Sarvam AI](https://www.sarvam.ai) (Bulbul v3: Hindi, Bengali,
Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, Indian English).

An app supplies one thing, its sentences, as JSON:

```json
[{ "text": "नमस्ते", "lang": "hi" }, { "text": "Hello", "lang": "en", "sample": true }]
```

`lang` is the app's own id (`hi`, `or`, `kn`, `en` …). Optional: `say` (speak this instead of
`text`; the clip is still named after `text`) and `sample: true` (use it when trying out voices;
without any, the two longest sentences per language are used).

## Recording on GitHub (no key on anyone's machine)

Add the repository secret `SARVAM_API_KEY`, then a workflow of a few lines in the app's repo:

```yaml
name: tts
on:
  workflow_dispatch:
    inputs:
      mode:     { type: choice, options: [sample, full], default: sample, description: sample = try voices · full = record and publish }
      speakers: { default: 'ritu,kavya,roopa,gokul', description: 'sample: voices to try' }
      speaker:  { default: ritu, description: 'full: the one voice to use' }
permissions: { contents: write, actions: write }
jobs:
  tts:
    uses: yozo06/wildarc-sutra/.github/workflows/tts.yml@main
    with:
      mode: ${{ inputs.mode }}
      speakers: ${{ inputs.speakers }}
      speaker: ${{ inputs.speaker }}
      sentences: node scripts/sentences.mjs     # any command that prints the JSON above
      after: npm run sw && npm run check        # optional: run after recording, before the commit
      publish: pages.yml                        # optional: workflow to start after the push
    secrets:
      SARVAM_API_KEY: ${{ secrets.SARVAM_API_KEY }}
```

- **sample** records a few sentences in each voice and attaches them to the run as `tts-voice-samples`,
  with an `index.html` that plays the voices side by side. Nothing is committed.
- **full** records everything still missing in one voice, deletes clips whose sentence is gone,
  updates the manifest, commits and (if asked) publishes. Run it again after adding sentences: only
  the new ones are recorded. If some sentences fail, what succeeded is still committed and the run
  ends red; run it again for the rest.

**Several voices** (say a man's and a woman's, for learners to choose between): pass
`voices: gokul,roopa` instead of `speaker`. Each voice becomes its own pack, named after the voice
(`app/audio/gokul/`, `app/audio/roopa/`); `gokul=Gokul,roopa=Roopa` sets the names learners see.

Other inputs: `pace` (0.9), `force`, `audio-dir` (`app/audio`), `pack` (`sarvam`), `label`,
`default-pack`, `commit` (extra paths to commit), `sutra-ref` (`main`).

Requests go out one at a time, at most 50 a minute (Sarvam's starter plan allows 60), so a thousand
sentences take about twenty minutes. Sarvam lists Bulbul v3 at ₹3 per 1,000 characters.

## Recording by hand

From a built checkout of this repo (`npm install`):

```sh
node scripts/sentences.mjs | node path/to/wildarc-sutra/bin/sutra-tts.mjs --list
node scripts/sentences.mjs | SARVAM_API_KEY=... node path/to/wildarc-sutra/bin/sutra-tts.mjs --sample --speakers ritu,kavya
node scripts/sentences.mjs | SARVAM_API_KEY=... node path/to/wildarc-sutra/bin/sutra-tts.mjs --speaker ritu --prune
```

The key is read from the environment only. Keep it out of files that are committed.

## The pure part

```js
import { takes, pending, sarvamRequest, sarvamReply, withPack } from 'wildarc-sutra/tts';

const all = takes(json);                                     // Result: one take per clip, or what is wrong
const todo = pending(all.value, clipsOnDisk);                // what is still to record
sarvamRequest(todo[0], { speaker: 'ritu', pace: 0.9 });      // Result: { url, body }, no key in it
sarvamReply(replyJson);                                      // Result: base64 audio
withPack(oldManifest, { id: 'sarvam', label: 'Sarvam' }, clips);   // other packs untouched
```

Also: `speakable`, `tally`, `samples`, `sortClips`, `isMp3`, `worthRetrying`, `listenPage`.
A take's `clip` is the same value as `audio.clipId(text)`: that is the contract between recording
and playing, and it never changes.

Adding another service means adding its `xRequest` / `xReply` pair here and one branch in
`bin/sutra-tts.mjs`; nothing else moves.
