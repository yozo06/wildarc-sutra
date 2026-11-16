#!/usr/bin/env node
// Writes <root>/sw.js, the offline file list for an app folder.
//   sutra-sw --root app --prefix kk          write it
//   sutra-sw --root app --prefix kk --check  fail if it is out of date (for CI)
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { cacheable, serviceWorker } from '../dist/pwa/index.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const root = resolve(opt('root', 'app'));
const prefix = opt('prefix', '');
if (!prefix) { console.error('usage: sutra-sw --root <app folder> --prefix <short app id> [--check]'); process.exit(2); }

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const assets = cacheable(walk(root).map((p) => relative(root, p)));
const h = createHash('sha256');
for (const f of assets) { h.update(f); h.update(readFileSync(join(root, f))); }
const version = h.digest('hex').slice(0, 12);
const sw = serviceWorker({ prefix, version, assets });
const out = join(root, 'sw.js');
if (args.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== sw) { console.error(out + ' is out of date. Run sutra-sw without --check.'); process.exit(1); }
  console.log(`sw.js is up to date (${assets.length} files, version ${version})`);
} else {
  writeFileSync(out, sw);
  console.log(`wrote ${out}: ${assets.length} files, version ${version}`);
}
