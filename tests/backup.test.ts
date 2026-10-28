import { beforeEach, expect, test, vi } from 'vitest';

import { inspect, restore, snapshot, undoRestore } from '@/backend/backup';
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
