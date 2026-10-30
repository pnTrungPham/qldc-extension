import { expect, test } from 'vitest';

import { editFromForm, formValuesOf, hasExtras } from '@/pages/import/lib/pending';
import { emptyRow } from '@/pages/import/lib/targets';

const row = (patch: Record<string, unknown> = {}) => ({ ...emptyRow('file', 't1'), key: 't1:0', full_name: 'Phạm Ngọc Trung', ...patch });

test('the drawer opens on what the server will make of the row: codes for gender and relation', () => {
  const values = formValuesOf(row({ gender: 'Nam', relation: 'Chủ hộ', birth_year: '1996' }));
  expect(values).toMatchObject({ gender: 'male', relation: 'head', birth_year: 1996, full_name: 'Phạm Ngọc Trung' });
  expect(formValuesOf(row({ relation: '' })).relation).toBe('other');
  expect(formValuesOf(row({ birth_year: 'abc' })).birth_year).toBeNull();
});

test('applying the drawer gives back plain row fields, with the date in the format the server stores', () => {
  const edit = editFromForm({
    full_name: 'Phạm Ngọc Trung', birth_year: 1996, gender: 'male', relation: 'head', household_code: 'PB-001',
    occupation: 'Thợ điện', policy_tags: ['elderly'], exam_date: '05/03/2026', health_exam: true,
  });
  expect(edit).toMatchObject({ birth_year: '1996', gender: 'male', relation: 'head', occupation: 'Thợ điện', policy_tags: ['elderly'], exam_date: '2026-03-05', health_exam: true });
  // Opening the drawer again shows the same values.
  expect(formValuesOf(row(edit))).toMatchObject({ exam_date: '2026-03-05', policy_tags: ['elderly'], occupation: 'Thợ điện' });
});

test('a date that is not dd/mm/yyyy is kept as typed; one that only looks like a date shows as typed when reopened', () => {
  expect(editFromForm({ exam_date: '5/3/2026' }).exam_date).toBe('5/3/2026');
  expect(formValuesOf(row(editFromForm({ exam_date: '31/02/2026' }))).exam_date).toBe('2026-02-31'); // the server flags it; the drawer shows 31/02/2026 again
});

test('hasExtras tells whether anything beyond the table columns was added', () => {
  expect(hasExtras(row())).toBe(false);
  expect(hasExtras(row({ residence_status: 'unknown', verify_status: 'unverified', policy_tags: [] }))).toBe(false); // the defaults the form fills in
  expect(hasExtras(row({ occupation: 'Thợ điện' }))).toBe(true);
  expect(hasExtras(row({ policy_tags: ['elderly'] }))).toBe(true);
  expect(hasExtras(row({ residence_status: 'moved' }))).toBe(true);
});
