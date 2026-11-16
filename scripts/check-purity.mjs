#!/usr/bin/env node
// The rule that makes sutra testable: outside src/browser nothing may read the clock,
// roll dice or touch the device. The type check (tsconfig.pure.json) already removes
// window/document/fetch/localStorage; this catches what the language itself allows.
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
for (const file of walk(src)) {
  const rel = relative(src, file).split('\\').join('/');
  if (rel.startsWith('browser/') || !rel.endsWith('.ts')) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const [re, why] of BANNED) if (re.test(code)) problems.push(`src/${rel}:${i + 1} ${why}\n    ${line.trim()}`);
  });
}
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} purity problem(s)`); process.exit(1); }
console.log('pure: nothing outside src/browser reads the clock, rolls dice or touches the device');
