import { gender, relation } from '@/backend/import';
import type { Gender, Relation, ResidentInput } from '@/lib/api/residents.api';

import { fromDisplayDate } from '../../residents/labels';
import { fold } from './parse';
import { TARGETS, emptyRow, type PendingRow, type RawTable, type RowEdits } from './targets';

/**
 * Waiting list = mapped table rows + rows entered directly (chat text, paper form), with manual edits on top.
 * Rows of one household share a placeholder code (VB-001 for file/paste, PB-001 for paper);
 * the server swaps these for real codes on commit.
 * ID numbers are cut to their last 4 digits here, before anything is sent.
 */
export function buildPending(tables: RawTable[], direct: PendingRow[], edits: RowEdits): { rows: PendingRow[]; cccdDetected: boolean } {
  let cccdDetected = false;
  const counters = { VB: 0, PB: 0 };
  const codes = new Map<string, string>();
  const codeFor = (kind: 'VB' | 'PB', key: string) => {
    const id = kind + key;
    if (!codes.has(id)) codes.set(id, `${kind}-${String(++counters[kind]).padStart(3, '0')}`);
    return codes.get(id)!;
  };

  const rows: PendingRow[] = [];

  for (const table of tables) {
    table.rows.forEach((cells, rowIndex) => {
      const row = emptyRow(table.source, table.id);
      row.key = `${table.id}:${rowIndex}`;
      table.mapping.forEach((target, column) => {
        if (target && !row[target]) row[target] = cells[column] ?? '';
      });
      if (!TARGETS.some((target) => row[target])) return;
      Object.assign(row, edits[row.key]);

      const key = row.address ? `${table.id}:${fold(row.address)}` : `${table.id}:row${rowIndex}`;
      row.household_code ||= codeFor('VB', key);
      rows.push(row);
    });
  }

  direct.forEach((source, index) => {
    const key = `direct:${index}`;
    const row = { ...source, ...edits[key], key };
    const kind = row.source === 'paper' ? 'PB' : 'VB';
    rows.push({ ...row, household_code: row.household_code || codeFor(kind, row.group) });
  });

  for (const row of rows) {
    const digits = row.id_last4.replace(/\D/g, '');
    if (digits.length > 4) cccdDetected = true;
    row.id_last4 = digits.length >= 4 ? digits.slice(-4) : '';
  }

  return { rows, cccdDetected };
}

/** What the row's drawer shows: the row as the server will read it (codes for gender and relation). */
export function formValuesOf(row: PendingRow): Partial<ResidentInput> {
  return {
    household_code: row.household_code,
    full_name: row.full_name,
    birth_year: Number(row.birth_year) || null,
    gender: gender(row.gender) as Gender,
    phone: row.phone,
    address: row.address,
    relation: relation(row.relation) as Relation,
    note: row.note,
    health_exam: row.health_exam,
    residence_status: row.residence_status,
    verify_status: row.verify_status,
    occupation: row.occupation,
    policy_tags: row.policy_tags,
    support_flags: row.support_flags,
    bhyt_number: row.bhyt_number,
    exam_date: row.exam_date ?? null,
    exam_place: row.exam_place,
  };
}

/** The row's manual edit made from what the drawer's form returned. The ID digits are not in the form and stay. */
export function editFromForm(input: Partial<ResidentInput>): RowEdits[string] {
  return {
    full_name: input.full_name ?? '',
    birth_year: input.birth_year ? String(input.birth_year) : '',
    gender: input.gender ?? '',
    phone: input.phone ?? '',
    address: input.address ?? '',
    household_code: input.household_code ?? '',
    relation: input.relation ?? 'other',
    note: input.note ?? '',
    health_exam: !!input.health_exam,
    residence_status: input.residence_status,
    verify_status: input.verify_status,
    occupation: input.occupation,
    policy_tags: input.policy_tags,
    support_flags: input.support_flags,
    bhyt_number: input.bhyt_number,
    exam_date: fromDisplayDate(input.exam_date ?? ''),
    exam_place: input.exam_place,
  };
}

/** True when the row carries anything the table's columns do not show. The form fills in defaults, which do not count. */
export function hasExtras(row: PendingRow): boolean {
  return !!(
    row.occupation || row.bhyt_number || row.exam_date || row.exam_place || row.health_exam ||
    row.policy_tags?.length || row.support_flags?.length ||
    (row.residence_status && row.residence_status !== 'unknown') ||
    (row.verify_status && row.verify_status !== 'unverified')
  );
}
