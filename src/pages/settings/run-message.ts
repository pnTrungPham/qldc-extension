import { i18n } from '@/lib/i18n';
import type { RunResult } from '@/lib/auto-backup';

/** What "Back up now" tells the user; null when there is nothing to say. */
export function runMessage(result: RunResult): string | null {
  switch (result) {
    case 'done':
      return i18n.__('Backup saved to the folder.', 'quan-li-dan-cu');
    case 'downloaded':
      return i18n.__('Backup downloaded.', 'quan-li-dan-cu');
    case 'needs-access':
      return i18n.__('Allow access to the backup folder to save a backup.', 'quan-li-dan-cu');
    case 'missing':
      return i18n.__('The backup folder is gone. Choose it again in Settings.', 'quan-li-dan-cu');
    default:
      return null;
  }
}
