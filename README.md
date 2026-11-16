# sutra

*Sutra* means thread. This is a kit of small pure functions that you thread together
to build learning games that work offline, on cheap phones, in the learner's own language.

It was pulled out of [Kannada Kali](https://github.com/yozo06/kannada-kali) so that the next
game does not start from zero. No dependencies. No server. No accounts.

## What is in it

| Part | What it gives you |
|---|---|
| `sutra/core` | `pipe`, `Result`, seeded randomness, calendar days, and the `update` shape every part shares |
| `sutra/srs` | Spaced repetition on a Leitner ladder |
| `sutra/habit` | Day streaks that forgive one missed day; per-day tallies |
| `sutra/save` | Save codes (progress as one line of text) and merge rules for two saves |
| `sutra/i18n` | Translation lookup, coverage checks, and conversion between Indian scripts |
| `sutra/audio` | Voice packs: which recorded clip to play for a phrase, with fallbacks |
| `sutra/analytics` | Anonymous counts (retention, drop-off) with an offline queue; GoatCounter adapter |
| `sutra/pwa` | The service worker that makes an app folder work offline, plus the `sutra-sw` command |
| `sutra/browser` | The shell: clock, storage, sound, network, and the loop that runs a program |

## The one idea

Every part is a function from values to values. Nothing reads the clock, rolls dice or
touches the device, except `sutra/browser`.

```
update : (state, event) -> [next state, effects]
```

- **State** is plain data.
- An **event** is plain data describing what happened, including when: time is an argument, never looked up.
- An **effect** is plain data describing what to do (play this, save, send these counts). The shell does it and reports back with another event.

So any behaviour can be tested by feeding events in and comparing data out, a session can be
replayed from its events, and parts combine without knowing about each other:

```js
import { core, srs, habit, analytics } from '@yozo06/sutra';

// One small update per concern...
const lesson = (s, e) => e.t !== 'answer' ? [s, []] : [{
  ...s,
  streak: habit.touch(s.streak, e.day),
  cards: { ...s.cards, [e.card]: srs.review(s.cards[e.card], e.right, e.now) },
}, [{ t: 'save' }]];

const counting = core.embed(
  (s) => s.meter, (s, meter) => ({ ...s, meter }),
  core.only((e) => e.t === 'opened' ? { t: 'open', day: e.day } : undefined,
            analytics.meter({ app: 'myapp', lang: 'hi' })));

// ...chained into the app.
const update = core.sequence(lesson, counting);
```

A complete runnable page is in [`examples/hello`](examples/hello/index.html). The built files are
plain ES modules, so a browser loads them as they are: no bundler needed.

The rule is enforced, not hoped for. `npm run pure` type-checks everything outside
`src/browser` with no browser APIs available, and rejects `Date.now()`, `Math.random()` and timers.

## Use it

```sh
npm install github:yozo06/sutra
```

```js
import { review } from '@yozo06/sutra/srs';
import { start, readClock } from '@yozo06/sutra/browser';
```

To make an app folder work offline, generate its service worker after every change:

```sh
npx sutra-sw --root app --prefix myapp          # writes app/sw.js
npx sutra-sw --root app --prefix myapp --check  # for CI: fails if it is stale
```

## Develop

```sh
npm install
npm run check   # build, purity check, tests
```

Tests are in `test/`. Laws (for example "merging a save with itself changes nothing") are checked
against hundreds of generated cases using sutra's own seeded randomness; see `test/prop.mjs`.

## Read more

- [docs/architecture.md](docs/architecture.md): how the parts fit, and how to build an app from them
- [docs/analytics.md](docs/analytics.md): exactly what is counted, what never is, and how to read it
- [CONTRIBUTING.md](CONTRIBUTING.md)

## Status

0.1: the parts above are extracted from a working app and tested, and the API may still move.
Used by: Kannada Kali (migration in progress), LETS (in progress).

## Licence

MIT. Copyright (c) 2026 Yogesh Zope.
