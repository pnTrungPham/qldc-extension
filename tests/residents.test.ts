import { beforeEach, expect, test } from 'vitest';

import { recent } from '@/backend/audit';
import { db, transaction } from '@/backend/db';
import { sanitize } from '@/backend/resident';
import * as residents from '@/backend/residents';
import type { Resident, ResidentInput } from '@/lib/api/residents.api';

let an: Resident;
let binh: Resident;

const input = (data: Record<string, unknown>) => sanitize(data) as ResidentInput;
const names = (items: Resident[]) => items.map((r) => r.full_name).sort();

beforeEach(async () => {
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  const home = { address: '12 Đường Trần Hưng', household_code: 'KP21-001' };
  an = await residents.create(input({ full_name: 'Nguyễn Văn An', birth_year: 1978, phone: '0903412885', relation: 'head', ...home }));
  binh = await residents.create(input({ full_name: 'Trần Thị Bình', birth_year: 1980, relation: 'spouse', ...home }));
});

test('name search ignores accents', async () => {
  expect(names((await residents.paginate(1, 20, { search: 'nguyen' })).items)).toEqual(['Nguyễn Văn An']);
});

test('address search ignores accents', async () => {
  expect((await residents.paginate(1, 20, { search: 'tran hung' })).items).toHaveLength(2);
});

test('phone search', async () => {
  expect(names((await residents.paginate(1, 20, { search: '0903' })).items)).toEqual(['Nguyễn Văn An']);
});

test('a search of only punctuation matches no phone, and does not fail', async () => {
  // PHP build_where: with no phone digits left, only name and address are searched.
  expect((await residents.paginate(1, 20, { search: '...' })).items).toEqual([]);
});

test('household counts', async () => {
  const page = await residents.paginate(1, 20, {});
  expect(page.households).toBe(1);
  expect(page.items.map((r) => r.household_size)).toEqual([2, 2]);
  expect(page.items.map((r) => r.id)).toEqual([binh.id, an.id]);
});

test('trash and restore', async () => {
  expect(await residents.trash(an.id)).toBe(true);
  expect(await residents.paginate(1, 20, {})).toMatchObject({ total: 1, trashed: 1 });
  expect(names((await residents.paginate(1, 20, { trash: true })).items)).toEqual(['Nguyễn Văn An']);
  expect(await residents.find(an.id)).toBeNull();
  expect(await residents.findTrashed(an.id)).not.toBeNull();
  expect(await residents.restore(an.id)).toBe(true);
  expect(await residents.find(an.id)).not.toBeNull();
});

test('purge never touches a live resident', async () => {
  expect(await residents.purge(binh.id)).toBe(false);
  expect(await residents.find(binh.id)).not.toBeNull();
});

test('purgeAll empties only the trash', async () => {
  await residents.trash(an.id);
  expect(await residents.purgeAll()).toBe(1);
  expect(await residents.findTrashed(an.id)).toBeNull();
  expect(await residents.find(binh.id)).not.toBeNull();
});

test('findMatch: name and birth year', async () => {
  expect((await residents.findMatch('nguyen van an', 1978, ''))?.id).toBe(an.id);
});

test('findMatch: ID digits alone never match', async () => {
  await residents.update(an.id, input({ ...an, id_last4: '1234' }));
  expect(await residents.findMatch('Người Khác', null, '1234')).toBeNull();
});

test('household numbers', async () => {
  expect(await residents.maxHouseholdNumber('KP21')).toBe(1);
  expect(await residents.householdExists('KP21-001')).toBe(true);
  expect(await residents.householdExists('KP21-002')).toBe(false);
});

test('maxHouseholdNumber counts the trash', async () => {
  const other = await residents.create(input({ full_name: 'Lê Văn Cường', household_code: 'KP21-007' }));
  await residents.trash(other.id);
  expect(await residents.maxHouseholdNumber('KP21')).toBe(7);
});

test('stats', async () => {
  expect(await residents.stats()).toMatchObject({ people: 2, households: 1, gender: { unknown: 2 }, age: { adult: 2 } });
});

test('update logs only the changed fields', async () => {
  await residents.update(an.id, input({ ...an, phone: '0909999888' }));
  const [entry] = await recent(8);
  expect(entry).toMatchObject({ action: 'update', resident: 'Nguyễn Văn An', changed_fields: ['phone'], user: '' });
});

test('all() orders by household, head first', async () => {
  expect((await residents.all({})).map((r) => r.id)).toEqual([an.id, binh.id]);
});

test('transaction() rolls back nested repository writes, even from a plain arrow callback', async () => {
  const work = async () => {
    await residents.update(an.id, input({ ...an, phone: '0909999888' }));
    await residents.trash(binh.id);
    throw new Error('stop');
  };
  await expect(transaction(() => work())).rejects.toThrow('stop');
  expect(await residents.find(an.id)).toMatchObject({ phone: '0903412885' });
  expect(await residents.find(binh.id)).not.toBeNull();
});

test('household filter returns only that household, trash excluded', async () => {
  const other = await residents.create(input({ full_name: 'Lê Văn Cường', household_code: 'KP21-002' }));
  const old = await residents.create(input({ full_name: 'Phạm Thị Dung', household_code: 'KP21-001' }));
  await residents.trash(old.id);
  expect(names((await residents.paginate(1, 20, { household: 'KP21-001' })).items)).toEqual(['Nguyễn Văn An', 'Trần Thị Bình']);
  expect(names((await residents.paginate(1, 20, { household: 'KP21-002' })).items)).toEqual([other.full_name]);
  expect((await residents.paginate(1, 20, { household: 'NOPE' })).items).toEqual([]);
});

test('households: search by code, member, head or address; exclude one; exact code first', async () => {
  await residents.create(input({ full_name: 'Lê Văn Cường', household_code: 'KP21-002', relation: 'head', address: '5 Lê Lợi' }));
  const dung = await residents.create(input({ full_name: 'Phạm Thị Dung', household_code: 'KP21-020', address: '7 Hai Bà Trưng' }));
  await residents.create(input({ full_name: 'Phạm Văn Em', household_code: 'KP21-021', address: '7 Hai Bà Trưng' }));
  await residents.trash(dung.id); // KP21-020 now has nobody alive

  const codes = async (search: string, exclude?: string) => (await residents.households(search, exclude)).map((h) => h.code);
  expect(await codes('')).toEqual(['KP21-001', 'KP21-002', 'KP21-021']); // no empty households
  expect(await codes('cuong')).toEqual(['KP21-002']); // a member's name, no accents
  expect(await codes('hai ba')).toEqual(['KP21-021']); // address
  expect(await codes('kp21-002')).toEqual(['KP21-002']);
  expect(await codes('', 'KP21-001')).toEqual(['KP21-002', 'KP21-021']);
  expect((await residents.households('')).find((h) => h.code === 'KP21-001')).toEqual({ code: 'KP21-001', head_name: 'Nguyễn Văn An', address: '12 Đường Trần Hưng', size: 2, has_head: true });
  expect((await residents.households('cuong'))[0]).toMatchObject({ code: 'KP21-002', has_head: true });
  expect((await residents.households('em'))[0]).toMatchObject({ code: 'KP21-021', has_head: false });
  expect(await codes('kp21-02')).toEqual(['KP21-021']); // KP21-020 has nobody left, so it is not a household any more

  await residents.create(input({ full_name: 'Đỗ Văn Phúc', household_code: 'AKP21-002' }));
  expect(await codes('kp21-002')).toEqual(['KP21-002', 'AKP21-002']); // the exact code comes first
});
