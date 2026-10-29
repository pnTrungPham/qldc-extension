import { readFileSync } from 'node:fs';
import { beforeEach, expect, test, vi } from 'vitest';

import { recent } from '@/backend/audit';
import { db } from '@/backend/db';
import { commit, preview } from '@/backend/import';
import { sanitize } from '@/backend/resident';
import * as residents from '@/backend/residents';
import { saveSettings } from '@/backend/settings';
import type { ResidentInput } from '@/lib/api/residents.api';
import { readTable } from '@/lib/excel';
import { toTable } from '@/pages/import/lib/parse';
import { buildPending } from '@/pages/import/lib/pending';

/** The rows the Import page would send for this fixture. */
async function rowsOf(name: string) {
  const { rows } = await readTable(new File([readFileSync(`tests/fixtures/${name}`)], name));
  return buildPending([toTable(name, 'file', rows)!], [], {}).rows;
}

beforeEach(async () => {
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  await saveSettings({ ward_code: 'KP21', ward_name: 'Khu phố 21' });
  const home = { address: '12 Đường Trần Hưng', household_code: 'KP21-001' };
  await residents.create(sanitize({ full_name: 'Nguyễn Văn An', birth_year: 1978, phone: '0903412885', relation: 'head', ...home }) as ResidentInput);
  await residents.create(sanitize({ full_name: 'Trần Thị Bình', birth_year: 1980, relation: 'spouse', ...home }) as ResidentInput);
});

test('preview counts', async () => {
  expect(await preview(await rowsOf('demo-to-1.xlsx'), true)).toMatchObject({ will_add: 12, will_update: 2, invalid: 6 });
});

test('commit writes, numbers households, and logs the import', async () => {
  expect(await commit(await rowsOf('demo-to-1.xlsx'), true)).toEqual({ added_people: 11, added_households: 7, updated: 1, skipped: 8 });
  expect((await residents.all({ search: 'le van cuong' }))[0].household_code).toBe('KP21-002');
  expect((await residents.all({ search: 'trinh thi oanh' }))[0].household_code).toBe('KP21-900');
  expect((await recent(1))[0]).toMatchObject({ action: 'import', changed_fields: ['added:11', 'updated:1'] });
});

test('an import that fails halfway writes nothing', async () => {
  const create = residents.create;
  let calls = 0;
  const spy = vi.spyOn(residents, 'create').mockImplementation(async (data) => {
    if (++calls === 3) throw new Error('disk full');
    return create(data);
  });
  await expect(commit(await rowsOf('demo-to-1.xlsx'), true)).rejects.toMatchObject({ code: 'import_failed' });
  spy.mockRestore();
  expect((await residents.paginate(1, 200, {})).total).toBe(2);
});


test('a new person keeps the extra details given in the waiting-list drawer', async () => {
  const row = {
    full_name: 'Phạm Ngọc Trung', birth_year: '1996', household_code: 'PB-001', relation: 'head',
    residence_status: 'temporary', verify_status: 'verified', occupation: 'Thợ điện', bhyt_number: 'DN123',
    policy_tags: ['elderly', 'not-a-tag'], support_flags: ['mobility'], exam_date: '2026-03-05', exam_place: 'Trạm y tế',
  };
  expect(await commit([row], true)).toMatchObject({ added_people: 1 });
  expect((await residents.all({ search: 'pham ngoc trung' }))[0]).toMatchObject({
    residence_status: 'temporary', verify_status: 'verified', occupation: 'Thợ điện', bhyt_number: 'DN123',
    policy_tags: ['elderly'], support_flags: ['mobility'], exam_date: '2026-03-05', exam_place: 'Trạm y tế', health_exam: true,
  });
});

test('for a person who already exists only the phone and address are updated, whatever extras the row carries', async () => {
  const row = { full_name: 'Nguyễn Văn An', birth_year: '1978', phone: '0911222333', occupation: 'Thợ điện', policy_tags: ['elderly'], residence_status: 'moved' };
  expect(await commit([row], true)).toMatchObject({ added_people: 0, updated: 1 });
  expect((await residents.all({ search: 'nguyen van an' }))[0]).toMatchObject({ phone: '0911222333', occupation: '', policy_tags: [], residence_status: 'unknown' });
});

test('updating a person whose phone was valid under the old rule keeps that phone and still updates the address', async () => {
  const old = await residents.create({ ...(sanitize({ full_name: 'Lê Văn Cường', birth_year: 1990 }) as ResidentInput), phone: '0123456789' });
  expect(await commit([{ full_name: 'Lê Văn Cường', birth_year: '1990', address: '9 Lê Lợi' }], true)).toMatchObject({ updated: 1 });
  expect(await residents.find(old.id)).toMatchObject({ phone: '0123456789', address: '9 Lê Lợi' });
});
