# srs

Spaced repetition on a Leitner ladder. A card climbs one box per right answer and waits longer each
time (0, 1, 2, 4, 8, 16 days); a miss sends it back to the start.

```js
import { review, dueIds } from 'wildarc-sutra/srs';

const cards = { ...old, hello: review(old.hello, true, now) };  // -> [box, dueAt, reps, lapses]
const today = dueIds(cards, now);
```

`CardRecord` is a four-number tuple so that thousands fit in a save code. Its layout is permanent.
