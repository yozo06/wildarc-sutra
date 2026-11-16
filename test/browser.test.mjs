import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, esc } from '../dist/browser/runtime.js';

test('runtime: events are handled in order, effects run, and effects can raise events', () => {
  const seen = [];
  const program = {
    init: [{ n: 0, log: [] }, ['hello']],
    update: (s, e) => e.t === 'inc' ? [{ ...s, n: s.n + 1 }, s.n + 1 === 2 ? ['double'] : []] : e.t === 'add' ? [{ ...s, n: s.n + e.by }, []] : [s, []],
  };
  const app = start({
    program,
    run: (effect, dispatch, state) => { seen.push(`run ${effect} at ${state.n}`); if (effect === 'double') dispatch({ t: 'add', by: state.n }); },
    after: (state) => seen.push(`draw ${state.n}`),
  });
  app.dispatch({ t: 'inc' }); app.dispatch({ t: 'inc' }); app.dispatch({ t: 'noop' });
  assert.equal(app.state().n, 4);
  assert.deepEqual(seen, ['draw 0', 'run hello at 0', 'draw 1', 'draw 2', 'run double at 2', 'draw 4', 'draw 4']);
});

test('esc makes text safe to put in HTML', () => {
  assert.equal(esc('<b a="1">Tom & \'Jerry\'</b>'), '&lt;b a=&quot;1&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;');
  assert.equal(esc(null), ''); assert.equal(esc(5), '5');
});
