import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useColumns } from '@/lib/columns';
import { fetchResidentIds, useBulkResidents, useResidents, type Resident, type SortKey } from '@/lib/api/residents.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageLayout from '@/components/layout/PageLayout';

import { COLUMN_VIEW } from './columns';
import { POLICY_LABELS, SUPPORT_LABELS, VERIFY_LABELS } from './labels';
import BulkDeleteDialog from './components/BulkDeleteDialog';
import DeleteResidentDialog from './components/DeleteResidentDialog';
import { RESIDENCE_STATUS_LABELS } from './components/ResidenceStatusBadge';
import ResidentBulkBar from './components/ResidentBulkBar';
import ResidentDetailSheet from './components/ResidentDetailSheet';
import type { AddDefaults } from './components/ResidentForm';
import ResidentFilters, { NO_FILTERS, type Filters } from './components/ResidentFilters';
import ShareDialog from './components/ShareDialog';

const PAGE_SIZES = [5, 10, 20];

/** The table columns that can be sorted, by their column id; the name is always there. */
const SORTABLE: Partial<Record<string, SortKey>> = { birth_year: 'birth_year', exam_date: 'exam_date' };

type Sorting = { key: SortKey; order: 'asc' | 'desc' } | null

export default function ResidentsPage({ title }: { title: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  // The overview links here with a ready-made filter, e.g. #/residents?status=temporary.
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => {
    const pick = (key: string, allowed: string[]) => (allowed.includes(params.get(key) ?? '') ? (params.get(key) as string) : '');
    return {
      ...NO_FILTERS,
      status: pick('status', Object.keys(RESIDENCE_STATUS_LABELS)),
      exam: pick('exam', ['yes', 'no']),
      phone: pick('phone', ['yes', 'no']),
      head: pick('head', ['yes', 'no']),
      verify: pick('verify', Object.keys(VERIFY_LABELS)),
      policy: pick('policy', Object.keys(POLICY_LABELS)),
      support: pick('support', Object.keys(SUPPORT_LABELS)),
    };
  });
  // Clicking a header: ascending, then descending, then back to the default order (newest first).
  const [sorting, setSorting] = useState<Sorting>(null);
  const [adding, setAdding] = useState(false);
  // Adding a member to a household: its code and address, and who to go back to afterwards.
  const [addTo, setAddTo] = useState<{ defaults: AddDefaults; returnTo: Resident } | null>(null);
  const [open, setOpen] = useState<Resident | null>(null);
  // Who was opened from the list. `open` follows the user through the household; this stays, so they can tell and go back.
  const [origin, setOrigin] = useState<Resident | null>(null);
  const [sharing, setSharing] = useState<Resident | null>(null);
  const [deleting, setDeleting] = useState<Resident | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  // ids = the people the dialog acts on (the checked rows, or the single row whose button was pressed).
  const [bulkDialog, setBulkDialog] = useState<{ mode: 'trash' | 'purge' | 'empty'; ids: number[] } | null>(null);
  const restoring = useBulkResidents();
  const [trash, setTrash] = useState(false);

  const [columns] = useColumns();
  // The trash shows when each person was deleted where the health exam would be.
  const shown = trash ? columns.filter((id) => id !== 'exam') : columns;

  const residents = useResidents({ page, per_page: perPage, ...filters, trash, sort: sorting?.key, order: sorting?.order });
  const items = residents.data?.items ?? [];
  const total = residents.data?.total ?? 0;
  const households = residents.data?.households ?? 0;
  const trashed = residents.data?.trashed ?? 0;
  const totalPages = Math.max(1, residents.data?.total_pages ?? 1);
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);

  const allSelected = items.length > 0 && items.every((r) => selected.includes(r.id));
  // Every page of the current filters, when the user asked for them all; the bar below the table says so.
  const [pickingAll, setPickingAll] = useState(false);
  const everyResultSelected = total > items.length && selected.length === total;

  async function selectEveryResult() {
    setPickingAll(true);
    try {
      setSelected(await fetchResidentIds({ ...filters, trash }));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPickingAll(false);
    }
  }

  // A new page shows other rows, so the old selection no longer applies, unless it already covers every result.
  const goToPage = (next: number) => {
    setPage(next);
    if (!everyResultSelected) setSelected([]);
  };

  const onFilters = useCallback((next: Filters) => {
    setFilters(next);
    setPage(1);
    setSelected([]);
  }, []);

  const sortBy = (key: SortKey) => {
    setSorting(sorting?.key !== key ? { key, order: 'asc' } : sorting.order === 'asc' ? { key, order: 'desc' } : null);
    setPage(1);
    if (!everyResultSelected) setSelected([]);
  };

  const closeDrawer = () => {
    setOpen(null);
    setOrigin(null);
  };

  const showTrash = (value: boolean) => {
    setTrash(value);
    setSorting(null);
    setPage(1);
    setSelected([]);
    closeDrawer();
  };

  return (
    <PageLayout
      title={title}
      meta={
        trash
          ? i18n.sprintf(
              /* translators: %d: number of residents in the trash */
              i18n._n('%d resident in the trash', '%d residents in the trash', total, 'quan-li-dan-cu'),
              total,
            )
          : i18n.sprintf(
              /* translators: 1: number of residents, 2: number of households */
              i18n.__('%1$s people · %2$s households', 'quan-li-dan-cu'),
              total.toLocaleString(),
              households.toLocaleString(),
            )
      }
      actions={
        trash ? (
          trashed > 0 && (
            <Button variant="destructive-outline" onClick={() => setBulkDialog({ mode: 'empty', ids: [] })}>
              <Trash2 /> {i18n.__('Empty trash', 'quan-li-dan-cu')}
            </Button>
          )
        ) : (
        <>
          {caps.manage && (
            <Button variant="outline" onClick={() => navigate('/import')}>
              <Upload /> {i18n.__('Import data', 'quan-li-dan-cu')}
            </Button>
          )}
          {caps.edit && (
            <Button onClick={() => setAdding(true)}>
              <Plus /> {i18n.__('Add resident', 'quan-li-dan-cu')}
            </Button>
          )}
        </>
        )
      }
    >
      {caps.edit && (
        <Tabs value={trash ? 'trash' : 'all'} onValueChange={(value) => showTrash(value === 'trash')}>
          <TabsList>
            <TabsTrigger value="all">{i18n.__('Residents', 'quan-li-dan-cu')}</TabsTrigger>
            <TabsTrigger value="trash">
              {i18n.sprintf(
                /* translators: %d: number of residents in the trash */
                i18n.__('Trash (%d)', 'quan-li-dan-cu'),
                trashed,
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <ResidentFilters value={filters} onChange={onFilters} />

      {caps.edit && allSelected && total > items.length && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-md bg-primary/6 px-3 py-2 text-sm">
          {everyResultSelected
            ? i18n.sprintf(/* translators: %d: number of residents */ i18n.__('All %d people matching the filters are selected.', 'quan-li-dan-cu'), total)
            : i18n.sprintf(/* translators: %d: number of residents on this page */ i18n.__('The %d people on this page are selected.', 'quan-li-dan-cu'), items.length)}
          {everyResultSelected ? (
            <Button variant="link" className="h-auto p-0" onClick={() => setSelected([])}>
              {i18n.__('Clear selection', 'quan-li-dan-cu')}
            </Button>
          ) : (
            <Button variant="link" className="h-auto p-0" disabled={pickingAll} onClick={selectEveryResult}>
              {i18n.sprintf(/* translators: %d: number of residents matching the filters */ i18n.__('Select all %d people matching the filters', 'quan-li-dan-cu'), total)}
            </Button>
          )}
        </p>
      )}

      {residents.isError ? (
        <p className="text-sm text-destructive">{residents.error.message}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow className="[&_th]:text-xs [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
                {caps.edit && (
                  <TableHead className="w-9">
                    <Checkbox
                      checked={allSelected ? true : selected.length > 0 ? 'indeterminate' : false}
                      onCheckedChange={(checked) => setSelected(checked ? items.map((r) => r.id) : [])}
                      aria-label={i18n.__('Select all', 'quan-li-dan-cu')}
                    />
                  </TableHead>
                )}
                <SortHead label={i18n.__('Full name', 'quan-li-dan-cu')} sortKey="name" sorting={sorting} onSort={sortBy} />
                {shown.map((id) => (
                  <SortHead key={id} label={COLUMN_VIEW[id].label} sortKey={SORTABLE[id]} sorting={sorting} onSort={sortBy} />
                ))}
                {trash && <SortHead label={i18n.__('Deleted', 'quan-li-dan-cu')} sortKey="deleted" sorting={sorting} onSort={sortBy} />}
                {trash && caps.edit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((resident) => (
                <TableRow
                  key={resident.id}
                  className={trash ? undefined : 'cursor-pointer'}
                  data-state={origin?.id === resident.id ? 'selected' : undefined}
                  onClick={() => {
                    if (trash) return;
                    setOpen(resident);
                    setOrigin(resident);
                  }}
                >
                  {caps.edit && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(resident.id)}
                        onCheckedChange={(checked) =>
                          setSelected(checked ? [...selected, resident.id] : selected.filter((id) => id !== resident.id))
                        }
                        aria-label={resident.full_name}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {resident.full_name}
                      {resident.is_head && <Badge variant="primary-soft">{i18n.__('Head', 'quan-li-dan-cu')}</Badge>}
                    </div>
                    {!!resident.household_size && (
                      <div className="text-xs text-muted-foreground">
                        {i18n.sprintf(
                          /* translators: %d: number of people in the household */
                          i18n._n('%d person', '%d people', resident.household_size, 'quan-li-dan-cu'),
                          resident.household_size,
                        )}
                      </div>
                    )}
                  </TableCell>
                  {shown.map((id) => (
                    <TableCell key={id} className={COLUMN_VIEW[id].className}>
                      {COLUMN_VIEW[id].cell(resident)}
                    </TableCell>
                  ))}
                  {trash && (
                    <TableCell className="text-muted-foreground">
                      {resident.deleted_at ? new Date(resident.deleted_at.replace(' ', 'T') + 'Z').toLocaleDateString() : ''}
                    </TableCell>
                  )}
                  {trash && caps.edit && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoring.isPending}
                        onClick={() =>
                          restoring.mutate(
                            { ids: [resident.id], action: 'restore' },
                            { onSuccess: () => toast.success(i18n.sprintf(/* translators: %s: resident full name */ i18n.__('Restored %s', 'quan-li-dan-cu'), resident.full_name)) },
                          )
                        }
                      >
                        <Undo2 /> {i18n.__('Restore', 'quan-li-dan-cu')}
                      </Button>{' '}
                      <Button
                        variant="destructive-outline"
                        size="icon-sm"
                        title={i18n.__('Delete permanently', 'quan-li-dan-cu')}
                        aria-label={i18n.__('Delete permanently', 'quan-li-dan-cu')}
                        onClick={() => setBulkDialog({ mode: 'purge', ids: [resident.id] })}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!items.length && (
                <TableRow>
                  <TableCell colSpan={caps.edit ? (trash ? 9 : 8) : 7} className="h-24 text-center text-muted-foreground">
                    {residents.isFetching
                      ? i18n.__('Loading…', 'quan-li-dan-cu')
                      : trash
                        ? i18n.__('The trash is empty.', 'quan-li-dan-cu')
                        : i18n.__('No matching residents.', 'quan-li-dan-cu')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {caps.edit && selected.length > 0 && (
        <ResidentBulkBar ids={selected} trash={trash} onClear={() => setSelected([])} onDelete={() => setBulkDialog({ mode: trash ? 'purge' : 'trash', ids: selected })} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {i18n.sprintf(
            /* translators: 1: first row number, 2: last row number, 3: total people */
            i18n.__('Showing %1$d–%2$d of %3$d people', 'quan-li-dan-cu'),
            from,
            to,
            total,
          )}
        </span>
        <div className="flex items-center gap-4">
          <Select
            value={String(perPage)}
            onValueChange={(value) => {
              setPerPage(Number(value));
              goToPage(1);
            }}
          >
            <SelectTrigger className="w-auto" aria-label={i18n.__('Rows per page', 'quan-li-dan-cu')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {i18n.sprintf(
                    /* translators: %d: rows per page */
                    i18n.__('%d rows', 'quan-li-dan-cu'),
                    size,
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Pagination
            pageIndex={page - 1}
            pageCount={totalPages}
            onPreviousPage={() => goToPage(page - 1)}
            onNextPage={() => goToPage(page + 1)}
            onPageChange={(pageIndex) => goToPage(pageIndex + 1)}
            canPreviousPage={page > 1}
            canNextPage={page < totalPages}
          />
        </div>
      </div>

      {open && (
        <ResidentDetailSheet
          resident={open}
          origin={origin}
          onClose={closeDrawer}
          onShare={() => setSharing(open)}
          onDelete={() => setDeleting(open)}
          onOpenMember={setOpen}
          onAddMember={(resident) => {
            setAddTo({ defaults: { household_code: resident.household_code, address: resident.address }, returnTo: resident });
            setOpen(null);
            setAdding(true);
          }}
        />
      )}
      {bulkDialog && (
        <BulkDeleteDialog
          mode={bulkDialog.mode}
          ids={bulkDialog.ids}
          count={bulkDialog.mode === 'empty' ? trashed : bulkDialog.ids.length}
          onClose={() => setBulkDialog(null)}
          onDone={() => {
            const emptied = bulkDialog.mode === 'empty';
            if (emptied || (bulkDialog.ids.length >= items.length && page > 1)) setPage(emptied ? 1 : page - 1);
            setSelected([]);
            setBulkDialog(null);
          }}
        />
      )}
      {adding && (
        <ResidentDetailSheet
          resident={null}
          defaults={addTo?.defaults}
          onClose={() => {
            setAdding(false);
            setAddTo(null);
            if (addTo) setOpen(addTo.returnTo); // back to the household it was added to
          }}
          onOpenExisting={(match) => {
            setAdding(false);
            setAddTo(null);
            setOpen(match);
            setOrigin(match);
          }}
        />
      )}
      {sharing && <ShareDialog resident={sharing} onClose={() => setSharing(null)} />}
      {deleting && (
        <DeleteResidentDialog
          resident={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (open?.id === deleting.id) closeDrawer();
            setDeleting(null);
            if (items.length === 1 && page > 1) setPage(page - 1);
          }}
        />
      )}
    </PageLayout>
  );
}

/** A column title; when the column can be sorted it is a button showing the direction it is sorted in, if any. */
function SortHead({ label, sortKey, sorting, onSort }: { label: string; sortKey?: SortKey; sorting: Sorting; onSort: (key: SortKey) => void }) {
  if (!sortKey) return <TableHead>{label}</TableHead>;
  const order = sorting?.key === sortKey ? sorting.order : null;
  const Arrow = order === 'desc' ? ArrowDown : ArrowUp;
  return (
    <TableHead aria-sort={order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : undefined}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border-0 bg-transparent p-0 text-xs tracking-wide uppercase outline-none hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-primary"
            style={{ color: order ? 'var(--primary)' : 'inherit', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit' }}
          >
            {label}
            {order && <Arrow className="size-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="normal-case tracking-normal">
          {order === 'asc'
            ? i18n.__('Click to sort descending', 'quan-li-dan-cu')
            : order === 'desc'
              ? i18n.__('Click to remove the sort', 'quan-li-dan-cu')
              : i18n.__('Click to sort ascending', 'quan-li-dan-cu')}
          {sortKey === 'name' && <div className="opacity-80">{i18n.__('Names are sorted by the given name, the last word.', 'quan-li-dan-cu')}</div>}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );
}
