// A value or the reason there isn't one. Used instead of throwing, so that
// failure is part of a function's type and callers have to look at it.

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> => (r.ok ? ok(f(r.value)) : r);

export const chain = <T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> => (r.ok ? f(r.value) : r);

export const withDefault = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.value : fallback);

/** All values if every result is ok, otherwise every error. Useful for validators. */
export const collect = <T, E>(rs: ReadonlyArray<Result<T, E>>): Result<readonly T[], readonly E[]> => {
  const errors = rs.flatMap((r) => (r.ok ? [] : [r.error]));
  return errors.length ? err(errors) : ok(rs.flatMap((r) => (r.ok ? [r.value] : [])));
};
