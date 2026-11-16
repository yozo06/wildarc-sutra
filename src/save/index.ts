// Moving progress between devices without a server: a save code is one line of text
// the learner can copy, and merging two saves keeps the better of each field.
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { Rec } from '../core/fn.js';

/* ---------- text <-> base64url, with no platform APIs ---------- */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const utf8Encode = (s: string): readonly number[] => {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
};

export const utf8Decode = (bytes: readonly number[]): string => {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i] ?? 0;
    const more = b < 0x80 ? 0 : b < 0xe0 ? 1 : b < 0xf0 ? 2 : 3;
    let c = more === 0 ? b : b & (0x3f >> more);
    for (let k = 1; k <= more; k++) c = (c << 6) | ((bytes[i + k] ?? 0) & 63);
    out += String.fromCodePoint(c);
    i += more + 1;
  }
  return out;
};

export const toBase64Url = (bytes: readonly number[]): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i] ?? 0, bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET.charAt(n >> 18) + ALPHABET.charAt((n >> 12) & 63);
    if (b !== undefined) out += ALPHABET.charAt((n >> 6) & 63);
    if (c !== undefined) out += ALPHABET.charAt(n & 63);
  }
  return out;
};

export const fromBase64Url = (text: string): readonly number[] => {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return out;
};

/* ---------- save codes ---------- */

/** A value as one line of text: "<prefix>.<base64url of its JSON>", e.g. "KK1.eyJ4cCI6…". */
export const encodeCode = (prefix: string, value: unknown): string =>
  prefix + '.' + toBase64Url(utf8Encode(JSON.stringify(value)));

export type CodeError = 'no-code' | 'unreadable';

/** Find and read a save code anywhere in pasted text. Spaces and line breaks are ignored. */
export const decodeCode = (prefix: string, pasted: string): Result<unknown, CodeError> => {
  const text = String(pasted).replace(/\s+/g, '');
  const at = text.indexOf(prefix + '.');
  if (at < 0) return err('no-code');
  const body = /^[A-Za-z0-9_-]+/.exec(text.slice(at + prefix.length + 1));
  if (!body) return err('no-code');
  try {
    return ok(JSON.parse(utf8Decode(fromBase64Url(body[0]))) as unknown);
  } catch {
    return err('unreadable');
  }
};

/* ---------- merging two saves ---------- */

/** Combines two versions of a value into one. Build big merges out of small ones. */
export type Merge<T> = (a: T, b: T) => T;

/** The larger number. */
export const max: Merge<number> = (a, b) => (b > a ? b : a);

/** The later of two sortable strings, such as 'YYYY-MM-DD' days. */
export const latest: Merge<string> = (a, b) => (b > a ? b : a);

/** Keep ours; take theirs only where we have nothing. */
export const ours = <T>(): Merge<T> => (a, b) => (a === undefined || a === null ? b : a);

/** Whichever scores higher; ours on a tie. */
export const prefer = <T>(score: (t: T) => number): Merge<T> => (a, b) => (score(b) > score(a) ? b : a);

/** Position by position, for fixed-length tuples such as [stars, plays]. */
export const each = <T>(m: Merge<T>): Merge<readonly T[]> => (a, b) =>
  Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
    const [x, y] = [a[i], b[i]];
    return x === undefined ? (y as T) : y === undefined ? x : m(x, y);
  });

/** Every key from both records; values present on both sides are merged. */
export const record = <T>(m: Merge<T>, keep: (key: string) => boolean = () => true): Merge<Rec<T>> => (a, b) => {
  const out: Record<string, T> = {};
  for (const k of Object.keys(a)) if (keep(k)) out[k] = a[k] as T;
  for (const k of Object.keys(b)) {
    if (!keep(k)) continue;
    const [x, y] = [out[k], b[k] as T];
    out[k] = x === undefined ? y : m(x, y);
  }
  return out;
};

/** Field by field. Fields without a rule keep our side. */
export const struct = <T extends object>(rules: { readonly [K in keyof T]?: Merge<T[K]> }): Merge<T> => (a, b) => {
  const out = { ...a };
  for (const k of Object.keys(rules) as Array<keyof T>) {
    const m = rules[k];
    if (!m) continue;
    const [x, y] = [a[k], b[k]];
    out[k] = x === undefined ? y : y === undefined ? x : m(x, y);
  }
  return out;
};

/** Fill in whatever a save from an older version lacks, one level deep. */
export const withDefaults = <T extends object>(defaults: T, saved: unknown): T => {
  if (!saved || typeof saved !== 'object') return defaults;
  const s = saved as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  for (const [k, d] of Object.entries(defaults)) {
    const v = s[k];
    const plain = (x: unknown): x is object => !!x && typeof x === 'object' && !Array.isArray(x);
    out[k] = v === undefined || v === null ? d : plain(d) ? (plain(v) ? { ...d, ...v } : d) : v;
  }
  return out as T;
};
