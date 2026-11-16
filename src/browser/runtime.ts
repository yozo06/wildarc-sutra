// The loop that turns a pure program into a running app:
//   event -> update -> new state -> draw, then carry out the effects,
//   which may produce more events.
import type { Program } from '../core/program.js';

export interface AppSpec<S, E, F> {
  readonly program: Program<S, E, F>;
  /** Carry out one effect. Call `dispatch` to report what happened. */
  readonly run: (effect: F, dispatch: (event: E) => void, state: S) => void;
  /** Called after every step with the new state: draw the screen, save, and so on. */
  readonly after?: (state: S, dispatch: (event: E) => void) => void;
}

export interface App<S, E> {
  readonly dispatch: (event: E) => void;
  readonly state: () => S;
}

/** Start a program. Events dispatched while a step is running are queued and handled in order. */
export const start = <S, E, F>(spec: AppSpec<S, E, F>): App<S, E> => {
  let [state, pending] = [spec.program.init[0], [...spec.program.init[1]]];
  const inbox: E[] = [];
  let busy = false;

  const drain = (): void => {
    if (busy) return;
    busy = true;
    try {
      for (;;) {
        const effect = pending.shift();
        if (effect !== undefined) { spec.run(effect, dispatch, state); continue; }
        const event = inbox.shift();
        if (event === undefined) break;
        const [next, effects] = spec.program.update(state, event);
        state = next;
        pending.push(...effects);
        spec.after?.(state, dispatch);
      }
    } finally {
      busy = false;
    }
  };
  const dispatch = (event: E): void => { inbox.push(event); drain(); };

  spec.after?.(state, dispatch);
  drain();
  return { dispatch, state: () => state };
};

/**
 * Turn taps into events. Any element with data-a="<name>" becomes an action; the
 * element's other data-* values come along. Return undefined to ignore a tap.
 */
export const onActions = <E>(
  root: HTMLElement,
  toEvent: (name: string, data: DOMStringMap, target: HTMLElement) => E | undefined,
  dispatch: (event: E) => void
): (() => void) => {
  const handler = (ev: Event): void => {
    const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-a]');
    if (!el || !root.contains(el)) return;
    const event = toEvent(el.dataset['a'] ?? '', el.dataset, el);
    if (event !== undefined) dispatch(event);
  };
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
};

/** Escape text for use inside HTML. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
