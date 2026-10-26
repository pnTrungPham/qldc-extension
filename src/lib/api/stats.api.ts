import { useQuery } from '@tanstack/react-query';

import { api } from './client';

/** Mirrors Repositories\ResidentRepository::stats() and Controllers\StatsRestController. */
export type Stats = {
  people: number;
  households: number;
  health_exam: number;
  residence: Record<string, number>;
  age: { child: number; adult: number; senior: number; unknown: number };
  gender: { male: number; female: number; unknown: number };
  policy: Record<string, number>;
  support: Record<string, number>;
  quality: { no_phone: number; no_birth_year: number; unverified: number; expired: number };
  /** Empty unless the user may edit. */
  recent: Array<{ action: string; user: string; resident: string | null; changed_fields: string[]; created_at: string }>;
};

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats') });
