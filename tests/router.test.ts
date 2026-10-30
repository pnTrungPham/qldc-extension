import { beforeEach, expect, test, vi } from 'vitest';

import { db } from '@/backend/db';
import { route } from '@/backend/router';
import { sanitize } from '@/backend/resident';
import * as residents from '@/backend/residents';
import type { Resident, ResidentInput } from '@/lib/api/residents.api';

let an: Resident;
let binh: Resident;

beforeEach(async () => {
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  // Straight into the data: through the API a person with no household would start one.
  const make = (input: Record<string, unknown>) => residents.create(sanitize(input) as ResidentInput);
  an = await make({ full_name: 'Nguyễn Văn An', relation: 'head', exam_date: '05/03/2026', id_last4: '1234' });
  binh = await make({ full_name: 'Trần Thị Bình', health_exam: true });
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

test('bulk: an absurd number of ids is invalid', async () => {
  const ids = Array.from({ length: 10001 }, (_, i) => i + 1);
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

test('a resident whose phone was valid under the old rule can still be moved or bulk-updated, but a new bad phone is refused', async () => {
  const old = await residents.create({ ...(sanitize({ full_name: 'Lê Văn Cường', birth_year: 1990 }) as ResidentInput), phone: '0123456789' });
  expect(await route(`/residents/${old.id}`, 'PATCH', { household_code: 'KP21-009' })).toMatchObject({ household_code: 'KP21-009', phone: '0123456789' });
  expect(await route('/residents/bulk', 'POST', { ids: [old.id], action: 'set_health_exam', value: 'yes' })).toEqual({ affected: 1 });
  await expect(route(`/residents/${old.id}`, 'PATCH', { phone: '0123456780' })).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('splitting a person off makes them the head of a new household with the next code, and leaves the others', async () => {
  const head = await route<Resident>('/residents', 'POST', { full_name: 'Lê Văn Cường', household_code: 'KP21-001', relation: 'head', address: '5 Lê Lợi' });
  const child = await route<Resident>('/residents', 'POST', { full_name: 'Lê Thị Dung', household_code: 'KP21-001', relation: 'child', address: '5 Lê Lợi', phone: '0903412885' });
  // A code that is taken, even by someone in the trash, is never handed out again.
  const gone = await route<Resident>('/residents', 'POST', { full_name: 'Phạm Văn Em', household_code: 'KP21-002' });
  await route(`/residents/${gone.id}`, 'DELETE');

  const split = await route<Resident>(`/residents/${child.id}/split`, 'POST');
  expect(split).toMatchObject({ household_code: 'KP21-003', relation: 'head', is_head: true, address: '5 Lê Lợi', phone: '0903412885' });
  expect(await route(`/residents/${head.id}`)).toMatchObject({ household_code: 'KP21-001', is_head: true });
});

test('there is nothing to split for someone alone in their household or in none', async () => {
  const alone = await route<Resident>('/residents', 'POST', { full_name: 'Lê Văn Cường', household_code: 'KP21-001' });
  await expect(route(`/residents/${alone.id}/split`, 'POST')).rejects.toMatchObject({ code: 'invalid_arguments' });
  await expect(route(`/residents/${an.id}/split`, 'POST')).rejects.toMatchObject({ code: 'invalid_arguments' }); // no household code
  await expect(route('/residents/9999/split', 'POST')).rejects.toMatchObject({ code: 'not_found' });
});

test('adding someone with no household starts a new one with the next code, and they head it', async () => {
  const first = await route<Resident>('/residents', 'POST', { full_name: 'Lê Văn Cường', relation: 'child' });
  expect(first).toMatchObject({ household_code: expect.stringMatching(/-001$/), relation: 'head', is_head: true });
  const second = await route<Resident>('/residents', 'POST', { full_name: 'Phạm Thị Dung' });
  expect(second.household_code).toMatch(/-002$/);
  // A given household is left alone.
  expect(await route('/residents', 'POST', { full_name: 'Võ Văn Em', household_code: first.household_code, relation: 'child' })).toMatchObject({ household_code: first.household_code, relation: 'child', is_head: false });
});

test('the list filters by head, verification, policy tag and support flag, and rejects unknown values', async () => {
  await route(`/residents/${an.id}`, 'PATCH', { policy_tags: ['elderly'], support_flags: ['mobility'], verify_status: 'verified' });
  const names = async (query: string) => (await route<{ items: Resident[] }>(`/residents?${query}`)).items.map((r) => r.full_name);
  expect(await names('head=yes')).toEqual(['Nguyễn Văn An']);
  expect(await names('head=no')).toEqual(['Trần Thị Bình']);
  expect(await names('verify=verified')).toEqual(['Nguyễn Văn An']);
  expect(await names('policy=elderly')).toEqual(['Nguyễn Văn An']);
  expect(await names('support=mobility')).toEqual(['Nguyễn Văn An']);
  expect(await names('policy=elderly&support=evacuation')).toEqual([]);
  await expect(route('/residents?support=nope')).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('bulk can set verification and add or remove one policy tag without touching the others', async () => {
  await route(`/residents/${an.id}`, 'PATCH', { policy_tags: ['elderly'] });
  const both = [an.id, binh.id];
  expect(await route('/residents/bulk', 'POST', { ids: both, action: 'add_policy_tag', value: 'poor_household' })).toEqual({ affected: 2 });
  expect(await route(`/residents/${an.id}`)).toMatchObject({ policy_tags: expect.arrayContaining(['elderly', 'poor_household']) });
  expect(await route(`/residents/${binh.id}`)).toMatchObject({ policy_tags: ['poor_household'] });
  await route('/residents/bulk', 'POST', { ids: both, action: 'remove_policy_tag', value: 'poor_household' });
  expect(await route(`/residents/${an.id}`)).toMatchObject({ policy_tags: ['elderly'] });
  await route('/residents/bulk', 'POST', { ids: both, action: 'set_verify_status', value: 'verified' });
  expect(await route(`/residents/${binh.id}`)).toMatchObject({ verify_status: 'verified' });
  await expect(route('/residents/bulk', 'POST', { ids: both, action: 'add_policy_tag', value: 'nope' })).rejects.toMatchObject({ code: 'invalid_arguments' });
});

test('GET /residents/ids returns everyone the filters match, and export can be limited to chosen ids', async () => {
  expect(await route('/residents/ids?head=yes')).toEqual({ ids: [an.id] });
  expect(await route('/residents/ids')).toEqual({ ids: [binh.id, an.id] });
  expect(await route<{ total: number }>(`/export?ids[]=${an.id}`)).toMatchObject({ total: 1 });
});

test('sorting by name goes by the given name, with Vietnamese letters in their place, and blanks last', async () => {
  const make = (input: Record<string, unknown>) => residents.create(sanitize(input) as ResidentInput);
  await make({ full_name: 'Lê Hồng Anh', birth_year: 1980 });
  await make({ full_name: 'Phạm Văn Đức', birth_year: 1950 });
  await make({ full_name: 'Dương Minh Khoa', birth_year: 2001 });
  const names = async (query: string) => (await route<{ items: Resident[] }>(`/residents?${query}`)).items.map((r) => r.full_name);
  expect(await names('sort=name&order=asc')).toEqual(['Nguyễn Văn An', 'Lê Hồng Anh', 'Trần Thị Bình', 'Phạm Văn Đức', 'Dương Minh Khoa']);
  expect((await names('sort=name&order=desc'))[0]).toBe('Dương Minh Khoa');
  // an and binh have no birth year: last in both directions
  expect((await names('sort=birth_year&order=asc')).slice(0, 3)).toEqual(['Phạm Văn Đức', 'Lê Hồng Anh', 'Dương Minh Khoa']);
  expect((await names('sort=birth_year&order=desc')).slice(0, 3)).toEqual(['Dương Minh Khoa', 'Lê Hồng Anh', 'Phạm Văn Đức']);
  await expect(route('/residents?sort=nope')).rejects.toMatchObject({ code: 'invalid_arguments' });
});
