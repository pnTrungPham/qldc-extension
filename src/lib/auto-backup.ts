import { toast } from 'sonner';

import { api } from '@/lib/api/client';
import type { BackupFile, BackupStatus, BackupSummary } from '@/lib/api/backup.api';
import { downloadBackup, folderAccess, getFolder, writeBackup, type BackupKind } from '@/lib/backup-folder';
import { i18n } from '@/lib/i18n';

export type RunResult = 'done' | 'downloaded' | 'skipped' | 'needs-access' | 'missing';

const HOUR = 60 * 60 * 1000;

export const backUpNow = (kind: BackupKind = 'sao-luu') => backup(kind, false);

/** `onlyIfDue` re-checks inside the lock, so concurrent tabs or runs write once. */
async function backup(kind: BackupKind, onlyIfDue: boolean): Promise<RunResult> {
  const scheduled = kind === 'sao-luu';
  return await navigator.locks.request('qldc-backup', async (): Promise<RunResult> => {
    const dir = await getFolder();
    if (onlyIfDue && (!dir || !(await api<BackupStatus>('/backup/status')).due)) return 'skipped';
    const file = await api<BackupFile>('/backup', 'POST');
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

export const runDueBackup = () => backup('sao-luu', true);

export async function backupAfterImport(): Promise<RunResult> {
  const [status, dir] = await Promise.all([api<BackupStatus>('/backup/status'), getFolder()]);
  return status.auto && dir ? backUpNow() : 'skipped';
}

export async function restoreBackup(file: unknown): Promise<BackupSummary> {
  try {
    await backUpNow('truoc-khoi-phuc');
  } catch (e) {
    console.error(e); // the in-database before-restore copy still protects the data
  }
  return api<BackupSummary>('/restore/commit', 'POST', { file });
}

let running: (() => void) | null = null;

export function startAutoBackup(): () => void {
  if (running) return running; // StrictMode mounts effects twice
  let asked = false;
  let failed = false;
  let gone = false;
  const run = async () => {
    let result: RunResult = 'skipped';
    try {
      result = await runDueBackup();
    } catch (e) {
      console.error(e);
      if (!failed) {
        failed = true;
        toast.error(i18n.__('The backup could not be saved.', 'quan-li-dan-cu'));
      }
    }
    const dir = result === 'needs-access' && !asked ? await getFolder() : null;
    if (dir) {
      asked = true;
      toast.warning(i18n.__('Automatic backup needs permission to use the backup folder.', 'quan-li-dan-cu'), {
        duration: Infinity,
        action: {
          label: i18n.__('Continue automatic backup', 'quan-li-dan-cu'),
          // Uses the handle already in scope: awaiting getFolder() here would lose the click's user activation.
          onClick: () => {
            void folderAccess(dir, true)
              .then(() => runDueBackup())
              .catch(console.error);
          },
        },
      });
    } else if (result === 'missing' && !gone) {
      gone = true;
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
  const tick = () => void run().catch(console.error);
  tick();
  const id = setInterval(tick, HOUR);
  return (running = () => {
    clearInterval(id);
    running = null;
  });
}
