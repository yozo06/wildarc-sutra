// Teaching through a serial story. Three things are kept apart so each can grow alone:
//
//   Curriculum  what is learned: ordered skills, each a few lines of the target language
//   Track       whose life the story follows (one per kind of learner): a scene for every skill
//   Locale      the language the story is told in: its text, and each line's meaning and sound
//
//   buildEpisode(curriculum, track, locale, n)  ->  an episode ready to play, or what is missing
//   play(episode)                               ->  the step function of the player; it cannot be failed
//
// A new kind of learner is a new Track. A new language is a new Locale. A new lesson is a new
// Skill, and `missing` lists exactly which scenes and translations it still needs.
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { Step as Transition, Update } from '../core/program.js';
import type { Rec } from '../core/fn.js';
import type { Day } from '../core/time.js';

export type Id = string;
/** A key into a Locale's text. Scenes never hold literal text, so they can be told in any language. */
export type Key = string;

/* ---------- what is learned ---------- */

/** Something the learner will be able to say, in the language being learned: "How much?" */
export interface Line {
  readonly id: Id;
  readonly text: string;
}
export interface Skill {
  readonly id: Id;
  /** The lines this skill teaches. */
  readonly lines: readonly Id[];
}
export interface Curriculum {
  readonly lines: Rec<Line>;
  /** In teaching order: skill n is episode n. */
  readonly skills: readonly Skill[];
}

/* ---------- whose life it follows ---------- */

export interface Option {
  readonly id: Id;
  /** A picture to show (an app-defined name). Lets non-readers answer. */
  readonly art?: string;
  readonly label?: Key;
}
/** One moment of a scene. */
export type Beat =
  /** Story, told in the learner's own language. */
  | { readonly t: 'tell'; readonly say: Key; readonly who?: Id; readonly art?: string }
  /** A character uses a line of the target language; the learner hears it and what it means. */
  | { readonly t: 'teach'; readonly line: Id; readonly who?: Id; readonly art?: string }
  /** The learner helps the character choose. A wrong choice only means the character tries again. */
  | { readonly t: 'choose'; readonly ask: Key; readonly options: readonly Option[]; readonly answer: Id }
  /** The learner says a line aloud. Never judged. */
  | { readonly t: 'say'; readonly line: Id };

export interface Scene {
  readonly title: Key;
  readonly beats: readonly Beat[];
}
export interface Track {
  readonly id: Id;
  readonly name: Key;
  /** One scene per skill id. */
  readonly scenes: Rec<Scene>;
}

/* ---------- the language it is told in ---------- */

export interface Locale {
  /** Language tag of the learner's own language, e.g. 'hi'. */
  readonly id: string;
  readonly text: Rec<string>;
  /** Line id -> what the line means, in the learner's language. */
  readonly meaning: Rec<string>;
  /** Line id -> how the line sounds, written in the learner's script. */
  readonly sound: Rec<string>;
}

/* ---------- an episode, ready to play ---------- */

export interface Taught {
  readonly line: Line;
  readonly meaning: string;
  readonly sound: string;
}
export type Step =
  | { readonly t: 'tell'; readonly text: string; readonly who?: Id; readonly art?: string }
  | ({ readonly t: 'teach'; readonly who?: Id; readonly art?: string } & Taught)
  | { readonly t: 'choose'; readonly ask: string; readonly options: ReadonlyArray<{ id: Id; art?: string; label?: string }>; readonly answer: Id }
  | ({ readonly t: 'say' } & Taught)
  /** Added at the end of every episode: the lines to take away today. */
  | { readonly t: 'recap'; readonly lines: readonly Taught[] };

export interface Episode {
  /** '<track>/<skill>', stable, usable as an analytics unit. */
  readonly id: Id;
  readonly number: number;
  readonly skill: Id;
  readonly track: Id;
  readonly locale: string;
  readonly title: string;
  readonly steps: readonly Step[];
}

/** Something still to write or fix, addressed precisely enough to act on. */
export interface Problem {
  readonly track: Id;
  readonly skill: Id;
  readonly locale: string;
  readonly what: string;
}

const opt = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } => (value === undefined ? {} : ({ [key]: value } as { [P in K]?: V }));

/** Episode `n` (from 1) of a track, told in a locale. Either the whole episode or every problem with it. */
export const buildEpisode = (c: Curriculum, track: Track, locale: Locale, n: number): Result<Episode, readonly Problem[]> => {
  const skill = c.skills[n - 1];
  if (!skill) return err([{ track: track.id, skill: '?', locale: locale.id, what: `there is no episode ${n}` }]);
  const problems: Problem[] = [];
  const bad = (what: string): void => { problems.push({ track: track.id, skill: skill.id, locale: locale.id, what }); };
  const text = (key: Key): string => {
    const t = locale.text[key];
    if (t === undefined || t.trim() === '') bad(`no text for "${key}"`);
    return t ?? key;
  };
  const taught = (id: Id): Taught => {
    const line = c.lines[id];
    if (!line) bad(`unknown line "${id}"`);
    const [meaning, sound] = [locale.meaning[id], locale.sound[id]];
    if (line && !meaning) bad(`no meaning for line "${id}"`);
    if (line && !sound) bad(`no sound (pronunciation) for line "${id}"`);
    return { line: line ?? { id, text: id }, meaning: meaning ?? '', sound: sound ?? '' };
  };

  const scene = track.scenes[skill.id];
  if (!scene) return err([{ track: track.id, skill: skill.id, locale: locale.id, what: 'no scene for this skill' }]);
  if (skill.lines.length === 0) bad('the skill teaches no lines');

  const heard = new Set<Id>();
  const steps: Step[] = scene.beats.map((b): Step => {
    switch (b.t) {
      case 'tell':
        return { t: 'tell', text: text(b.say), ...opt('who', b.who), ...opt('art', b.art) };
      case 'teach':
        heard.add(b.line);
        return { t: 'teach', ...taught(b.line), ...opt('who', b.who), ...opt('art', b.art) };
      case 'say':
        if (!heard.has(b.line)) bad(`line "${b.line}" is to be said before it has been taught`);
        return { t: 'say', ...taught(b.line) };
      case 'choose': {
        if (!b.options.some((o) => o.id === b.answer)) bad(`the answer "${b.answer}" is not one of the options`);
        if (b.options.length < 2) bad('a choice needs at least two options');
        if (b.options.some((o) => o.art === undefined && o.label === undefined)) bad('every option needs a picture or a label');
        return { t: 'choose', ask: text(b.ask), answer: b.answer, options: b.options.map((o) => ({ id: o.id, ...opt('art', o.art), ...opt('label', o.label === undefined ? undefined : text(o.label)) })) };
      }
    }
  });
  for (const id of skill.lines) if (!heard.has(id)) bad(`the scene never teaches line "${id}"`);
  const title = text(scene.title);
  if (problems.length) return err(problems);
  return ok({
    id: `${track.id}/${skill.id}`, number: n, skill: skill.id, track: track.id, locale: locale.id, title,
    steps: [...steps, { t: 'recap', lines: skill.lines.map(taught) }],
  });
};

/** Everything still to write: every problem in every episode of every track in every locale. Empty means ready. */
export const missing = (c: Curriculum, tracks: readonly Track[], locales: readonly Locale[]): readonly Problem[] =>
  tracks.flatMap((track) => locales.flatMap((locale) => c.skills.flatMap((_, i) => {
    const built = buildEpisode(c, track, locale, i + 1);
    return built.ok ? [] : built.error;
  })));

/* ---------- which episode is today's ---------- */

export interface Today {
  /** Episode number to play next, or undefined when everything is done or the next one is not out yet. */
  readonly next: number | undefined;
  /** True when the next episode exists but only opens tomorrow. */
  readonly wait: boolean;
  /** Episodes already finished, which can be replayed. */
  readonly seen: readonly number[];
}

/**
 * A serial is one new episode a day. `finished` maps skill id -> the day it was first finished.
 * With pace 'daily' the next episode opens the day after the previous one was finished.
 */
export const today = (c: Curriculum, finished: Rec<Day>, day: Day, pace: 'daily' | 'free' = 'daily'): Today => {
  const seen = c.skills.flatMap((s, i) => (finished[s.id] ? [i + 1] : []));
  const index = c.skills.findIndex((s) => !finished[s.id]);
  if (index < 0) return { next: undefined, wait: false, seen };
  const previous = index > 0 ? finished[c.skills[index - 1]?.id ?? ''] : undefined;
  const wait = pace === 'daily' && previous !== undefined && previous >= day;
  return { next: wait ? undefined : index + 1, wait, seen };
};

/* ---------- playing an episode ---------- */

export interface Player {
  /** Index of the current step. */
  readonly at: number;
  /** True once the current step is complete and the learner may move on. */
  readonly ready: boolean;
  /** Options already tried and found wrong in the current choice. */
  readonly tried: readonly Id[];
  /** True when the right option should be pointed out (after two wrong tries). */
  readonly hint: boolean;
  /** Wrong taps in the whole episode. Kept for the makers, never shown as a score. */
  readonly slips: number;
  /** Lines the learner chose to say aloud. */
  readonly spoken: number;
  readonly done: boolean;
}

export type Tap =
  | { readonly t: 'next' }
  | { readonly t: 'pick'; readonly option: Id }
  /** The learner said the line aloud. */
  | { readonly t: 'said' }
  /** The learner would rather not say it. That is allowed. */
  | { readonly t: 'skip' }
  /** Hear the current step again. */
  | { readonly t: 'again' };

/** What the shell should do: speak, celebrate, show the character trying again, or close the episode. */
export type Cue =
  | { readonly t: 'speak'; readonly text: string; readonly lang: 'own' | 'target' }
  | { readonly t: 'cheer' }
  | { readonly t: 'retry' }
  | { readonly t: 'finished'; readonly episode: Id; readonly slips: number; readonly spoken: number };

/** How many wrong tries before the right option is pointed out. */
export const HINT_AFTER = 2;

const voice = (step: Step | undefined): readonly Cue[] => {
  if (!step) return [];
  switch (step.t) {
    case 'tell': return [{ t: 'speak', text: step.text, lang: 'own' }];
    case 'teach': return [{ t: 'speak', text: step.line.text, lang: 'target' }, { t: 'speak', text: step.meaning, lang: 'own' }];
    case 'choose': return [{ t: 'speak', text: step.ask, lang: 'own' }];
    case 'say': return [{ t: 'speak', text: step.line.text, lang: 'target' }];
    case 'recap': return step.lines.map((l): Cue => ({ t: 'speak', text: l.line.text, lang: 'target' }));
  }
};
/** Steps that only need listening are ready at once; a choice or a line to say waits for the learner. */
const readyOnArrival = (step: Step | undefined): boolean => !step || step.t === 'tell' || step.t === 'teach' || step.t === 'recap';
const arrive = (at: number, e: Episode, p: Player): Player => ({ ...p, at, ready: readyOnArrival(e.steps[at]), tried: [], hint: false });

/** The first state of an episode, with the cue to speak its first step. */
export const begin = (e: Episode): Transition<Player, Cue> => [
  arrive(0, e, { at: 0, ready: false, tried: [], hint: false, slips: 0, spoken: 0, done: e.steps.length === 0 }),
  voice(e.steps[0]),
];

/** The player's step function. Every tap either moves the story on or changes nothing: there is no way to lose. */
export const play = (e: Episode): Update<Player, Tap, Cue> => (p, tap) => {
  const step = e.steps[p.at];
  if (p.done || !step) return [p, []];
  switch (tap.t) {
    case 'again':
      return [p, voice(step)];
    case 'next': {
      if (!p.ready) return [p, []];
      if (p.at + 1 >= e.steps.length) return [{ ...p, done: true }, [{ t: 'finished', episode: e.id, slips: p.slips, spoken: p.spoken }]];
      return [arrive(p.at + 1, e, p), voice(e.steps[p.at + 1])];
    }
    case 'pick': {
      if (step.t !== 'choose' || p.ready || p.tried.includes(tap.option) || !step.options.some((o) => o.id === tap.option)) return [p, []];
      if (tap.option === step.answer) return [{ ...p, ready: true, hint: false }, [{ t: 'cheer' }]];
      const tried = [...p.tried, tap.option];
      return [{ ...p, tried, slips: p.slips + 1, hint: tried.length >= HINT_AFTER }, [{ t: 'retry' }]];
    }
    case 'said':
      return step.t === 'say' && !p.ready ? [{ ...p, ready: true, spoken: p.spoken + 1 }, [{ t: 'cheer' }]] : [p, []];
    case 'skip':
      return step.t === 'say' && !p.ready ? [{ ...p, ready: true }, []] : [p, []];
  }
};

/** How far through the episode the learner is, from 0 to 1. */
export const progress = (p: Player, e: Episode): number => (e.steps.length === 0 || p.done ? 1 : p.at / e.steps.length);
