import { toast } from 'sonner';

import { api } from '@/lib/api/client';
import type { BackupFile, BackupStatus, BackupSummary } from '@/lib/api/backup.api';
import { downloadBackup, folderAccess, getFolder, writeBackup, type BackupKind } from '@/lib/backup-folder';
import { i18n } from '@/lib/i18n';

export type RunResult = 'done' | 'downloaded' | 'skipped' | 'needs-access' | 'missing';

const HOUR = 60 * 60 * 1000;

export async function backUpNow(kind: BackupKind = 'sao-luu'): Promise<RunResult> {
  const scheduled = kind === 'sao-luu';
  return await navigator.locks.request('qldc-backup', async (): Promise<RunResult> => {
    const file = await api<BackupFile>('/backup', 'POST');
    const dir = await getFolder();
    if (!dir) {
      if (!scheduled) return 'skipped';
      downloadBackup(file);
      await api('/backup/done', 'POST');
      return 'downloaded';
    }
    if ((await folderAccess(dir)) !== 'granted') return scheduled ? 'needs-access' : 'skipped';
    try {
      await writeBackup(dir, kind, file);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return 'missing';
      throw e;
    }
    if (scheduled) await api('/backup/done', 'POST');
    return 'done';
  });
}

export async function runDueBackup(): Promise<RunResult> {
  const [status, dir] = await Promise.all([api<BackupStatus>('/backup/status'), getFolder()]);
  return status.due && dir ? backUpNow() : 'skipped';
}

export async function backupAfterImport(): Promise<RunResult> {
  const [status, dir] = await Promise.all([api<BackupStatus>('/backup/status'), getFolder()]);
  return status.auto && dir ? backUpNow() : 'skipped';
}

export async function restoreBackup(file: unknown): Promise<BackupSummary> {
  await backUpNow('truoc-khoi-phuc');
  return api<BackupSummary>('/restore/commit', 'POST', { file });
}

export function startAutoBackup(): () => void {
  let asked = false;
  const run = async () => {
    const result = await runDueBackup();
    if (result === 'needs-access' && !asked) {
      asked = true;
      toast.warning(i18n.__('Automatic backup needs permission to use the backup folder.', 'quan-li-dan-cu'), {
        action: {
          label: i18n.__('Continue automatic backup', 'quan-li-dan-cu'),
          onClick: async () => {
            const dir = await getFolder();
            if (dir && (await folderAccess(dir, true)) === 'granted') await run();
          },
        },
      });
    } else if (result === 'missing') {
      toast.error(i18n.__('The backup folder is gone. Choose it again in Settings.', 'quan-li-dan-cu'));
    }
    const status = await api<BackupStatus>('/backup/status');
    if (status.overdue && !status.warned_today) {
      toast.warning(i18n.__('It has been a while since the last backup.', 'quan-li-dan-cu'), {
        action: {
          label: i18n.__('Open backup settings', 'quan-li-dan-cu'),
          onClick: () => {
            location.hash = '#/settings?tab=backup';
          },
        },
      });
      await api('/backup/warned', 'POST');
    }
  };
  const tick = () => void run().catch(() => {});
  tick();
  const id = setInterval(tick, HOUR);
  return () => clearInterval(id);
}
