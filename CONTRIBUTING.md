# Contributing

Thank you for looking. sutra is small on purpose; these are the rules that keep it that way.

## The rules

1. **Pure outside the shell.** Code outside `src/browser` takes values and returns values. It does not
   read the clock, roll dice, store, fetch, log or schedule. Need the time? Take `now` or a `Clock`.
   Need chance? Take a `Seed`, return the next one. Need something done? Return an effect.
   `npm run pure` enforces this.
2. **Data stays unchanged.** Return new values; do not modify arguments. (Building a local array inside
   a function and returning it is fine.)
3. **Failure is a value.** Return a `Result` instead of throwing for anything a learner's data or a
   pasted code could cause.
4. **No dependencies.** If you need thirty lines, write thirty lines.
5. **Stable names.** Clip ids (`hash`) and save-code formats are permanent: learners' audio files and
   saved progress depend on them. A change there needs a new name, not a new meaning.
6. **Every part has tests**, and anything with a law (round trips, merges, "twice is the same as once")
   has a property test in the style of `test/prop.mjs`.

## What helps most

- A game built on sutra. Tell us what was missing or awkward.
- Script conversion tables for more Indian scripts in `src/i18n/indic.ts`, checked by someone who reads the script.
- Adapters: another analytics backend next to `src/analytics/goatcounter.ts`; another storage in `src/browser`.

## Before a pull request

```sh
npm run check
```

Keep pull requests small and say what a learner or a game author gains. Be kind in reviews and issues.
