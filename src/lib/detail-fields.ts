import { listPref } from './list-pref';

/**
 * Fields of the resident detail drawer the user can hide, in drawer order. Always shown: full name, year of
 * birth, household code, relationship, address and the household members. A hidden field keeps its value.
 */
export const DETAIL_FIELD_IDS = [
  'gender', 'phone', 'occupation', 'residence_status', 'verify_status', 'policy_tags', 'support_flags',
  'bhyt_number', 'health_exam', 'exam_date', 'exam_place', 'note',
] as const;
export type DetailFieldId = (typeof DETAIL_FIELD_IDS)[number];

export const DEFAULT_DETAIL_FIELDS: DetailFieldId[] = [...DETAIL_FIELD_IDS];

const fields = listPref('qldc-detail-fields', DETAIL_FIELD_IDS, DEFAULT_DETAIL_FIELDS);
export const parseDetailFields = fields.parse;
export const useDetailFields = fields.use;
