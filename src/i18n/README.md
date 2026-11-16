# i18n

Teaching in the learner's own language.

- `translate(dict, key, vars)` and `translator(dict)`: lookup with `{holes}`, falling back to the base text.
- `coverage(base, dict)`: what is missing, what is broken (different holes), what is stale. Run it in CI.
- `transliterate(text, from, to)`: rewrite one Indian script in another (Devanagari, Bengali, Gurmukhi,
  Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam), to show pronunciation in a script the learner reads.

```js
import { translator, coverage, transliterate } from 'wildarc-sutra/i18n';

const t = translator(hindi);
t('Day {n}', { n: 3 });
transliterate('ನಮಸ್ಕಾರ', 'kannada', 'odia');   // ନମସ୍କାର
```

Script conversion is letter for letter. Only Devanagari and Odia output has been checked against real
content so far; have a reader of the target script look before publishing anything else.
