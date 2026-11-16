# save

Progress without a server.

- **Save codes**: any value as one line of text (`KK1.eyJ4cCI6…`) that a learner can copy between phones.
- **Merge rules**: small functions (`max`, `latest`, `prefer`, `record`, `struct`) that combine into the
  rule for merging two saves, so that importing a code never loses progress and is safe to repeat.
- **`withDefaults`**: fill in what a save from an older version lacks.

```js
import { encodeCode, decodeCode, struct, record, max, prefer } from 'wildarc-sutra/save';

const merge = struct({ xp: max, cards: record(prefer((card) => card[2])) });
const code = encodeCode('KK1', state);
const back = decodeCode('KK1', pastedText);   // Result: { ok: true, value } or { ok: false, error }
```

The code format is permanent: learners have codes written down.
