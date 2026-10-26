import { i18n } from '@/lib/i18n';

/** Fields an import row can fill. Mirrors Services\ImportService::FIELDS (minus health_exam). */
export const TARGETS = ['full_name', 'birth_year', 'gender', 'phone', 'address', 'household_code', 'relation', 'id_last4', 'note'] as const;
export type Target = (typeof TARGETS)[number];

export const TARGET_LABELS: Record<Target, string> = {
  full_name: i18n.__('Full name', 'quan-li-dan-cu'),
  birth_year: i18n.__('Year of birth', 'quan-li-dan-cu'),
  gender: i18n.__('Gender', 'quan-li-dan-cu'),
  phone: i18n.__('Phone', 'quan-li-dan-cu'),
  address: i18n.__('Address', 'quan-li-dan-cu'),
  household_code: i18n.__('Household code', 'quan-li-dan-cu'),
  relation: i18n.__('Relationship to head', 'quan-li-dan-cu'),
  id_last4: i18n.__('ID number (last 4 digits)', 'quan-li-dan-cu'),
  note: i18n.__('Notes', 'quan-li-dan-cu'),
};

export type Source = 'file' | 'paste' | 'paper';

/**
 * One waiting-list row, ready to send. `group` ties rows of one household together before codes exist;
 * `key` stays the same while mappings change, so manual edits stick to the right row.
 */
export type PendingRow = Record<Target, string> & { health_exam: boolean; source: Source; group: string; key: string };

/** Manual fixes typed in the waiting list, by row key. They win over whatever the source said. */
export type RowEdits = Record<string, Partial<Record<Target, string>>>;

export const emptyRow = (source: Source, group: string): PendingRow => ({
  full_name: '',
  birth_year: '',
  gender: '',
  phone: '',
  address: '',
  household_code: '',
  relation: '',
  id_last4: '',
  note: '',
  health_exam: false,
  source,
  group,
  key: '',
});

/** A parsed spreadsheet whose columns still need mapping to targets. */
export type RawTable = {
  id: string;
  label: string;
  source: 'file' | 'paste';
  headers: string[];
  rows: string[][];
  /** One entry per column: the target it feeds, or '' to ignore it. */
  mapping: Array<Target | ''>;
};
