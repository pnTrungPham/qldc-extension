import type { ApiError } from '@/lib/api/client';
import type { BackupFile, BackupOptions, BackupStatus, BackupSummary } from '@/lib/api/backup.api';
import { fold } from '@/lib/fold';
import { i18n } from '@/lib/i18n';

import { db, now, transaction, type AuditRow, type ResidentRow } from './db';
import { isInvalid, sanitize, type Invalid } from './resident';
import { getSettings } from './settings';

/** Backup content: a snapshot of every table, validated on the way back in. */

const BEFORE_RESTORE = 'before-restore';

const bad = (): Invalid => ({ error: i18n.__('This is not a backup file, or it is damaged.', 'quan-li-dan-cu') });
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isString = (x: unknown): x is string => typeof x === 'string';

const summarize = (date: string, rows: Array<{ deleted_at: string | null; household_code: string }>): BackupSummary => {
  const live = rows.filter((row) => row.deleted_at === null);
  return { date, households: new Set(live.map((row) => row.household_code).filter(Boolean)).size, people: live.length };
};

/** Reads outside any transaction of its own, so restore can call it inside its write transaction. */
async function read(): Promise<BackupFile> {
  const [rows, audit, settings] = await Promise.all([db.residents.toArray(), db.audit.toArray(), getSettings()]);
  const residents = rows.map(({ full_name_search: _, ...row }) => row);
  const { date, ...counts } = summarize(now(), residents);
  return { format: 'qldc-backup', version: 1, created_at: date, counts, residents, audit, settings };
}

export const snapshot = (): Promise<BackupFile> => db.transaction('r', db.residents, db.audit, db.meta, read);

type Checked = { file: BackupFile; rows: ResidentRow[] };

function check(input: unknown): Checked | Invalid {
  if (!isObject(input) || input.format !== 'qldc-backup' || input.version !== 1) return bad();
  const { residents, audit, settings } = input;
  if (!Array.isArray(residents) || !Array.isArray(audit) || !isObject(settings)) return bad();
  if (!isString(settings.ward_code) || !isString(settings.ward_name)) return bad();

  const ids = new Set<number>();
  const rows: ResidentRow[] = [];
  for (const item of residents) {
    if (!isObject(item)) return bad();
    const { id, created_at, updated_at, deleted_at } = item;
    if (!Number.isInteger(id) || (id as number) < 1 || ids.has(id as number)) return bad();
    if (!isString(created_at) || !isString(updated_at) || !(deleted_at === null || isString(deleted_at))) return bad();
    const clean = sanitize(item);
    if (isInvalid(clean)) return clean;
    ids.add(id as number);
    rows.push({
      ...clean, id: id as number, created_at, updated_at, created_by: 0, updated_by: 0, deleted_at,
      full_name_search: fold(clean.full_name),
    } as ResidentRow);
  }

  for (const row of audit) {
    if (!isObject(row) || !isString(row.action) || !Number.isInteger(row.resident_id) || !isString(row.created_at)) return bad();
    if (!Array.isArray(row.changed_fields) || !row.changed_fields.every(isString)) return bad();
  }
  return { file: input as BackupFile, rows };
}

export function inspect(input: unknown): BackupSummary | Invalid {
  const checked = check(input);
  return isInvalid(checked) ? checked : summarize(checked.file.created_at, checked.rows);
}

/** Replaces everything with the checked file, after keeping the current data for undo. All or nothing. */
async function replaceAll({ file, rows }: Checked): Promise<BackupSummary> {
  await transaction(async () => {
    const before = await read();
    await Promise.all([db.residents.clear(), db.audit.clear()]);
    await db.residents.bulkAdd(rows);
    await db.audit.bulkAdd(file.audit as AuditRow[]);
    await db.meta.put({ key: 'settings', value: file.settings });
    await db.meta.put({ key: BEFORE_RESTORE, value: before });
  });
  return summarize(file.created_at, rows);
}

export async function restore(input: unknown): Promise<BackupSummary> {
  const checked = check(input);
  if (isInvalid(checked)) throw { code: 'invalid_arguments', message: checked.error } satisfies ApiError;
  return replaceAll(checked);
}

export async function undoRestore(): Promise<BackupSummary> {
  const kept = (await db.meta.get(BEFORE_RESTORE))?.value;
  const checked = kept ? check(kept) : bad();
  if (!kept || isInvalid(checked)) throw { code: 'not_found', message: 'Not Found.' } satisfies ApiError;
  return replaceAll(checked);
}

const DAY = 24 * 3600_000;
const DEFAULT_OPTIONS: BackupOptions = { auto: true, days: 1 };

const age = (last: string, at: Date) => at.getTime() - Date.parse(`${last.replace(' ', 'T')}Z`);
const localDay = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

export const isDue = ({ auto, days }: BackupOptions, last: string | null, at: Date) =>
  auto && (last === null || age(last, at) >= days * DAY);

/** Past 2 x days when automatic, past 7 days when not, or never backed up while residents exist. */
export function isOverdue({ auto, days }: BackupOptions, last: string | null, hasResidents: boolean, at: Date) {
  if (last === null) return hasResidents;
  return age(last, at) > (auto ? 2 * days : 7) * DAY;
}

const meta = async <T>(key: string): Promise<T | undefined> => (await db.meta.get(key))?.value as T | undefined;

export async function getBackupStatus(at = new Date()): Promise<BackupStatus> {
  const options = (await meta<BackupOptions>('backup-options')) ?? DEFAULT_OPTIONS;
  const last = (await meta<string>('backup-last')) ?? null;
  return {
    ...options,
    last_backup_at: last,
    due: isDue(options, last, at),
    overdue: isOverdue(options, last, (await db.residents.count()) > 0, at),
    warned_today: (await meta<string>('backup-warned')) === localDay(at),
    can_undo: (await db.meta.get(BEFORE_RESTORE)) !== undefined,
  };
}

export async function saveBackupOptions(input: unknown): Promise<BackupOptions | Invalid> {
  const { auto, days } = isObject(input) ? input : {};
  if (typeof auto !== 'boolean' || !Number.isInteger(days) || (days as number) < 1 || (days as number) > 30) {
    return { error: i18n.__('Enter a whole number of days from 1 to 30.', 'quan-li-dan-cu') };
  }
  const options = { auto, days: days as number };
  await db.meta.put({ key: 'backup-options', value: options });
  return options;
}

export const markBackedUp = async () => void (await db.meta.put({ key: 'backup-last', value: now() }));
export const markWarned = async () => void (await db.meta.put({ key: 'backup-warned', value: localDay(new Date()) }));
