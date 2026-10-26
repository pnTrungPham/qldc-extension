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
