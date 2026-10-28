import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AuditRow } from '@/backend/db';

import type { Resident } from './residents.api';
import { api } from './client';
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

export type BackupOptions = { auto: boolean; days: number };
export type BackupStatus = BackupOptions & {
  last_backup_at: string | null;
  due: boolean;
  overdue: boolean;
  warned_today: boolean;
  can_undo: boolean;
};

const statusQuery = queryOptions({
  queryKey: ['backup-status'],
  queryFn: () => api<BackupStatus>('/backup/status'),
});

export function useBackupStatus() {
  return useQuery(statusQuery);
}

export function useSaveBackupOptions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BackupOptions) => api<BackupOptions>('/backup/options', 'POST', data),
    onSuccess: (saved) =>
      queryClient.setQueryData(statusQuery.queryKey, (old: BackupStatus | undefined) => old && { ...old, ...saved }),
  });
}
