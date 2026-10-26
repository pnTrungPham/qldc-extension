import type { Stats } from '@/lib/api/stats.api';

import { db, now } from './db';

/** Port of PLUGIN Repositories/AuditRepository.php. Takes field names only, never values. */
export async function log(action: string, residentId: number, changed: string[] = []): Promise<void> {
  await db.audit.add({ action, resident_id: residentId, changed_fields: [...changed], created_at: now() });
}

/** The latest actions, newest first, with the resident's name (null once purged). One user, so `user` is ''. */
export async function recent(limit: number): Promise<Stats['recent']> {
  const rows = await db.audit.orderBy('id').reverse().limit(limit).toArray();
  const people = await db.residents.bulkGet(rows.map((row) => row.resident_id));
  return rows.map((row, i) => ({
    action: row.action,
    user: '',
    resident: people[i]?.full_name ?? null,
    changed_fields: row.changed_fields,
    created_at: row.created_at,
  }));
}
