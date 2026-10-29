import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useCommitImport, useImportPreview, type ImportResult } from '@/lib/api/import.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import EnumSelect from '@/components/shared/EnumSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { gender as normalizeGender, relation as normalizeRelation } from '@/backend/import';

import ResidentDetailSheet from '../../residents/components/ResidentDetailSheet';
import { GENDER_LABELS, RELATION_LABELS } from '../../residents/labels';
import { editFromForm, formValuesOf, hasExtras } from '../lib/pending';
import { TARGET_LABELS, type PendingRow, type RowEdits, type Source, type Target } from '../lib/targets';

const PAGE_SIZE = 25;
const SOURCE_LABELS: Record<Source, string> = {
  file: i18n.__('File', 'quan-li-dan-cu'),
  paste: i18n.__('Pasted', 'quan-li-dan-cu'),
  paper: i18n.__('Paper form', 'quan-li-dan-cu'),
};
const COLUMNS: Array<{ target: Target; width: string }> = [
  { target: 'full_name', width: 'min-w-44' },
  { target: 'birth_year', width: 'min-w-24' },
  { target: 'gender', width: 'min-w-20' },
  { target: 'phone', width: 'min-w-32' },
  { target: 'address', width: 'min-w-44' },
  { target: 'relation', width: 'min-w-28' },
  { target: 'household_code', width: 'min-w-28' },
];

/** The waiting list: editable preview table, the auto-update option and the confirm button. Nothing is saved before Confirm. */
export default function PendingList({
  rows,
  cccdDetected,
  autoUpdate,
  onAutoUpdate,
  onEdit,
  onEditRow,
  onClear,
  onDone,
}: {
  rows: PendingRow[];
  cccdDetected: boolean;
  autoUpdate: boolean;
  onAutoUpdate: (value: boolean) => void;
  onEdit: (key: string, target: Target, value: string) => void;
  /** Several fields of one row at once (from the row's drawer). */
  onEditRow: (key: string, patch: RowEdits[string]) => void;
  onClear: () => void;
  onDone: (result: ImportResult) => void;
}) {
  // Sent as is: the server keeps only the fields it knows.
  const preview = useImportPreview(rows, autoUpdate);
  const commit = useCommitImport();
  const [page, setPage] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editingIndex = rows.findIndex((row) => row.key === editingKey);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const flags = preview.data?.rows ?? [];
  const hasNames = rows.some((row) => row.full_name.trim());

  function confirm() {
    commit.mutate(
      { rows, autoUpdate },
      {
        onSuccess: (result) => {
          toast.success(i18n.__('Data saved.', 'quan-li-dan-cu'));
          onDone(result);
        },
      },
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold">
          {i18n.sprintf(/* translators: %d: number of rows */ i18n._n('Waiting list · %d row', 'Waiting list · %d rows', rows.length, 'quan-li-dan-cu'), rows.length)}
          {preview.data && (
            <span className="ms-2 font-normal text-muted-foreground">
              {i18n.sprintf(
                /* translators: 1: rows to add, 2: rows that update an existing person, 3: invalid rows */
                i18n.__('%1$d new · %2$d updates · %3$d invalid', 'quan-li-dan-cu'),
                preview.data.will_add,
                preview.data.will_update,
                preview.data.invalid,
              )}
            </span>
          )}
        </h3>
        <Button variant="link" className="h-auto p-0 text-destructive" onClick={onClear}>
          {i18n.__('Discard all', 'quan-li-dan-cu')}
        </Button>
      </div>

      {cccdDetected && (
        <div className="rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">
          {i18n.__('ID numbers were found in the data. Only the last 4 digits are kept.', 'quan-li-dan-cu')}
        </div>
      )}
      {!hasNames && (
        <p className="m-0 text-sm text-destructive">{i18n.__('No row has a full name. Choose the Full name column again in Column mapping.', 'quan-li-dan-cu')}</p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-1 [&_th]:px-2">
          <TableHeader>
            <TableRow className="[&_th]:text-xs [&_th]:uppercase">
              <TableHead>{i18n.__('Source', 'quan-li-dan-cu')}</TableHead>
              {COLUMNS.map(({ target }) => (
                <TableHead key={target}>{TARGET_LABELS[target]}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(start, start + PAGE_SIZE).map((row, offset) => {
              const flag = flags[start + offset];
              return (
                <TableRow key={row.key} className={cn(!row.full_name.trim() && 'bg-destructive/6')}>
                  <TableCell className="px-2 text-muted-foreground">
                    <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-inherit hover:text-primary hover:underline" onClick={() => setEditingKey(row.key)}>
                      {SOURCE_LABELS[row.source]}
                    </button>
                  </TableCell>
                  {COLUMNS.map(({ target, width }) => (
                    <TableCell key={target} className={width}>
                      {target === 'gender' || target === 'relation' ? (
                        // The cell may hold "Nam", "Vợ", "male"…: show the value the server will make of it, in Vietnamese.
                        <EnumSelect
                          value={target === 'gender' ? normalizeGender(row.gender) : normalizeRelation(row.relation)}
                          options={target === 'gender' ? GENDER_LABELS : RELATION_LABELS}
                          allowEmpty={target === 'gender'}
                          label={TARGET_LABELS[target]}
                          className="h-8 border-transparent bg-transparent shadow-none hover:border-input"
                          onChange={(value) => onEdit(row.key, target, value)}
                        />
                      ) : (
                        <Input
                          // Remount when the value changes from outside (mapping changed, list rebuilt).
                          key={row[target]}
                          defaultValue={row[target]}
                          aria-label={TARGET_LABELS[target]}
                          className={cn('h-8 border-transparent bg-transparent shadow-none hover:border-input', target === 'household_code' && 'font-mono text-xs')}
                          onBlur={(e) => e.target.value !== row[target] && onEdit(row.key, target, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="min-w-28 px-2">
                    <div className="mb-1 flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingKey(row.key)}>
                        <SlidersHorizontal /> {i18n.__('Details', 'quan-li-dan-cu')}
                      </Button>
                      {hasExtras(row) && <Badge variant="dimmed">{i18n.__('More info', 'quan-li-dan-cu')}</Badge>}
                    </div>
                    {flag?.will_update && <Badge variant="primary-soft">{i18n.__('Update', 'quan-li-dan-cu')}</Badge>}
                    {flag?.error && (
                      <div className="grid justify-items-start gap-1">
                        <Badge variant="destructive-soft">{i18n.__('Invalid', 'quan-li-dan-cu')}</Badge>
                        <span className="text-xs text-destructive">{flag.error}</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <Pagination
          pageIndex={current}
          pageCount={pageCount}
          onPreviousPage={() => setPage(current - 1)}
          onNextPage={() => setPage(current + 1)}
          onPageChange={setPage}
          canPreviousPage={current > 0}
          canNextPage={current < pageCount - 1}
        />
      )}

      {editingIndex >= 0 && (
        <ResidentDetailSheet
          resident={null}
          draft={{
            values: formValuesOf(rows[editingIndex]),
            // A person who is already recorded is only updated by phone and address: say so before the user fills in more.
            notice: flags[editingIndex]?.will_update
              ? i18n.__('Already recorded: only the phone and address will be updated.', 'quan-li-dan-cu')
              : undefined,
            onApply: (input) => onEditRow(rows[editingIndex].key, editFromForm(input)),
          }}
          onClose={() => setEditingKey(null)}
        />
      )}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={autoUpdate} onCheckedChange={(checked) => onAutoUpdate(!!checked)} />
        {i18n.__('Update people who already exist (same name + year of birth, or same name + last 4 ID digits)', 'quan-li-dan-cu')}
      </label>

      {commit.isError && <p className="m-0 text-sm text-destructive">{i18n.__('Nobody was saved.', 'quan-li-dan-cu')} {commit.error.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={confirm} disabled={commit.isPending || !hasNames}>
          {commit.isPending ? i18n.__('Importing…', 'quan-li-dan-cu') : i18n.__('Confirm import into the data', 'quan-li-dan-cu')}
        </Button>
        <span className="text-xs text-muted-foreground">{i18n.__('Until you press this, nothing is saved.', 'quan-li-dan-cu')}</span>
      </div>
    </div>
  );
}
