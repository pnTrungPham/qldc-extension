import { i18n } from '@/lib/i18n';
import type { ExportRow } from '@/lib/api/export.api';

import { POLICY_LABELS, RELATION_LABELS, formatPhone, toDisplayDate } from '../../residents/labels';
import { RESIDENCE_STATUS_LABELS } from '../../residents/components/ResidenceStatusBadge';

type Column = { key: string; label: string; format: (row: ExportRow) => string };

const text = (key: string) => (row: ExportRow) => String(row[key] ?? '');
const lookup = (key: string, labels: Record<string, string>) => (row: ExportRow) => labels[String(row[key])] ?? String(row[key] ?? '');

/** In file order. Keys mirror Models\Resident::EXPORT_COLUMNS (PHP owns the whitelist). */
export const COLUMNS: Column[] = [
  { key: 'full_name', label: i18n.__('Full name', 'quan-li-dan-cu'), format: text('full_name') },
  { key: 'birth_year', label: i18n.__('Year of birth', 'quan-li-dan-cu'), format: text('birth_year') },
  { key: 'phone', label: i18n.__('Phone', 'quan-li-dan-cu'), format: (row) => formatPhone(String(row.phone ?? '')) },
  { key: 'bhyt_number', label: i18n.__('Health insurance number', 'quan-li-dan-cu'), format: text('bhyt_number') },
  {
    key: 'health_exam',
    label: i18n.__('Health exam 2026', 'quan-li-dan-cu'),
    format: (row) => (row.health_exam ? i18n.__('Examined', 'quan-li-dan-cu') : i18n.__('Not examined', 'quan-li-dan-cu')),
  },
  { key: 'exam_date', label: i18n.__('Examination date', 'quan-li-dan-cu'), format: (row) => toDisplayDate((row.exam_date as string | null) ?? null) },
  { key: 'exam_place', label: i18n.__('Examination place', 'quan-li-dan-cu'), format: text('exam_place') },
  { key: 'residence_status', label: i18n.__('Residence status', 'quan-li-dan-cu'), format: lookup('residence_status', RESIDENCE_STATUS_LABELS) },
  {
    key: 'is_head',
    label: i18n.__('Household role', 'quan-li-dan-cu'),
    format: (row) => (row.is_head ? i18n.__('Head', 'quan-li-dan-cu') : i18n.__('Member', 'quan-li-dan-cu')),
  },
  { key: 'relation', label: i18n.__('Relationship to head', 'quan-li-dan-cu'), format: lookup('relation', RELATION_LABELS) },
  { key: 'household_code', label: i18n.__('Household code', 'quan-li-dan-cu'), format: text('household_code') },
  { key: 'address', label: i18n.__('Address', 'quan-li-dan-cu'), format: text('address') },
  { key: 'occupation', label: i18n.__('Occupation', 'quan-li-dan-cu'), format: text('occupation') },
  {
    key: 'policy_tags',
    label: i18n.__('Policy labels', 'quan-li-dan-cu'),
    format: (row) => ((row.policy_tags as string[]) ?? []).map((tag) => POLICY_LABELS[tag] ?? tag).join(', '),
  },
  { key: 'note', label: i18n.__('Situation notes', 'quan-li-dan-cu'), format: text('note') },
];

export const DEFAULT_COLUMNS = ['full_name', 'birth_year', 'phone', 'address', 'residence_status', 'relation'];

export const PRESETS: Array<{ label: string; columns: string[] }> = [
  {
    label: i18n.__('Health & insurance template', 'quan-li-dan-cu'),
    columns: ['full_name', 'birth_year', 'bhyt_number', 'health_exam', 'exam_date', 'exam_place'],
  },
  { label: i18n.__('Phone book template', 'quan-li-dan-cu'), columns: ['full_name', 'phone', 'address', 'relation'] },
  { label: i18n.__('All columns', 'quan-li-dan-cu'), columns: COLUMNS.map((c) => c.key) },
];
