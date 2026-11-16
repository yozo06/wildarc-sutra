# Architecture

## Functional core, thin shell

```
            events                      effects
  taps ──▶ ┌──────────────────────────┐ ──▶ ┌───────────────────────┐
  clock ─▶ │  pure core               │     │  shell (src/browser)   │ ──▶ screen, sound,
  network ▶│  update(state, event)    │     │  carries effects out  │     storage, network
           └──────────────────────────┘ ◀── └───────────────────────┘
                       ▲      more events (sound ended, counts sent…)
```

The core never looks anything up. Whatever it needs arrives as an argument:

| Needs | Gets it as | Never does |
|---|---|---|
| the time | `now`, a `Clock`, or a `Day` inside the event | `Date.now()` |
| chance | a `Seed`; returns the next one | `Math.random()` |
| saved progress | the state passed in | read storage |
| to save, play, send | returns an effect | call the device |
| to fail | returns a `Result` | throw |

Two checks keep this true (`npm run rules`): everything outside `src/browser` is type-checked with no
browser APIs in scope, and a script rejects the clock, dice, timers and console there.

## The shape everything shares

```ts
type Step<S, F>      = readonly [state: S, effects: readonly F[]];
type Update<S, E, F> = (state: S, event: E) => Step<S, F>;
```

Parts are combined with a handful of functions from `core`:

| Function | Meaning |
|---|---|
| `sequence(a, b, …)` | run several updates on the same event, in order |
| `embed(get, set, inner)` | let an update that knows only a part work inside the whole state |
| `only(select, inner)` | feed an update just the events it understands, translated to its own vocabulary |
| `observe(update, watch)` | let an onlooker see each transition and add effects |
| `fold(update, start, events)` | replay events: state is always a function of what happened |

An app is these, applied to small updates:

```
app = sequence(
        lesson,                                  // the game's own rules
        embed(meterLens, only(toSignal, meter)), // anonymous counting
        embed(habitLens, only(toVisit, streak))) // the daily habit
```

Because parts only meet through `sequence`/`embed`/`only`, any of them can be removed, replaced or
tested alone.

## Content is data; games differ in data and rules, not plumbing

A game supplies:

1. **Content** as plain data (cards, episodes, translations), checked by a pure validator in CI.
2. **Rules** as an `Update` (what a tap means in this game).
3. **A view**: `state -> HTML text`. The shell puts it on screen; `data-a="name"` attributes become events.
4. **An effect runner**: a `switch` over the game's effects, calling the shell.

Everything else (remembering what is due, streaks, moving progress between phones, picking a voice
clip, counting, working offline) comes from these libraries.

## Libraries

```
core ──┬── srs        spaced repetition
       ├── habit      streaks, daily tallies
       ├── save       save codes, merge rules
       ├── i18n       lookup, coverage, Indian script conversion
       ├── audio      voice packs → what to play
       ├── analytics  signals → anonymous hits, offline queue
       └── pwa        offline file list → service worker text
browser               clock, storage, speaker, sender, run loop   (the only impure part)
```

Libraries depend on `core` and nothing else (checked by `npm run rules`), so an app can take one
without the rest, and any of them can later become its own package without untangling.

### Things that are permanent

- `hash(text)`: voice clips are files named by it.
- Save-code format `<PREFIX>.<base64url(JSON)>`: learners have these written down.
- `CardRecord` as `[box, dueAt, reps, lapses]`: it is inside existing saves.

Changing any of these means a new name alongside the old one.

## Planned: `story`

For games that teach through a serial story (first user: LETS). The model keeps three things apart so
that each can grow without touching the others:

```ts
Curriculum  // what is learned: ordered skills, each a few lines of the target language
Track       // whose life the story follows (one per audience): a scene for every skill
Locale      // the language it is told in: narration, voice, pronunciation in the learner's script

buildEpisode : (Curriculum, Track, Locale, day) -> Result<Episode, Problem[]>
play         : Update<Player, Tap, Effect>      // an episode is a list of beats; no fail state
missing      : (Curriculum, Track[], Locale[]) -> Problem[]   // what is left to write, for CI
```

A new audience is a new `Track`. A new language is a new `Locale`. A new lesson is a new skill, and
`missing` lists exactly which scenes and translations it now needs.
