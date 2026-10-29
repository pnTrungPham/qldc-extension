import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Columns of the residents table the user can show or hide, in table order. The name is always shown. */
export const COLUMN_IDS = [
  'birth_year', 'gender', 'relation', 'address', 'phone', 'occupation', 'residence_status', 'verify_status',
  'policy_tags', 'bhyt_number', 'exam', 'exam_date', 'exam_place', 'note',
] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

/** What the table showed before the choice existed. */
export const DEFAULT_COLUMNS: ColumnId[] = ['birth_year', 'relation', 'address', 'phone', 'residence_status', 'exam'];

const KEY = 'qldc-resident-columns';
const CHANGED = 'qldc-columns-changed';

/** The saved choice (JSON text) as column ids in table order; the defaults when there is none or it is damaged. */
export function parseColumns(raw: string | null): ColumnId[] {
  if (raw === null) return DEFAULT_COLUMNS;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return DEFAULT_COLUMNS;
    return COLUMN_IDS.filter((id) => saved.includes(id));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

// Per browser, not part of the residents' data (so not in backups): like the theme, it lives in localStorage.
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // blocked storage: the defaults, and nothing sticks
  }
};

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback); // another tab
  window.addEventListener(CHANGED, callback); // this tab
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGED, callback);
  };
}

/** The columns to show, and a way to change them (`null` goes back to the defaults). Shared by every component using it. */
export function useColumns(): [ColumnId[], (ids: ColumnId[] | null) => void] {
  const raw = useSyncExternalStore(subscribe, read);
  const columns = useMemo(() => parseColumns(raw), [raw]);
  const set = useCallback((ids: ColumnId[] | null) => {
    try {
      if (ids === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // storage is blocked: the choice cannot stick in this browser
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [columns, set];
}
