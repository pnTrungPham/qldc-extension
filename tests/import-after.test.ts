import { beforeEach, expect, test, vi } from 'vitest';
import { toast } from 'sonner';

import { handleAfterImport } from '@/lib/api/import.api';

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test.each(['needs-access', 'missing'] as const)('%s shows a warning', async (result) => {
  await handleAfterImport(Promise.resolve(result));
  expect(toast.warning).toHaveBeenCalledOnce();
  expect(toast.error).not.toHaveBeenCalled();
});

test.each(['done', 'skipped', 'downloaded'] as const)('%s says nothing', async (result) => {
  await handleAfterImport(Promise.resolve(result));
  expect(toast.warning).not.toHaveBeenCalled();
});

test('a rejection shows an error and does not throw', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(handleAfterImport(Promise.reject(new Error('x')))).resolves.toBeUndefined();
  expect(toast.error).toHaveBeenCalledOnce();
});
