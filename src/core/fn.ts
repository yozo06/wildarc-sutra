// Composition helpers. Everything in sutra is a function from values to values;
// these are the joints that chain them.

/** Left-to-right application: pipe(x, f, g) is g(f(x)). */
export function pipe<A>(a: A): A;
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
export function pipe<A, B, C, D, E>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D, de: (d: D) => E): E;
export function pipe<A, B, C, D, E, F>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D, de: (d: D) => E, ef: (e: E) => F): F;
export function pipe(a: unknown, ...fns: ReadonlyArray<(x: unknown) => unknown>): unknown {
  return fns.reduce((x, f) => f(x), a);
}

export const identity = <A>(a: A): A => a;

/** A plain string-keyed record that nobody mutates. */
export type Rec<T> = Readonly<Record<string, T>>;

/** Own keys of a record, typed. */
export const keys = <T>(r: Rec<T>): readonly string[] => Object.keys(r);

/** A copy of `r` with `key` set to `value`. */
export const assoc = <T>(r: Rec<T>, key: string, value: T): Rec<T> => ({ ...r, [key]: value });

/** A copy of `r` holding only the entries that pass `keep`. */
export const filterRec = <T>(r: Rec<T>, keep: (value: T, key: string) => boolean): Rec<T> =>
  Object.fromEntries(Object.entries(r).filter(([k, v]) => keep(v, k)));

/** A copy of `r` with every value passed through `f`. */
export const mapRec = <T, U>(r: Rec<T>, f: (value: T, key: string) => U): Rec<U> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, f(v, k)]));
