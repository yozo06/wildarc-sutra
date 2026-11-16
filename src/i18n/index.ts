// Teaching in the learner's own language. A dictionary maps a key to text;
// everything here is lookup and checking, with no global "current language".
import type { Rec } from '../core/fn.js';

export * from './indic.js';

export type Dict = Rec<string>;
export type Vars = Rec<string | number>;

/** Replace {name} holes in a template. Unknown holes are left as they are. */
export const fill = (template: string, vars?: Vars): string =>
  vars ? template.replace(/\{([a-zA-Z0-9_]+)\}/g, (hole, name: string) => (name in vars ? String(vars[name]) : hole)) : template;

/** Text for a key, falling back to `fallback` (by default the key itself). */
export const translate = (dict: Dict, key: string, vars?: Vars, fallback: string = key): string => {
  const hit = dict[key];
  return fill(hit !== undefined && hit.trim() !== '' ? hit : fallback, vars);
};

/** A translator bound to one dictionary: `const t = translator(hi); t('Start')`. */
export const translator = (dict: Dict) => (key: string, vars?: Vars, fallback?: string): string =>
  translate(dict, key, vars, fallback);

/** The {holes} in a string, sorted. */
export const holes = (s: string): readonly string[] => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).slice().sort();

export interface Coverage {
  readonly total: number;
  readonly have: number;
  /** Keys with no translation; the app shows the base text for these. */
  readonly missing: readonly string[];
  /** Keys whose translation has different {holes} from the base text. These are bugs. */
  readonly broken: readonly string[];
  /** Keys in the translation that the base no longer has. */
  readonly unknown: readonly string[];
}

/** How completely `dict` translates `base`. */
export const coverage = (base: Dict, dict: Dict): Coverage => {
  const keys = Object.keys(base);
  const has = (k: string): boolean => (dict[k] ?? '').trim() !== '';
  return {
    total: keys.length,
    have: keys.filter(has).length,
    missing: keys.filter((k) => !has(k)),
    broken: keys.filter((k) => has(k) && holes(base[k] ?? '').join() !== holes(dict[k] ?? '').join()),
    unknown: Object.keys(dict).filter((k) => !(k in base)),
  };
};
