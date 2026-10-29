import { expect, test } from 'vitest';

import { COLUMN_IDS, DEFAULT_COLUMNS, parseColumns } from '@/lib/columns';

test('no saved choice means the default columns', () => {
  expect(parseColumns(null)).toEqual(DEFAULT_COLUMNS);
  expect(DEFAULT_COLUMNS.every((id) => COLUMN_IDS.includes(id))).toBe(true);
});

test('a saved choice is kept, in table order, without unknown or repeated ids', () => {
  expect(parseColumns(JSON.stringify(['note', 'phone', 'gone', 'phone']))).toEqual(['phone', 'note']);
});

test('choosing no column at all is allowed: only the name stays', () => {
  expect(parseColumns('[]')).toEqual([]);
});

test('damaged storage falls back to the defaults', () => {
  expect(parseColumns('not json')).toEqual(DEFAULT_COLUMNS);
  expect(parseColumns('{"a":1}')).toEqual(DEFAULT_COLUMNS);
});
