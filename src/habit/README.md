# habit

The daily habit. A streak grows by one for each day in a row, earns a freeze every seventh day, and a
freeze quietly covers one missed day.

```js
import { touch, current, tally, NO_STREAK } from 'wildarc-sutra/habit';

const streak = touch(saved.streak ?? NO_STREAK, today);  // today is a 'YYYY-MM-DD' Day
const shown = current(streak, today);                    // 0 once it has lapsed
const perDay = tally(saved.days, today, 15);             // last 90 days of activity
```
