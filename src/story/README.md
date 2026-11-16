# story

Teaching through a serial story: one short episode a day, no way to fail.

Three things are kept apart so that each can grow without touching the others:

| | What it is | Adding one means |
|---|---|---|
| `Curriculum` | what is learned: ordered skills, each a few lines of the target language | a new lesson |
| `Track` | whose life the story follows: one scene per skill | a new kind of learner |
| `Locale` | the language it is told in: text, plus each line's meaning and sound | a new language |

```js
import { buildEpisode, missing, begin, play, today } from 'wildarc-sutra/story';

missing(curriculum, [work, home], [hindi, odia]);   // everything still to write; run it in CI

const built = buildEpisode(curriculum, home, hindi, 1);
if (built.ok) {
  const step = play(built.value);
  let [player, cues] = begin(built.value);           // cues: what to speak first
  [player, cues] = step(player, { t: 'next' });
  [player, cues] = step(player, { t: 'pick', option: 'bus' });   // wrong? cue 'retry', the story goes on
}
```

A scene is a list of beats: `tell` (story in the learner's language), `teach` (a character uses a line),
`choose` (the learner helps the character pick; pictures let non-readers answer) and `say` (repeat aloud,
never judged). Every episode ends with a recap of the lines to take away.

`today(curriculum, finished, day)` says which episode is next, and holds the next one back until tomorrow.
