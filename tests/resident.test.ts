import { expect, test } from 'vitest';

import { isInvalid, sanitize } from '@/backend/resident';
import type { ResidentInput } from '@/lib/api/residents.api';
import { fold } from '@/lib/fold';

const ok = (extra = {}) => sanitize({ full_name: 'Nguyễn Văn An', ...extra }) as ResidentInput;
const bad = (extra: Record<string, unknown>) => isInvalid(sanitize({ full_name: 'Ab', ...extra }));

test('name shorter than 2 is invalid', () => expect(isInvalid(sanitize({ full_name: 'X' }))).toBe(true));
test('phone separators are removed', () => expect(ok({ phone: '0903.412.885' }).phone).toBe('0903412885'));
test('+84 becomes 0', () => expect(ok({ phone: '+84912000111' }).phone).toBe('0912000111'));
test('phone without leading 0 is invalid', () => expect(bad({ phone: '912345678' })).toBe(true));
test.each(['0321234567', '0561234567', '0701234567', '0851234567', '0961234567'])('mobile %s is valid', (phone) => expect(ok({ phone }).phone).toBe(phone));
test.each(['0123456789', '0412345678', '0612345678', '090321320', '0903abc885'])('%s is not a phone number', (phone) => expect(bad({ phone })).toBe(true));
test('an 11-digit landline starting with 02 is valid, with separators or +84', () => {
  expect(ok({ phone: '02838123456' }).phone).toBe('02838123456');
  expect(ok({ phone: '0243 812 3456' }).phone).toBe('02438123456');
  expect(ok({ phone: '+842838123456' }).phone).toBe('02838123456');
});
test.each(['0283812345', '028381234567'])('a landline of the wrong length (%s) is invalid', (phone) => expect(bad({ phone })).toBe(true));
test('a phone that was stored under the old rule is accepted again only when it is unchanged', () => {
  expect(isInvalid(sanitize({ full_name: 'Nguyễn Văn An', phone: '0123456789' }, '0123456789'))).toBe(false);
  expect(isInvalid(sanitize({ full_name: 'Nguyễn Văn An', phone: '0123456780' }, '0123456789'))).toBe(true);
});
test('year from dd/mm/yyyy', () => expect(ok({ birth_year: '15/03/1985' }).birth_year).toBe(1985));
test('year from yyyy-mm-dd', () => expect(ok({ birth_year: '1987-06-20' }).birth_year).toBe(1987));
test('empty year is null', () => expect(ok({ birth_year: '' }).birth_year).toBeNull());
test.each(['78', '5/1/12', '1850', String(new Date().getFullYear() + 1)])('year %s is invalid', (year) =>
  expect(bad({ birth_year: year })).toBe(true),
);
test('12-digit ID keeps the last 4', () => expect(ok({ id_last4: '079085001234' }).id_last4).toBe('1234'));
test('9-digit ID keeps the last 4', () => expect(ok({ id_last4: '123456789' }).id_last4).toBe('6789'));
test('5-digit ID is invalid', () => expect(bad({ id_last4: '12345' })).toBe(true));
test('head relation sets is_head', () => expect(ok({ relation: 'head' })).toMatchObject({ relation: 'head', is_head: true }));
test('unknown relation becomes other', () => expect(ok({ relation: 'nonsense' }).relation).toBe('other'));
test('exam date dd/mm/yyyy is stored as Y-m-d and sets health_exam', () =>
  expect(ok({ exam_date: '05/03/2026' })).toMatchObject({ exam_date: '2026-03-05', health_exam: true }),
);
test('impossible exam date is invalid', () => expect(bad({ exam_date: '31/02/2026' })).toBe(true));
test('household code is uppercased', () => expect(ok({ household_code: 'kp21-001' }).household_code).toBe('KP21-001'));
test('unknown policy tags are dropped', () => expect(ok({ policy_tags: ['elderly', 'bogus'] }).policy_tags).toEqual(['elderly']));
test('tags and extra spaces are stripped from the name', () => expect(ok({ full_name: '  <b>Lê</b>   Văn  ' }).full_name).toBe('Lê Văn'));
test('note keeps its newlines', () => expect(ok({ note: ' line 1\nline 2 ' }).note).toBe('line 1\nline 2'));
test('fold removes accents and đ', () => expect(fold('Đặng Thị Hoa')).toBe('dang thi hoa'));
