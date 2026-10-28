import { beforeEach, expect, test, vi } from 'vitest';

import { db } from '@/backend/db';
import { route } from '@/backend/router';
import { backUpNow, backupAfterImport, restoreBackup, runDueBackup } from '@/lib/auto-backup';
import { downloadBackup, folderAccess, getFolder, writeBackup } from '@/lib/backup-folder';

vi.mock('@/lib/backup-folder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/backup-folder')>()),
  getFolder: vi.fn(),
  folderAccess: vi.fn(),
  writeBackup: vi.fn(),
  downloadBackup: vi.fn(),
}));

const handle = {} as FileSystemDirectoryHandle;
const request = vi.fn((_: string, fn: () => unknown) => fn());
const last = async () => (await route<{ last_backup_at: string | null }>('/backup/status')).last_backup_at;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { locks: { request } });
  await Promise.all([db.residents.clear(), db.audit.clear(), db.meta.clear()]);
  vi.mocked(getFolder).mockResolvedValue(handle);
  vi.mocked(folderAccess).mockResolvedValue('granted');
  vi.mocked(writeBackup).mockResolvedValue('x');
});

test('permission lost', async () => {
  vi.mocked(folderAccess).mockResolvedValue('prompt');
  expect(await runDueBackup()).toBe('needs-access');
  expect(writeBackup).not.toHaveBeenCalled();
  expect(await last()).toBeNull();
});

test('folder gone', async () => {
  vi.mocked(writeBackup).mockRejectedValue(new DOMException('', 'NotFoundError'));
  expect(await runDueBackup()).toBe('missing');
  expect(await last()).toBeNull();
});

test('due backup writes once and marks done', async () => {
  expect(await runDueBackup()).toBe('done');
  expect(writeBackup).toHaveBeenCalledTimes(1);
  expect(vi.mocked(writeBackup).mock.calls[0][1]).toBe('sao-luu');
  expect(await runDueBackup()).toBe('skipped');
});

test('takes the lock', async () => {
  await runDueBackup();
  expect(request).toHaveBeenCalledWith('qldc-backup', expect.any(Function));
});

test('no folder', async () => {
  vi.mocked(getFolder).mockResolvedValue(null);
  expect(await runDueBackup()).toBe('skipped');
  expect(await backUpNow()).toBe('downloaded');
  expect(downloadBackup).toHaveBeenCalledTimes(1);
  expect(await last()).not.toBeNull();
});

test('import with auto off', async () => {
  await route('/backup/options', 'POST', { auto: false, days: 1 });
  expect(await backupAfterImport()).toBe('skipped');
});

test('restore writes a safety copy first', async () => {
  const file = await route<{ residents: unknown[] }>('/backup', 'POST');
  await route('/residents', 'POST', { full_name: 'Lê Văn Cường' });
  vi.mocked(writeBackup).mockImplementation(async () => {
    expect(await db.residents.count()).toBe(1);
    return 'x';
  });
  await restoreBackup(file);
  expect(vi.mocked(writeBackup).mock.calls[0][1]).toBe('truoc-khoi-phuc');
  expect(await db.residents.count()).toBe(0);
});
