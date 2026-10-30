import { expect, test } from 'vitest';

import { DEFAULT_DETAIL_FIELDS, DETAIL_FIELD_IDS, parseDetailFields } from '@/lib/detail-fields';

test('by default every optional field of the detail drawer is shown', () => {
  expect(parseDetailFields(null)).toEqual([...DETAIL_FIELD_IDS]);
  expect(DEFAULT_DETAIL_FIELDS).toEqual([...DETAIL_FIELD_IDS]);
});

test('a saved choice keeps drawer order and drops unknown ids', () => {
  expect(parseDetailFields(JSON.stringify(['note', 'phone', 'nope']))).toEqual(['phone', 'note']);
  expect(parseDetailFields('[]')).toEqual([]);
  expect(parseDetailFields('garbage')).toEqual([...DETAIL_FIELD_IDS]);
});
