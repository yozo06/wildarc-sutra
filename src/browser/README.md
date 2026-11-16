# browser

The shell: the only code in the collection that touches the device. Everything else is pure and hands
its wishes to this as data.

| Export | Does |
|---|---|
| `start({ program, run, after })` | runs a program: event, update, draw, carry out effects, repeat |
| `onActions(root, toEvent, dispatch)` | turns taps on `data-a="…"` elements into events |
| `readClock()`, `freshSeed()` | the only places time and chance come in |
| `localStore(prefix)`, `readJson`, `writeJson` | storage, with a memory fallback when the browser blocks it |
| `loadVoices()`, `speaker(lang)` | fetch the voice manifest; play what `audio.plan` chose |
| `sendToGoatcounter(endpoint, hits)` | deliver queued analytics hits |
| `esc` | make text safe inside HTML |

A complete small app: [examples/hello](../../examples/hello/index.html).
