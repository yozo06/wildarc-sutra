import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheable, serviceWorker } from '../dist/pwa/index.js';

test('offline shell: lists the app files, leaves voice clips to be cached on first play', () => {
  const files = cacheable(['index.html', 'js\\main.js', 'audio/manifest.json', 'audio/kn/e0bbc62d.mp3', 'sw.js', 'notes.md', 'css/app.css']);
  assert.deepEqual(files, ['audio/manifest.json', 'css/app.css', 'index.html', 'js/main.js']);
  const sw = serviceWorker({ prefix: 'kk', version: 'abc123', assets: files });
  assert.match(sw, /const VERSION = "abc123";/); assert.match(sw, /const PREFIX = "kk";/);
  assert.match(sw, /"\.\/","audio\/manifest\.json","css\/app\.css","index\.html","js\/main\.js"/);
  assert.doesNotThrow(() => new Function('self', 'caches', 'location', 'fetch', sw)({ addEventListener() {} }, {}, {}, () => {}), 'the generated file is valid JavaScript');
  assert.equal(serviceWorker({ prefix: 'kk', version: 'abc123', assets: files }), sw, 'same input, same file');
});
