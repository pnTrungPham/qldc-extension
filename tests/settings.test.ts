import { beforeEach, expect, test } from 'vitest';

import { db } from '@/backend/db';
import { isInvalid } from '@/backend/resident';
import { getSettings, saveSettings } from '@/backend/settings';

beforeEach(() => db.meta.clear());

test('a code with a space is invalid', async () => {
  expect(isInvalid(await saveSettings({ ward_code: 'kp 21' }))).toBe(true);
});

test('the code is uppercased and saved', async () => {
  expect(await saveSettings({ ward_code: 'kp21', ward_name: 'Khu phố 21' })).toMatchObject({ ward_code: 'KP21' });
  expect(await getSettings()).toEqual({ ward_code: 'KP21', ward_name: 'Khu phố 21' });
});

test('defaults before anything is saved', async () => {
  expect(await getSettings()).toEqual({ ward_code: 'KP21', ward_name: '' });
});
