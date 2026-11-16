// Plays what sutra/audio planned: a recorded clip, or the device's own voice.
import { readManifest, NO_VOICES } from '../audio/index.js';
import type { Playback, Voices } from '../audio/index.js';

/** Fetch and read audio/manifest.json. No manifest means no recorded voices. */
export const loadVoices = async (url = 'audio/manifest.json', legacy?: { id: string; label: string }): Promise<Voices> => {
  try {
    const res = await fetch(url);
    return res.ok ? readManifest(await res.json(), legacy) : NO_VOICES;
  } catch {
    return NO_VOICES;
  }
};

/** The device's built-in voice for a language tag such as 'kn', 'hi' or 'en', if it has one. */
export const deviceVoice = (lang: string): SpeechSynthesisVoice | null => {
  try {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase() + '-')) ?? voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ?? null;
  } catch {
    return null;
  }
};

export interface Speaker {
  /** Say it. Resolves when the sound ends (or at once if there is nothing to play). */
  readonly play: (p: Playback) => Promise<void>;
  readonly stop: () => void;
}

/** One speaker per app: starting a new sound stops the previous one. */
export const speaker = (lang: string, rate = 0.85): Speaker => {
  let current: HTMLAudioElement | null = null;
  const stop = (): void => {
    try { current?.pause(); window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    current = null;
  };
  const speak = (text: string): Promise<void> =>
    new Promise((resolve) => {
      const voice = deviceVoice(lang);
      if (!voice) return resolve();
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/[\u200c\u200d]/g, ''));
        u.voice = voice; u.lang = voice.lang; u.rate = rate;
        u.onend = () => resolve(); u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  const play = (p: Playback): Promise<void> => {
    stop();
    if (p.t === 'silent') return Promise.resolve();
    if (p.t === 'voice') return speak(p.text);
    return new Promise((resolve) => {
      const a = new Audio(p.url);
      current = a;
      a.onended = () => resolve();
      a.onerror = () => { void speak(p.text).then(resolve); };
      a.play().catch(() => { void speak(p.text).then(resolve); });
    });
  };
  return { play, stop };
};
