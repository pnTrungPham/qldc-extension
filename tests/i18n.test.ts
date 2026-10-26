import { expect, test } from 'vitest';

import { i18n, loadLocale } from '@/lib/i18n';

test('Vietnamese strings load', () => {
  loadLocale('vi-VN');
  expect(i18n.__('Residents', 'quan-li-dan-cu')).toBe('Cư dân');
});

test('English stays as written', () => {
  loadLocale('en-US');
  expect(i18n.__('Residents', 'quan-li-dan-cu')).toBe('Residents');
});

test('sprintf is on the object', () => {
  expect(i18n.sprintf('%1$s added %2$s', 'A', 'B')).toBe('A added B');
});
