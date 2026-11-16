# audio

Voice packs. Each phrase can have a recorded clip, stored as `audio/<pack>/<clip id>.mp3` and listed in
`audio/manifest.json`. This library decides what should be played; the shell plays it.

```js
import { readManifest, plan } from 'wildarc-sutra/audio';

const voices = readManifest(json);
plan(voices, 'Hello', { base: 'audio', chosen: 'sarvam', deviceVoice: true });
// { t: 'clip', url: 'audio/sarvam/1a2b3c4d.mp3' }  or  { t: 'voice' }  or  { t: 'silent' }
```

Order of preference: the learner's chosen pack, any other pack that has the clip, the device's own
voice, silence. `clipId` is permanent: files are named by it.
