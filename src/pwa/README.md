# pwa

Makes a folder of static files work with no network. `serviceWorker(options)` returns the text of
`sw.js`: app files are kept on install, voice clips the first time each is heard.

`imports` adds scripts of your own to the service worker, for example a handler that shows a reminder.

Usually used through the command:

```sh
npx sutra-sw --root app --prefix myapp          # write app/sw.js
npx sutra-sw --root app --prefix myapp --check  # fail if it is out of date
```
