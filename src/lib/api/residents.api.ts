import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from './client';

/** Residents changed: the lists, and the numbers on the overview, are stale. */
export const invalidateResidents = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'residents' || query.queryKey[0] === 'stats' });

/** Mirror Models\Resident constants and the qldc_residents columns (Engine\ActDeact). */
export type Gender = '' | 'male' | 'female' | 'other';
export type Relation = 'head' | 'spouse' | 'child' | 'parent' | 'grandparent' | 'grandchild' | 'sibling' | 'other';
export type ResidenceStatus = 'permanent' | 'temporary' | 'absent' | 'moved' | 'unknown';
export type VerifyStatus = 'unverified' | 'verified' | 'expired' | 'not_required';

export type ResidentInput = {
  household_code: string;
  full_name: string;
  birth_year: number | null;
  gender: Gender;
  phone: string;
  address: string;
  relation: Relation;
  is_head: boolean;
  residence_status: ResidenceStatus;
  verify_status: VerifyStatus;
  occupation: string;
  policy_tags: string[];
  support_flags: string[];
  id_last4: string;
  bhyt_number: string;
  health_exam: boolean;
  exam_date: string | null;
  exam_place: string;
  note: string;
};

export type Resident = ResidentInput & {
  id: number;
  /** Residents sharing household_code (list only). */
  household_size?: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  /** Set while the resident is in the trash. */
  deleted_at: string | null;
};

export type ResidentPage = {
  items: Resident[];
  total: number;
  total_pages: number;
  households: number;
  /** Residents currently in the trash. */
  trashed: number;
};

export type SortKey = 'name' | 'birth_year' | 'exam_date' | 'deleted';
type ListParams = { search: string; trash?: boolean; sort?: SortKey; order?: 'asc' | 'desc' } & Partial<Record<'status' | 'exam' | 'phone' | 'head' | 'verify' | 'policy' | 'support', string>>;

const listQuery = (params: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '' && value !== false)
      .map(([key, value]) => [key, String(value)]),
  );

export function useResidents(params: { page: number; per_page: number } & ListParams) {
  return useQuery({
    queryKey: ['residents', params],
    queryFn: () => api<ResidentPage>(`/residents?${listQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Everyone the filters match, not only the page on screen: what "select all results" acts on. */
export const fetchResidentIds = (params: ListParams) => api<{ ids: number[] }>(`/residents/ids?${listQuery(params)}`).then((r) => r.ids);

/** The live resident this input refers to (same name and birth year), or null. Asked before adding someone. */
export const useFindMatch = () => useMutation({ mutationFn: (data: Partial<ResidentInput>) => api<Resident | null>('/residents/match', 'POST', data) });

export type HouseholdSummary = { code: string; head_name: string; address: string; size: number; has_head: boolean };

/** Households matching `search` (code, a member's name or an address), for moving a person into one. */
export function useHouseholds(search: string, exclude: string) {
  const query = new URLSearchParams({ search, exclude });
  return useQuery({
    // Starts with 'residents' so every change to residents refreshes it.
    queryKey: ['residents', 'households', search, exclude],
    queryFn: () => api<HouseholdSummary[]>(`/households?${query}`),
    placeholderData: keepPreviousData,
  });
}

/** One person leaves their household and heads a new one with the next free code. */
export function useSplitHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Resident>(`/residents/${id}/split`, 'POST'),
    onSuccess: () => invalidateResidents(queryClient),
  });
}

/** The live residents of one household (a household has far fewer than 200 people). */
export function useHousehold(code: string) {
  return useQuery({
    queryKey: ['residents', 'household', code],
    queryFn: () => api<ResidentPage>(`/residents?household=${encodeURIComponent(code)}&per_page=200`),
    enabled: code !== '',
  });
}

/** Create when id is absent, else patch only the given fields. */
export function useSaveResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: Partial<ResidentInput> }) =>
      id ? api<Resident>(`/residents/${id}`, 'PATCH', data) : api<Resident>('/residents', 'POST', data),
    onSuccess: () => invalidateResidents(queryClient),
  });
}

export function useDeleteResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<boolean>(`/residents/${id}`, 'DELETE'),
    onSuccess: () => invalidateResidents(queryClient),
  });
}

export type BulkAction =
  | { action: 'delete' | 'restore' | 'purge' }
  | { action: 'set_residence_status'; value: ResidenceStatus }
  | { action: 'set_health_exam'; value: 'yes' | 'no' }
  | { action: 'set_verify_status'; value: VerifyStatus }
  | { action: 'add_policy_tag' | 'remove_policy_tag'; value: string };

/** One change for many residents, applied all-or-nothing. Resolves with how many rows changed. */
export function useBulkResidents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, ...change }: { ids: number[] } & BulkAction) =>
      api<{ affected: number }>('/residents/bulk', 'POST', { ids, ...change }),
    onSuccess: () => invalidateResidents(queryClient),
  });
}

/** Deletes everything in the trash for good. */
export function useEmptyTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ affected: number }>('/residents/trash', 'DELETE'),
    onSuccess: () => invalidateResidents(queryClient),
  });
}
