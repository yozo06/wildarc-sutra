# core

The foundation every other library stands on. No domain knowledge, only the tools for writing pure code.

| Export | For |
|---|---|
| `pipe`, `identity`, `assoc`, `mapRec`, `filterRec` | chaining functions; working with records without changing them |
| `Result`, `ok`, `err`, `map`, `chain`, `collect` | failure as a value instead of an exception |
| `rng.next`, `rng.int`, `rng.shuffle`, `rng.pick`, `rng.seedFrom` | randomness from a seed: same seed, same result |
| `Clock`, `Day`, `dayOf`, `addDays`, `daysBetween` | calendar days in the learner's time zone, with the clock passed in |
| `hash` | a permanent short name for a piece of text |
| `Update`, `Step`, `Program`, `fold`, `sequence`, `embed`, `only`, `observe` | the step-function shape, and the joints that chain steps into an app |

```js
import { rng, dayOf, sequence, embed } from 'wildarc-sutra/core';

const [order, nextSeed] = rng.shuffle(seed, cards);        // no hidden dice
const today = dayOf({ now: 1763280000000, offset: 330 });  // no hidden clock
```
