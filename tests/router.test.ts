import { beforeEach, expect, test, vi } from 'vitest';

import { db } from '@/backend/db';
import { route } from '@/backend/router';
import * as residents from '@/backend/residents';
import type { Resident } from '@/lib/api/residents.api';

let an: Resident;
let binh: Resident;

beforeEach(async () => {
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  an = await route<Resident>('/residents', 'POST', { full_name: 'Nguyễn Văn An', relation: 'head', exam_date: '05/03/2026', id_last4: '1234' });
  binh = await route<Resident>('/residents', 'POST', { full_name: 'Trần Thị Bình', health_exam: true });
});

test('invalid input rejects with invalid_arguments', async () => {
  await expect(route('/residents', 'POST', { full_name: 'X' })).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('created resident can be read back', async () => {
  expect(await route(`/residents/${an.id}`)).toMatchObject({ full_name: 'Nguyễn Văn An' });
});

test('changing relation away from head clears is_head', async () => {
  expect(await route(`/residents/${an.id}`, 'PATCH', { relation: 'child' })).toMatchObject({ relation: 'child', is_head: false });
});

test('a missing id rejects with not_found', async () => {
  await expect(route('/residents/999')).rejects.toMatchObject({ code: 'not_found' });
});

test('list with query parameters', async () => {
  expect(await route('/residents?page=1&per_page=20&search=nguyen')).toMatchObject({ total: 1 });
  await expect(route('/residents?per_page=201')).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('delete, trash list, empty trash', async () => {
  expect(await route(`/residents/${an.id}`, 'DELETE')).toBe(true);
  expect(await route('/residents?trash=true')).toMatchObject({ total: 1 });
  expect(await route('/residents/trash', 'DELETE')).toEqual({ affected: 1 });
});

test('bulk: unticking the exam clears the date', async () => {
  expect(await route('/residents/bulk', 'POST', { ids: [an.id, binh.id], action: 'set_health_exam', value: 'no' })).toEqual({ affected: 2 });
  expect(await route(`/residents/${an.id}`)).toMatchObject({ health_exam: false, exam_date: null });
  expect(await route(`/residents/${binh.id}`)).toMatchObject({ health_exam: false, exam_date: null });
});

test('bulk: more than 200 ids is invalid', async () => {
  const ids = Array.from({ length: 201 }, (_, i) => i + 1);
  await expect(route('/residents/bulk', 'POST', { ids, action: 'delete' })).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('bulk is all or nothing', async () => {
  // A bad value fails validation before anything is written.
  await expect(route('/residents/bulk', 'POST', { ids: [an.id], action: 'set_residence_status', value: 'nope' })).rejects.toMatchObject({ code: 'invalid_arguments' });
  expect(await route(`/residents/${an.id}`)).toMatchObject({ residence_status: 'unknown' });
});

test('bulk rolls back when a row fails halfway', async () => {
  const trash = residents.trash;
  const spy = vi.spyOn(residents, 'trash').mockImplementation(async (id) => {
    if (id === binh.id) throw new Error('disk full');
    return trash(id);
  });
  await expect(route('/residents/bulk', 'POST', { ids: [an.id, binh.id], action: 'delete' })).rejects.toMatchObject({ code: 'bulk_failed' });
  spy.mockRestore();
  expect(await route('/residents')).toMatchObject({ total: 2, trashed: 0 });
});

test('export never includes ID digits', async () => {
  const { rows } = await route<{ rows: Record<string, unknown>[] }>('/export?columns[]=full_name&columns[]=id_last4');
  expect(rows).toEqual([{ full_name: 'Nguyễn Văn An' }, { full_name: 'Trần Thị Bình' }]);
});

test('settings round trip', async () => {
  await expect(route('/settings', 'POST', { ward_code: 'kp 21' })).rejects.toMatchObject({ code: 'invalid_arguments' });
  expect(await route('/settings', 'POST', { ward_code: 'kp21', ward_name: 'Khu phố 21' })).toEqual({ ward_code: 'KP21', ward_name: 'Khu phố 21' });
  expect(await route('/settings')).toEqual({ ward_code: 'KP21', ward_name: 'Khu phố 21' });
});

test('stats include recent activity', async () => {
  expect(await route('/stats')).toMatchObject({ people: 2, recent: [{ action: 'create', resident: 'Trần Thị Bình' }, { action: 'create' }] });
});

test('import routes', async () => {
  expect(await route('/import/preview', 'POST', { rows: [{ full_name: 'Lê Văn Cường' }], auto_update: true })).toMatchObject({ will_add: 1 });
  expect(await route('/import/commit', 'POST', { rows: [{ full_name: 'Lê Văn Cường' }] })).toMatchObject({ added_people: 1 });
  await expect(route('/import/preview', 'POST', { rows: Array(5001).fill({}) })).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('an unknown route rejects with rest_no_route', async () => {
  await expect(route('/nope')).rejects.toMatchObject({ code: 'rest_no_route' });
});

test('GET /residents?household= lists the members of one household', async () => {
  await route('/residents', 'POST', { full_name: 'Lê Văn Cường', household_code: 'KP21-002' });
  const page = await route<{ items: Resident[] }>('/residents?household=KP21-002&per_page=200');
  expect(page.items.map((r) => r.full_name)).toEqual(['Lê Văn Cường']);
});

test('choosing "head" as the relation makes the resident the head, with no separate flag sent', async () => {
  expect(await route(`/residents/${binh.id}`, 'PATCH', { relation: 'head' })).toMatchObject({ relation: 'head', is_head: true });
});

test('POST /residents/match finds an existing person by name and birth year, ignoring accents and the trash', async () => {
  const match = (body: Record<string, unknown>) => route<Resident | null>('/residents/match', 'POST', body);
  const cuong = await route<Resident>('/residents', 'POST', { full_name: 'Lê Văn Cường', birth_year: 1990, household_code: 'KP21-002' });
  expect(await match({ full_name: 'le van cuong', birth_year: 1990 })).toMatchObject({ id: cuong.id, household_code: 'KP21-002' });
  expect(await match({ full_name: 'Lê Văn Cường', birth_year: 1991 })).toBeNull();
  expect(await match({ full_name: 'Lê Văn Cường' })).toBeNull(); // a name alone matches many people
  expect(await match({ full_name: 'X' })).toBeNull(); // invalid input is the save's job to report
  await route(`/residents/${cuong.id}`, 'DELETE');
  expect(await match({ full_name: 'Lê Văn Cường', birth_year: 1990 })).toBeNull();
});

test('moving a person to another household keeps their details and follows the new relation', async () => {
  const head = await route<Resident>('/residents', 'POST', { full_name: 'Lê Văn Cường', birth_year: 1990, phone: '0903412885', relation: 'head', household_code: 'KP21-002', address: '1 Đường A' });
  expect(head.is_head).toBe(true);
  const moved = await route<Resident>(`/residents/${head.id}`, 'PATCH', { household_code: 'KP21-001', address: '12 Đường Trần Hưng', relation: 'child' });
  expect(moved).toMatchObject({ household_code: 'KP21-001', address: '12 Đường Trần Hưng', relation: 'child', is_head: false, phone: '0903412885', birth_year: 1990 });
});

test('GET /households lists households to move into, minus the excluded one', async () => {
  await route('/residents', 'POST', { full_name: 'Lê Văn Cường', household_code: 'KP21-002' });
  await route('/residents', 'POST', { full_name: 'Phạm Thị Dung', household_code: 'KP21-003' });
  expect((await route<Array<{ code: string }>>('/households?search=&exclude=KP21-003')).map((h) => h.code)).toEqual(['KP21-002']);
});
