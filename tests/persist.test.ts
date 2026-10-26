import { afterEach, expect, test, vi } from 'vitest';

import { persistStorage } from '@/lib/persist';

afterEach(() => vi.unstubAllGlobals());

test('asks Chrome to keep the data when it is not kept yet', async () => {
  const persist = vi.fn(async () => true);
  vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } });
  expect(await persistStorage()).toBe(true);
  expect(persist).toHaveBeenCalledTimes(1);
});

test('does not ask again when the data is already kept', async () => {
  const persist = vi.fn(async () => true);
  vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } });
  expect(await persistStorage()).toBe(true);
  expect(persist).not.toHaveBeenCalled();
});

test('reports false when Chrome refuses', async () => {
  vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => false } });
  expect(await persistStorage()).toBe(false);
});
