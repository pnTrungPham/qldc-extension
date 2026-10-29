import { listPref } from './list-pref';

/** Columns of the residents table the user can show or hide, in table order. The name is always shown. */
export const COLUMN_IDS = [
  'birth_year', 'gender', 'relation', 'address', 'phone', 'occupation', 'residence_status', 'verify_status',
  'policy_tags', 'bhyt_number', 'exam', 'exam_date', 'exam_place', 'note',
] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

/** What the table showed before the choice existed. */
export const DEFAULT_COLUMNS: ColumnId[] = ['birth_year', 'relation', 'address', 'phone', 'residence_status', 'exam'];

const columns = listPref('qldc-resident-columns', COLUMN_IDS, DEFAULT_COLUMNS);
export const parseColumns = columns.parse;
export const useColumns = columns.use;
