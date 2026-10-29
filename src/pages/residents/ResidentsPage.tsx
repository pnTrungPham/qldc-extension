import { useCallback, useState } from 'react';
import { Plus, Trash2, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useBulkResidents, useResidents, type Resident } from '@/lib/api/residents.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageLayout from '@/components/layout/PageLayout';

import { RELATION_LABELS, formatPhone } from './labels';
import BulkDeleteDialog from './components/BulkDeleteDialog';
import DeleteResidentDialog from './components/DeleteResidentDialog';
import ResidenceStatusBadge, { RESIDENCE_STATUS_LABELS } from './components/ResidenceStatusBadge';
import ResidentBulkBar from './components/ResidentBulkBar';
import ResidentDetailSheet from './components/ResidentDetailSheet';
import type { AddDefaults } from './components/ResidentForm';
import ResidentFilters, { NO_FILTERS, type Filters } from './components/ResidentFilters';
import ShareDialog from './components/ShareDialog';

const PAGE_SIZES = [5, 10, 20];

const MUTED = (text: string) => <span className="text-muted-foreground">{text}</span>;

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
    };
  });
  const [adding, setAdding] = useState(false);
  // Adding a member to a household: its code and address, and who to go back to afterwards.
  const [addTo, setAddTo] = useState<{ defaults: AddDefaults; returnTo: Resident } | null>(null);
  const [open, setOpen] = useState<Resident | null>(null);
  const [sharing, setSharing] = useState<Resident | null>(null);
  const [deleting, setDeleting] = useState<Resident | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  // ids = the people the dialog acts on (the checked rows, or the single row whose button was pressed).
  const [bulkDialog, setBulkDialog] = useState<{ mode: 'trash' | 'purge' | 'empty'; ids: number[] } | null>(null);
  const restoring = useBulkResidents();
  const [trash, setTrash] = useState(false);

  const residents = useResidents({ page, per_page: perPage, ...filters, trash });
  const items = residents.data?.items ?? [];
  const total = residents.data?.total ?? 0;
  const households = residents.data?.households ?? 0;
  const trashed = residents.data?.trashed ?? 0;
  const totalPages = Math.max(1, residents.data?.total_pages ?? 1);
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);

  const allSelected = items.length > 0 && items.every((r) => selected.includes(r.id));

  // A new page or filter shows other rows, so the old selection no longer applies.
  const goToPage = (next: number) => {
    setPage(next);
    setSelected([]);
  };

  const onFilters = useCallback((next: Filters) => {
    setFilters(next);
    setPage(1);
    setSelected([]);
  }, []);

  const showTrash = (value: boolean) => {
    setTrash(value);
    setPage(1);
    setSelected([]);
    setOpen(null);
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
                <TableHead>{i18n.__('Full name', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{i18n.__('Year of birth', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{i18n.__('Relationship', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{i18n.__('Address', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{i18n.__('Phone', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{i18n.__('Residence', 'quan-li-dan-cu')}</TableHead>
                <TableHead>{trash ? i18n.__('Deleted', 'quan-li-dan-cu') : i18n.__('Health exam 2026', 'quan-li-dan-cu')}</TableHead>
                {trash && caps.edit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((resident) => (
                <TableRow
                  key={resident.id}
                  className={trash ? undefined : 'cursor-pointer'}
                  data-state={open?.id === resident.id ? 'selected' : undefined}
                  onClick={() => !trash && setOpen(resident)}
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
                    {resident.household_code && (
                      <div className="text-xs text-muted-foreground">
                        {resident.household_code}
                        {resident.household_size
                          ? ` · ${i18n.sprintf(
                              /* translators: %d: number of people in the household */
                              i18n._n('%d person', '%d people', resident.household_size, 'quan-li-dan-cu'),
                              resident.household_size,
                            )}`
                          : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{resident.birth_year || MUTED('—')}</TableCell>
                  <TableCell>{RELATION_LABELS[resident.relation]}</TableCell>
                  <TableCell>{resident.address || MUTED('—')}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {resident.phone ? formatPhone(resident.phone) : MUTED(i18n.__('No number', 'quan-li-dan-cu'))}
                  </TableCell>
                  <TableCell>
                    <ResidenceStatusBadge status={resident.residence_status} />
                  </TableCell>
                  <TableCell>
                    {trash ? (
                      <span className="text-muted-foreground">
                        {resident.deleted_at ? new Date(resident.deleted_at.replace(' ', 'T') + 'Z').toLocaleDateString() : ''}
                      </span>
                    ) : resident.health_exam ? (
                      <Badge variant="success-soft">{i18n.__('Examined', 'quan-li-dan-cu')}</Badge>
                    ) : (
                      <Badge variant="destructive-soft">{i18n.__('Not examined', 'quan-li-dan-cu')}</Badge>
                    )}
                  </TableCell>
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
          onClose={() => setOpen(null)}
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
          }}
        />
      )}
      {sharing && <ShareDialog resident={sharing} onClose={() => setSharing(null)} />}
      {deleting && (
        <DeleteResidentDialog
          resident={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (open?.id === deleting.id) setOpen(null);
            setDeleting(null);
            if (items.length === 1 && page > 1) setPage(page - 1);
          }}
        />
      )}
    </PageLayout>
  );
}
