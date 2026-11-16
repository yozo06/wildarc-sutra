#!/usr/bin/env node
// The two rules that keep this collection usable, checked on every push.
//
// 1. Pure: outside src/browser nothing reads the clock, rolls dice or touches the device.
//    (The type check in tsconfig.pure.json already removes window/document/fetch/localStorage;
//    this catches what the language itself allows.)
// 2. Independent: a library imports only from itself and from core. So any library can be
//    used alone, or lifted out into its own package later, without untangling anything.
//    The shell (src/browser) and the root index may import any library.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const BANNED = [
  [/\bDate\.now\s*\(/, 'reads the clock (take `now` or a Clock as an argument)'],
  [/\bnew Date\s*\(\s*\)/, 'reads the clock (take `now` or a Clock as an argument)'],
  [/\bMath\.random\s*\(/, 'rolls hidden dice (take a Seed and return the next one)'],
  [/\bconsole\./, 'writes to the console'],
  [/\b(setTimeout|setInterval)\s*\(/, 'schedules work (return an effect instead)'],
];
const problems = [];
const libraries = readdirSync(src).filter((n) => statSync(join(src, n)).isDirectory());
for (const file of walk(src)) {
  const rel = relative(src, file).split('\\').join('/');
  if (!rel.endsWith('.ts') || !rel.includes('/')) continue;
  const lib = rel.split('/')[0];
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (lib !== 'browser') for (const [re, why] of BANNED) if (re.test(code)) problems.push(`src/${rel}:${i + 1} ${why}\n    ${line.trim()}`);
    const imp = /from\s+'(\.\.\/[^']+)'/.exec(code);
    if (imp && lib !== 'browser') {
      const target = imp[1].split('/')[1];
      if (target !== 'core') problems.push(`src/${rel}:${i + 1} library "${lib}" imports from "${target}"; a library may import only from itself and core\n    ${line.trim()}`);
    }
  });
}
for (const lib of libraries) {
  try { statSync(join(src, lib, 'README.md')); } catch { problems.push(`src/${lib}/ has no README.md: every library says what it is for`); }
}
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`rules ok: ${libraries.length} libraries, pure outside src/browser, each importing only itself and core`);
