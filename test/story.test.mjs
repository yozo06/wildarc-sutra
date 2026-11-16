import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEpisode, missing, today, begin, play, progress, HINT_AFTER } from '../dist/story/index.js';
import { fold } from '../dist/core/index.js';
import { forAll, gInt, gList, gOneOf, gTuple } from './prop.mjs';

// A two-lesson curriculum, two kinds of learner, two languages.
const curriculum = {
  lines: { hello: { id: 'hello', text: 'Hello' }, name: { id: 'name', text: 'My name is Asha' }, howmuch: { id: 'howmuch', text: 'How much?' } },
  skills: [{ id: 'greet', lines: ['hello', 'name'] }, { id: 'price', lines: ['howmuch'] }],
};
const scene = (place) => ({
  greet: { title: `${place}.greet.title`, beats: [
    { t: 'tell', say: `${place}.greet.1`, art: place },
    { t: 'teach', line: 'hello', who: 'asha' },
    { t: 'choose', ask: 'ask.greeting', answer: 'wave', options: [{ id: 'wave', art: 'wave' }, { id: 'run', art: 'run' }, { id: 'sleep', art: 'sleep' }] },
    { t: 'teach', line: 'name', who: 'asha' },
    { t: 'say', line: 'name' },
  ] },
  price: { title: `${place}.price.title`, beats: [{ t: 'tell', say: `${place}.price.1` }, { t: 'teach', line: 'howmuch' }, { t: 'say', line: 'howmuch' }] },
});
const work = { id: 'work', name: 'track.work', scenes: scene('shop') };
const home = { id: 'home', name: 'track.home', scenes: scene('market') };
const hindi = {
  id: 'hi',
  text: { 'shop.greet.title': 'पहला दिन', 'shop.greet.1': 'आशा दुकान पर पहुँची।', 'shop.price.title': 'कितने का?', 'shop.price.1': 'एक ग्राहक आया।',
    'market.greet.title': 'नया पड़ोस', 'market.greet.1': 'आशा बाज़ार गई।', 'market.price.title': 'सब्ज़ी', 'market.price.1': 'आशा ने टमाटर देखे।', 'ask.greeting': 'आशा क्या करे?' },
  meaning: { hello: 'नमस्ते', name: 'मेरा नाम आशा है', howmuch: 'कितने का है?' },
  sound: { hello: 'हेलो', name: 'माय नेम इज़ आशा', howmuch: 'हाउ मच?' },
};
const odia = { id: 'or', text: { 'shop.greet.title': 'ପ୍ରଥମ ଦିନ', 'shop.greet.1': 'ଆଶା ଦୋକାନରେ ପହଞ୍ଚିଲା।', 'ask.greeting': 'ଆଶା କ’ଣ କରିବ?' }, meaning: { hello: 'ନମସ୍କାର' }, sound: { hello: 'ହେଲୋ' } };

const episode = (track = work, locale = hindi, n = 1) => { const r = buildEpisode(curriculum, track, locale, n); assert.ok(r.ok, JSON.stringify(r.error)); return r.value; };

test('an episode is a skill, dressed by a track, told in a locale', () => {
  const e = episode();
  assert.deepEqual([e.id, e.number, e.skill, e.track, e.locale, e.title], ['work/greet', 1, 'greet', 'work', 'hi', 'पहला दिन']);
  assert.deepEqual(e.steps.map((s) => s.t), ['tell', 'teach', 'choose', 'teach', 'say', 'recap']);
  assert.deepEqual(e.steps[1], { t: 'teach', line: { id: 'hello', text: 'Hello' }, meaning: 'नमस्ते', sound: 'हेलो', who: 'asha' });
  assert.deepEqual(e.steps[5].lines.map((l) => l.line.text), ['Hello', 'My name is Asha'], 'the recap is the lines to take away');
  assert.equal(episode(home).steps[0].text, 'आशा बाज़ार गई।', 'same lesson, a different life');
  assert.equal(episode(home).steps[1].line.text, 'Hello', 'and the same English');
});

test('missing says exactly what is left to write', () => {
  assert.deepEqual(missing(curriculum, [work, home], [hindi]), [], 'Hindi is complete for both tracks');
  const gaps = missing(curriculum, [work, home], [hindi, odia]);
  assert.ok(gaps.every((g) => g.locale === 'or'));
  const said = gaps.map((g) => `${g.track}/${g.skill}: ${g.what}`);
  assert.ok(said.includes('work/greet: no meaning for line "name"'));
  assert.ok(said.includes('work/price: no text for "shop.price.title"'));
  assert.ok(said.includes('home/greet: no text for "market.greet.1"'));
  const noScene = { id: 'farm', name: 'track.farm', scenes: { greet: work.scenes.greet } };
  assert.deepEqual(missing(curriculum, [noScene], [hindi]), [{ track: 'farm', skill: 'price', locale: 'hi', what: 'no scene for this skill' }], 'a new track lists the scenes it still needs');
});

test('a scene that would confuse a learner is refused', () => {
  const broken = (beats) => buildEpisode(curriculum, { id: 'x', name: 'n', scenes: { greet: { title: 'shop.greet.title', beats } } }, hindi, 1);
  const what = (r) => r.error.map((p) => p.what);
  assert.deepEqual(what(broken([{ t: 'say', line: 'hello' }, { t: 'teach', line: 'hello' }, { t: 'teach', line: 'name' }])), ['line "hello" is to be said before it has been taught']);
  assert.deepEqual(what(broken([{ t: 'teach', line: 'hello' }])), ['the scene never teaches line "name"']);
  assert.ok(what(broken([{ t: 'teach', line: 'hello' }, { t: 'teach', line: 'name' }, { t: 'choose', ask: 'ask.greeting', answer: 'zz', options: [{ id: 'a' }] }])).length === 3, 'bad answer, too few options, option with nothing to show');
  assert.ok(what(broken([{ t: 'teach', line: 'nope' }, { t: 'teach', line: 'hello' }, { t: 'teach', line: 'name' }])).includes('unknown line "nope"'));
  assert.equal(buildEpisode(curriculum, work, hindi, 9).ok, false);
});

test('playing: listen, choose, say, recap, finished', () => {
  const e = episode(); const step = play(e);
  let [p, cues] = begin(e);
  assert.deepEqual(cues, [{ t: 'speak', text: 'आशा दुकान पर पहुँची।', lang: 'own' }]); assert.equal(p.ready, true);
  [p, cues] = step(p, { t: 'next' });
  assert.deepEqual(cues, [{ t: 'speak', text: 'Hello', lang: 'target' }, { t: 'speak', text: 'नमस्ते', lang: 'own' }], 'a taught line is heard, then its meaning');
  [p, cues] = step(p, { t: 'next' });
  assert.equal(p.ready, false, 'a choice waits for the learner');
  assert.deepEqual(step(p, { t: 'next' }), [p, []], 'next does nothing until the choice is made');
  [p, cues] = step(p, { t: 'pick', option: 'wave' });
  assert.deepEqual(cues, [{ t: 'cheer' }]); assert.equal(p.ready, true);
  [p] = step(p, { t: 'next' }); [p, cues] = step(p, { t: 'next' });
  assert.deepEqual(cues, [{ t: 'speak', text: 'My name is Asha', lang: 'target' }]); assert.equal(p.ready, false);
  [p, cues] = step(p, { t: 'said' });
  assert.deepEqual([p.spoken, p.ready, cues], [1, true, [{ t: 'cheer' }]]);
  [p, cues] = step(p, { t: 'next' });
  assert.deepEqual(cues.map((c) => c.text), ['Hello', 'My name is Asha']);
  [p, cues] = step(p, { t: 'next' });
  assert.deepEqual(cues, [{ t: 'finished', episode: 'work/greet', slips: 0, spoken: 1 }]); assert.equal(p.done, true);
  assert.equal(progress(p, e), 1);
  assert.deepEqual(step(p, { t: 'next' }), [p, []], 'nothing happens after the end');
});

test('a wrong choice is not a failure: the character tries again, then gets a hint', () => {
  const e = episode(); const step = play(e);
  let [p] = fold(step, begin(e)[0], [{ t: 'next' }, { t: 'next' }]); let cues;
  [p, cues] = step(p, { t: 'pick', option: 'run' });
  assert.deepEqual(cues, [{ t: 'retry' }]); assert.deepEqual([p.at, p.ready, p.slips, p.tried, p.hint], [2, false, 1, ['run'], false]);
  assert.deepEqual(step(p, { t: 'pick', option: 'run' }), [p, []], 'the same wrong option cannot be picked twice');
  assert.deepEqual(step(p, { t: 'pick', option: 'nonsense' }), [p, []]);
  [p] = step(p, { t: 'pick', option: 'sleep' });
  assert.equal(p.hint, true, `after ${HINT_AFTER} wrong tries the right one is pointed out`);
  [p, cues] = step(p, { t: 'pick', option: 'wave' });
  assert.deepEqual([p.ready, p.hint, p.slips, cues], [true, false, 2, [{ t: 'cheer' }]]);
  [p] = step(p, { t: 'next' }); assert.deepEqual([p.at, p.tried, p.hint], [3, [], false], 'the next step starts clean');
});

test('saying a line is optional, and "again" repeats without moving', () => {
  const e = episode(work, hindi, 2); const step = play(e);
  let [p] = fold(step, begin(e)[0], [{ t: 'next' }, { t: 'next' }]);
  assert.deepEqual(step(p, { t: 'again' }), [p, [{ t: 'speak', text: 'How much?', lang: 'target' }]]);
  const [skipped, cues] = step(p, { t: 'skip' });
  assert.deepEqual([skipped.ready, skipped.spoken, cues], [true, 0, []]);
});

test('laws: whatever the learner taps, the story never goes backwards and can always be finished', () => {
  const taps = [{ t: 'next' }, { t: 'again' }, { t: 'said' }, { t: 'skip' }, { t: 'pick', option: 'wave' }, { t: 'pick', option: 'run' }, { t: 'pick', option: 'sleep' }, { t: 'pick', option: 'zz' }];
  forAll(gTuple(gInt(1, 2), gOneOf(work, home), gList(gInt(0, taps.length - 1), 60)), ([n, track, codes]) => {
    const e = episode(track, hindi, n); const step = play(e);
    let [p] = begin(e);
    for (const c of codes) {
      const [next] = step(p, taps[c]);
      assert.ok(next.at >= p.at && next.at < e.steps.length, 'never backwards, never off the end');
      assert.ok(next.slips >= p.slips && next.spoken >= p.spoken);
      assert.ok(!(p.done && !next.done), 'done stays done');
      p = next;
    }
    // From wherever the learner is, the patient path always reaches the end.
    for (let i = 0; i < e.steps.length * 4 && !p.done; i++) {
      const s = e.steps[p.at];
      [p] = step(p, p.ready ? { t: 'next' } : s.t === 'choose' ? { t: 'pick', option: s.answer } : { t: 'skip' });
    }
    assert.equal(p.done, true);
  });
});

test('a serial: one new episode a day', () => {
  assert.deepEqual(today(curriculum, {}, '2026-11-16'), { next: 1, wait: false, seen: [] });
  assert.deepEqual(today(curriculum, { greet: '2026-11-16' }, '2026-11-16'), { next: undefined, wait: true, seen: [1] }, 'the next one opens tomorrow');
  assert.deepEqual(today(curriculum, { greet: '2026-11-16' }, '2026-11-17'), { next: 2, wait: false, seen: [1] });
  assert.deepEqual(today(curriculum, { greet: '2026-11-16' }, '2026-11-16', 'free'), { next: 2, wait: false, seen: [1] }, 'free pace does not wait');
  assert.deepEqual(today(curriculum, { greet: '2026-11-16', price: '2026-11-17' }, '2026-11-18'), { next: undefined, wait: false, seen: [1, 2] });
});
