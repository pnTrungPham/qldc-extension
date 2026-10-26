import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { caps } from '../caps';
import { api } from './client';

export type ExportFilters = { search: string; status: string; exam: string; policy: string };
/** Row with only the requested columns; values are raw codes (the page turns them into labels). */
export type ExportRow = Record<string, unknown>;

/** Every matching resident, only the given columns. The server never includes ID digits. */
export function useExport(filters: ExportFilters, columns: string[]) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
  columns.forEach((column) => query.append('columns[]', column));

  return useQuery({
    queryKey: ['export', filters, columns],
    queryFn: () => api<{ total: number; rows: ExportRow[] }>(`/export?${query}`),
    enabled: caps.manage && columns.length > 0,
    placeholderData: keepPreviousData,
  });
}
