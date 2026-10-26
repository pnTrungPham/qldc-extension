import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { invalidateResidents } from './residents.api';

/** Mirror Services\ImportService responses. */
export type PreviewRow = { index: number; missing_name: boolean; error: string | null; will_update: boolean };
export type ImportPreview = { rows: PreviewRow[]; will_add: number; will_update: number; invalid: number };
export type ImportResult = { added_people: number; added_households: number; updated: number; skipped: number };

type Row = Record<string, string | boolean>;

/** What each row would become, without writing. Refetches when the rows or the option change. */
export function useImportPreview(rows: Row[], autoUpdate: boolean) {
  return useQuery({
    queryKey: ['import-preview', rows, autoUpdate],
    queryFn: () => api<ImportPreview>('/import/preview', 'POST', { rows, auto_update: autoUpdate }),
    enabled: rows.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, autoUpdate }: { rows: Row[]; autoUpdate: boolean }) =>
      api<ImportResult>('/import/commit', 'POST', { rows, auto_update: autoUpdate }),
    onSuccess: () => invalidateResidents(queryClient),
  });
}
