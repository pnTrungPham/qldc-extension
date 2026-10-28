import type { AuditRow } from '@/backend/db';

import type { Resident } from './residents.api';
import type { Settings } from './settings.api';

/** The backup file: every table, as plain JSON. */
export type BackupFile = {
  format: 'qldc-backup';
  version: 1;
  created_at: string;
  counts: { households: number; people: number };
  residents: Resident[];
  audit: AuditRow[];
  settings: Settings;
};

/** What a backup holds; `date` is its `created_at`. */
export type BackupSummary = { date: string; households: number; people: number };
