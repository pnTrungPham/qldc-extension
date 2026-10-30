import type { ReactNode } from 'react';

import { i18n } from '@/lib/i18n';
import type { ColumnId } from '@/lib/columns';
import type { Resident } from '@/lib/api/residents.api';
import { Badge } from '@/components/ui/badge';

import { GENDER_LABELS, POLICY_LABELS, RELATION_LABELS, VERIFY_LABELS, formatPhone, toDisplayDate } from './labels';
import ResidenceStatusBadge from './components/ResidenceStatusBadge';

const MUTED = (text: string) => <span className="text-muted-foreground">{text}</span>;
const dash = (value: ReactNode) => value || MUTED('—');

/** How each optional column of the residents table is titled and drawn. Order here is the order in the table. */
export const COLUMN_VIEW: Record<ColumnId, { label: string; cell: (r: Resident) => ReactNode; className?: string }> = {
  birth_year: { label: i18n.__('Year of birth', 'quan-li-dan-cu'), cell: (r) => dash(r.birth_year) },
  gender: { label: i18n.__('Gender', 'quan-li-dan-cu'), cell: (r) => dash(GENDER_LABELS[r.gender]) },
  relation: { label: i18n.__('Relationship', 'quan-li-dan-cu'), cell: (r) => RELATION_LABELS[r.relation] },
  address: { label: i18n.__('Address', 'quan-li-dan-cu'), cell: (r) => dash(r.address) },
  phone: {
    label: i18n.__('Phone', 'quan-li-dan-cu'),
    className: 'whitespace-nowrap',
    cell: (r) => (r.phone ? formatPhone(r.phone) : MUTED(i18n.__('No number', 'quan-li-dan-cu'))),
  },
  occupation: { label: i18n.__('Occupation', 'quan-li-dan-cu'), cell: (r) => dash(r.occupation) },
  residence_status: { label: i18n.__('Residence', 'quan-li-dan-cu'), cell: (r) => <ResidenceStatusBadge status={r.residence_status} /> },
  verify_status: { label: i18n.__('Document verification', 'quan-li-dan-cu'), cell: (r) => VERIFY_LABELS[r.verify_status] },
  policy_tags: {
    label: i18n.__('Policy labels', 'quan-li-dan-cu'),
    cell: (r) => dash(r.policy_tags.map((tag) => POLICY_LABELS[tag] ?? tag).join(', ')),
  },
  bhyt_number: { label: i18n.__('Health insurance (BHYT) number', 'quan-li-dan-cu'), className: 'whitespace-nowrap', cell: (r) => dash(r.bhyt_number) },
  exam: {
    label: i18n.__('Health exam 2026', 'quan-li-dan-cu'),
    cell: (r) =>
      r.health_exam ? (
        <Badge variant="success-soft">{i18n.__('Examined', 'quan-li-dan-cu')}</Badge>
      ) : (
        <Badge variant="destructive-soft">{i18n.__('Not examined', 'quan-li-dan-cu')}</Badge>
      ),
  },
  exam_date: { label: i18n.__('Examination date', 'quan-li-dan-cu'), className: 'whitespace-nowrap', cell: (r) => dash(toDisplayDate(r.exam_date)) },
  exam_place: { label: i18n.__('Examination place', 'quan-li-dan-cu'), cell: (r) => dash(r.exam_place) },
  note: { label: i18n.__('Situation notes', 'quan-li-dan-cu'), className: 'max-w-56 truncate', cell: (r) => dash(r.note) },
};
