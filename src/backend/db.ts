import Dexie, { type Table } from 'dexie';

import type { Resident } from '@/lib/api/residents.api';

/** A stored resident: the REST shape plus the folded name that searches match against. */
export type ResidentRow = Resident & { full_name_search: string };

/** Field names only, never values, so no personal data reaches the log (PLUGIN AuditRepository). */
export type AuditRow = { id?: number; action: string; resident_id: number; changed_fields: string[]; created_at: string };

class QldcDb extends Dexie {
  residents!: Table<ResidentRow, number>;
  audit!: Table<AuditRow, number>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('quan-li-dan-cu');
    // ponytail: full scans; add indexes if a ward passes ~20k residents
    this.version(1).stores({ residents: '++id', audit: '++id', meta: 'key' });
  }
}

export const db = new QldcDb();

/** UTC "YYYY-MM-DD HH:MM:SS", as PLUGIN stores it (current_time('mysql', true)). */
export const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * All or nothing across every table. Inside `work`, await only Dexie calls: awaiting anything else
 * (fetch, timers) lets IndexedDB commit the transaction early.
 */
export function transaction<T>(work: () => Promise<T>): Promise<T> {
  // Dexie follows native `await` only when the scope function itself is `async`; a plain arrow that
  // returns a promise loses the transaction after its first await, and later writes escape it.
  return db.transaction('rw', db.residents, db.audit, db.meta, async () => await work());
}
