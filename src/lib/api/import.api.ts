import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { runMessage } from '@/lib/run-message';
import type { RunResult } from '../auto-backup';
import { backupAfterImport } from '../auto-backup';
import { api } from './client';
import { invalidateResidents } from './residents.api';

/** Mirror Services\ImportService responses. */
export type PreviewRow = { index: number; missing_name: boolean; error: string | null; will_update: boolean };
export type ImportPreview = { rows: PreviewRow[]; will_add: number; will_update: number; invalid: number };
export type ImportResult = { added_people: number; added_households: number; updated: number; skipped: number };

// The waiting-list drawer adds tag lists and optional details to the plain text fields.
type Row = Record<string, string | boolean | string[] | null | undefined>;

/** What each row would become, without writing. Refetches when the rows or the option change. */
export function useImportPreview(rows: Row[], autoUpdate: boolean) {
  return useQuery({
    queryKey: ['import-preview', rows, autoUpdate],
    queryFn: () => api<ImportPreview>('/import/preview', 'POST', { rows, auto_update: autoUpdate }),
    enabled: rows.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** The import already succeeded: a backup problem is only reported, never thrown. */
export async function handleAfterImport(run: Promise<RunResult>): Promise<void> {
  try {
    const result = await run;
    if (result === 'needs-access' || result === 'missing') toast.warning(runMessage(result) ?? '');
  } catch (e) {
    console.error(e);
    toast.error(i18n.__('The backup could not be saved.', 'quan-li-dan-cu'));
  }
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, autoUpdate }: { rows: Row[]; autoUpdate: boolean }) =>
      api<ImportResult>('/import/commit', 'POST', { rows, auto_update: autoUpdate }),
    onSuccess: () => {
      invalidateResidents(queryClient);
      void handleAfterImport(backupAfterImport());
    },
  });
}
