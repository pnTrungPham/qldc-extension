import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';

/** Mirror Services\BackupService. `content` is the base64 of the .kpb file. */
export type BackupSummary = { date: string; households: number; people: number };

export const useCreateBackup = () =>
  useMutation({ mutationFn: () => api<BackupSummary & { content: string }>('/backup', 'POST', {}) });

export const useInspectBackup = () =>
  useMutation({ mutationFn: (content: string) => api<BackupSummary>('/restore/inspect', 'POST', { content }) });

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api<BackupSummary>('/restore/commit', 'POST', { content }),
    // Residents, ward settings and the export preview all changed.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
