# analytics

Anonymous counts that answer "do people come back, and where do they stop?" without identifying anyone.
No ids, no cookies. The phone works out facts like "came back a week later" from a small local record
and sends only the name of the fact, e.g. `lets/hi/back/d7`. Hits queue while offline.

```js
import { meter, NEW_METER, goatcounterEndpoint } from 'wildarc-sutra/analytics';

const count = meter({ app: 'lets', lang: 'hi' });
const [next, effects] = count(saved ?? NEW_METER, { t: 'open', day: today });
// effects: [{ t: 'send', hits: [{ name: 'lets/hi/new' }, { name: 'lets/hi/day' }] }]
```

Everything that is counted, and everything that never is: [docs/analytics.md](../../docs/analytics.md).
