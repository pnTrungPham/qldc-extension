import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bootSettings } from '../boot';
import { api } from './client';

/** Mirrors Models\Settings::DEFAULTS. */
export type Settings = {
  ward_code: string;
  ward_name: string;
};

const settingsQuery = queryOptions({
  queryKey: ['settings'],
  queryFn: () => api<Settings>('/settings'),
  // Seeded from the page load, so the first render needs no request.
  initialData: () => bootSettings,
});

export function useSettings() {
  return useQuery(settingsQuery);
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Settings) => api<Settings>('/settings', 'POST', data),
    onSuccess: (saved) => queryClient.setQueryData(settingsQuery.queryKey, saved),
  });
}
