// The shape every moving part takes: a pure step function.
//
//   update : (state, event) -> [next state, effects]
//
// An effect is a description of something to do in the world (play a sound, save,
// send a count). Nothing in the core performs one; the shell (sutra/browser) does,
// and reports back with more events. A whole app is updates chained together.

/** The outcome of one step: the next state and the effects it asks for. */
export type Step<S, F> = readonly [state: S, effects: readonly F[]];

export type Update<S, E, F> = (state: S, event: E) => Step<S, F>;

export interface Program<S, E, F> {
  readonly init: Step<S, F>;
  readonly update: Update<S, E, F>;
}

/** A step that changes state and asks for nothing. */
export const just = <S>(state: S): Step<S, never> => [state, []];

/** Replay a list of events from a starting state. State is always a fold over what happened. */
export const fold = <S, E, F>(update: Update<S, E, F>, start: S, events: readonly E[]): Step<S, F> =>
  events.reduce<Step<S, F>>(
    ([s, fx], e) => {
      const [s2, f2] = update(s, e);
      return [s2, [...fx, ...f2]];
    },
    [start, []]
  );

/** Run several updates on the same event, in order, gathering their effects. */
export const sequence = <S, E, F>(...updates: ReadonlyArray<Update<S, E, F>>): Update<S, E, F> =>
  (state, event) => fold((s: S, u: Update<S, E, F>) => u(s, event), state, updates);

/** Lift an update on a part into an update on the whole (get the part out, put it back). */
export const embed = <S, T, E, F>(
  get: (whole: S) => T,
  set: (whole: S, part: T) => S,
  inner: Update<T, E, F>
): Update<S, E, F> => (whole, event) => {
  const [part, fx] = inner(get(whole), event);
  return [set(whole, part), fx];
};

/** Feed an update only the events it understands; others pass through untouched. */
export const only = <S, E, E2, F>(select: (event: E) => E2 | undefined, inner: Update<S, E2, F>): Update<S, E, F> =>
  (state, event) => {
    const e2 = select(event);
    return e2 === undefined ? [state, []] : inner(state, e2);
  };

/** Let a pure onlooker see each transition and add effects of its own (this is how analytics plugs in). */
export const observe = <S, E, F, G>(
  update: Update<S, E, F>,
  watch: (before: S, event: E, after: S) => readonly G[]
): Update<S, E, F | G> => (state, event) => {
  const [after, fx] = update(state, event);
  return [after, [...fx, ...watch(state, event, after)]];
};
