// Key-value storage on the device. Falls back to memory when the browser blocks
// storage (private windows, embedded frames), so the app still runs for the session.

export interface Store {
  readonly get: (key: string) => string | null;
  readonly set: (key: string, value: string) => void;
  readonly del: (key: string) => void;
}

export const localStore = (prefix = ''): Store => {
  const mem = new Map<string, string>();
  return {
    get(key) {
      const k = prefix + key;
      try {
        const v = localStorage.getItem(k);
        if (v != null) return v;
      } catch { /* blocked */ }
      return mem.get(k) ?? null;
    },
    set(key, value) {
      const k = prefix + key;
      mem.set(k, value);
      try { localStorage.setItem(k, value); } catch { /* blocked */ }
    },
    del(key) {
      const k = prefix + key;
      mem.delete(k);
      try { localStorage.removeItem(k); } catch { /* blocked */ }
    },
  };
};

/** Read JSON, or `fallback` if it is missing or damaged. */
export const readJson = <T>(store: Store, key: string, fallback: T): T => {
  try {
    const raw = store.get(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writeJson = (store: Store, key: string, value: unknown): void => store.set(key, JSON.stringify(value));
