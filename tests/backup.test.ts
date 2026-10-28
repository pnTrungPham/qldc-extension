import { beforeEach, expect, test, vi } from 'vitest';

import { inspect, isDue, isOverdue, restore, snapshot, undoRestore } from '@/backend/backup';
import { db } from '@/backend/db';
import { route } from '@/backend/router';
import type { Resident } from '@/lib/api/residents.api';

let an: Resident;
let binh: Resident;

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  an = await route<Resident>('/residents', 'POST', { full_name: 'Nguyễn Văn An', household_code: 'H1', relation: 'head', id_last4: '1234' });
  binh = await route<Resident>('/residents', 'POST', { full_name: 'Trần Thị Bình', household_code: 'H2' });
  await route(`/residents/${binh.id}`, 'DELETE');
});

const addThird = () => route('/residents', 'POST', { full_name: 'Lê Văn Cường' });

test('round trip', async () => {
  const file = await snapshot();
  await addThird();
  await restore(file);
  expect(await db.residents.count()).toBe(2);
  expect(await db.residents.get(binh.id)).toMatchObject({ deleted_at: expect.any(String) });
  expect(await db.residents.get(an.id)).toMatchObject({ id_last4: '1234' });
  expect(await route('/residents?search=nguyen')).toMatchObject({ total: 1 });
});

test('snapshot has the agreed shape', async () => {
  const file = await snapshot();
  expect(file).toMatchObject({ format: 'qldc-backup', version: 1, counts: { people: 1, households: 1 } });
  expect(file.residents.some((r) => 'full_name_search' in r)).toBe(false);
});

test('foreign file changes nothing', async () => {
  const file = await snapshot();
  for (const bad of [{}, { format: 'x', version: 1 }, { ...file, version: 2 }, { ...file, residents: [{ full_name: 'X' }] }]) {
    await expect(restore(bad)).rejects.toMatchObject({ code: 'invalid_arguments' });
    expect(await db.residents.count()).toBe(2);
    expect(inspect(bad)).toHaveProperty('error');
  }
});

test('failure halfway changes nothing', async () => {
  const file = await snapshot();
  await addThird();
  vi.spyOn(db.audit, 'bulkAdd').mockRejectedValueOnce(new Error('disk'));
  await expect(restore(file)).rejects.toThrow();
  expect(await db.residents.count()).toBe(3);
  expect(await db.meta.get('before-restore')).toBeUndefined();
});

test('restore keeps the previous data for undo', async () => {
  const file = await snapshot();
  await addThird();
  await restore(file);
  await undoRestore();
  expect(await db.residents.count()).toBe(3);
  await undoRestore();
  expect(await db.residents.count()).toBe(2);
});

test('undo without a restore', async () => {
  await expect(undoRestore()).rejects.toMatchObject({ code: 'not_found' });
});

test('inspect summarizes', async () => {
  const file = await snapshot();
  expect(inspect(file)).toEqual({ date: file.created_at, households: 1, people: 1 });
  expect(await route('/restore/inspect', 'POST', { file })).toEqual({ date: file.created_at, households: 1, people: 1 });
});

const AT = new Date('2026-10-28T12:00:00Z');
const ago = (ms: number) => new Date(AT.getTime() - ms).toISOString().slice(0, 19).replace('T', ' ');
const H = 3600_000;
const D = 24 * H;

test('isDue', () => {
  const on = { auto: true, days: 1 };
  expect(isDue(on, null, AT)).toBe(true);
  expect(isDue(on, ago(23 * H), AT)).toBe(false);
  expect(isDue(on, ago(24 * H), AT)).toBe(true);
  expect(isDue({ auto: false, days: 1 }, null, AT)).toBe(false);
});

test('isOverdue', () => {
  const on = { auto: true, days: 3 };
  const off = { auto: false, days: 3 };
  expect(isOverdue(on, ago(6 * D), true, AT)).toBe(false);
  expect(isOverdue(on, ago(6 * D + 60_000), true, AT)).toBe(true);
  expect(isOverdue(off, ago(7 * D + 60_000), true, AT)).toBe(true);
  expect(isOverdue(off, ago(6 * D), true, AT)).toBe(false);
  expect(isOverdue(on, null, true, AT)).toBe(true);
  expect(isOverdue(on, null, false, AT)).toBe(false);
});

test('days validation', async () => {
  for (const days of [0, 31, 1.5, '2']) {
    await expect(route('/backup/options', 'POST', { auto: true, days })).rejects.toMatchObject({ code: 'invalid_arguments' });
  }
  await route('/backup/options', 'POST', { auto: false, days: 30 });
  expect(await route('/backup/status')).toMatchObject({ auto: false, days: 30 });
});

test('done and warned', async () => {
  expect(await route('/backup/status')).toMatchObject({ last_backup_at: null, warned_today: false, can_undo: false });
  await route('/backup/done', 'POST');
  await route('/backup/warned', 'POST');
  expect(await route('/backup/status')).toMatchObject({ last_backup_at: expect.any(String), due: false, warned_today: true });
  await restore(await snapshot());
  expect(await route('/backup/status')).toMatchObject({ can_undo: true });
});
