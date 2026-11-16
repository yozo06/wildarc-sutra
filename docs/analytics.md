# Analytics: what is counted, and what never is

The goal is to learn whether a way of teaching works: do people come back, and where do they stop?
It is not to learn about any person.

## What leaves the phone

Only short names like these, each as one request with nothing attached:

| Name | Sent when | Answers |
|---|---|---|
| `<app>/<lang>/new` | the very first open | how many people tried it |
| `<app>/<lang>/day` | the first open of each day | how much it is used |
| `<app>/<lang>/back/d1`, `d3`, `d7`, `d14`, `d30` | once each, the first time the app is opened on or after that many days since the first open | do people come back |
| `<app>/<lang>/unit/<id>/start` | once, when a unit (episode, lesson, stop) is first started | how far people get |
| `<app>/<lang>/unit/<id>/done` | once, when it is first finished | which units lose people |
| `<app>/<lang>/unit/<id>/quit/<step>` | once, the first time it is left unfinished | where inside a unit people stop |
| `<app>/<lang>/<anything>` | when the app calls `count` | whatever the app decides to ask |

Reading it:

- **Retention at day 7** = `back/d7` ÷ `new`. This is "came back on or after day 7", which is steadier
  than "came back on exactly day 7" when only a few people are testing.
- **Completion of a unit** = `unit/x/done` ÷ `unit/x/start`.
- **Comparing two apps or two languages** = the same ratios under different prefixes.

## What never leaves the phone

- No user id, device id, cookie or fingerprint. sutra does not create one.
- No names, profile data, answers, progress or text the learner typed.
- No timestamps: the server only sees when a request arrived.

"Came back a week later" is worked out on the phone from a small local record (`Meter`: first day, last
day, what was already counted). Only the conclusion is sent.

The counting service still sees what any website sees: the request's IP address and browser name.
GoatCounter says it tells visits apart with a non-identifiable hash of these and uses no cookies; read
its privacy policy before you rely on that. If it is too much for your learners, leave the endpoint
unset and nothing is sent.

## Offline

Hits wait in a queue on the phone (200 at most; the oldest are dropped beyond that) and go out the
next time there is a connection. A hit therefore shows up on the day it was delivered, which may be
later than the day it happened. Counts are right; daily charts can lag.

## Turning it off

Dispatch `{ t: 'opt', on: false }`. The queue is cleared and nothing more is counted until it is
turned back on. Apps should say plainly, in the learner's language, that anonymous counts are
collected, and give a switch.

## Setting up GoatCounter

1. Create a site at https://www.goatcounter.com (the hosted plan is free for reasonable public use).
   You choose a code, for example `lets`.
2. In the app: `const endpoint = analytics.goatcounterEndpoint('lets')`.
3. In the effect runner, on a `send` effect:
   `sendToGoatcounter(endpoint, effect.hits).then((n) => dispatch(n ? { t: 'sent', n } : { t: 'failed' }))`.
4. Open the app once and check that `…/new` appears on the dashboard. A wrong code fails silently,
   because the browser cannot read the reply from another site.

Known limits: GoatCounter counts visitors per name rather than raw requests, so two phones of the same
model on the same Wi-Fi within a few hours can be counted as one; and the hosted plan may limit how
long data is kept, so export what you want to keep.

## Another backend

Write one function that turns a `Hit` into a request (see `src/analytics/goatcounter.ts`, 10 lines) and
one sender in the shell. The meter does not know or care where hits go.
