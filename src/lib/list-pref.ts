import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * A "which of these do I want to see" preference, kept in this browser's localStorage like the theme: it is how
 * the app looks, not residents' data, so it is not in backups. `parse` reads the saved JSON, `use` is the hook.
 */
export function listPref<T extends string>(key: string, all: readonly T[], defaults: readonly T[]) {
  const changed = `${key}-changed`;

  /** The saved choice as ids in the order of `all`; the defaults when there is none or it is damaged. */
  function parse(raw: string | null): T[] {
    if (raw === null) return [...defaults];
    try {
      const saved: unknown = JSON.parse(raw);
      return Array.isArray(saved) ? all.filter((id) => saved.includes(id)) : [...defaults];
    } catch {
      return [...defaults];
    }
  }

  const read = () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // blocked storage: the defaults, and nothing sticks
    }
  };

  function subscribe(callback: () => void) {
    window.addEventListener('storage', callback); // another tab
    window.addEventListener(changed, callback); // this tab
    return () => {
      window.removeEventListener('storage', callback);
      window.removeEventListener(changed, callback);
    };
  }

  /** The ids to show, and a way to change them (`null` goes back to the defaults). Shared by every component using it. */
  function use(): [T[], (ids: T[] | null) => void] {
    const raw = useSyncExternalStore(subscribe, read);
    const ids = useMemo(() => parse(raw), [raw]);
    const set = useCallback((next: T[] | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage is blocked: the choice cannot stick in this browser
      }
      window.dispatchEvent(new Event(changed));
    }, []);
    return [ids, set];
  }

  return { parse, use };
}
