import { useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { cn } from '@/lib/utils';
import { downloadXlsx } from '@/lib/excel';
import { useExport, type ExportFilters } from '@/lib/api/export.api';
import { useSettings } from '@/lib/api/settings.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageLayout from '@/components/layout/PageLayout';
import FilterSelect from '@/components/shared/FilterSelect';
import NoAccess from '@/components/shared/NoAccess';

import { POLICY_LABELS } from '../residents/labels';
import { RESIDENCE_STATUS_LABELS } from '../residents/components/ResidenceStatusBadge';
import { COLUMNS, DEFAULT_COLUMNS, PRESETS } from './lib/columns';
import { printTable } from './lib/print';

const PREVIEW_ROWS = 15;
const NO_FILTERS: ExportFilters = { search: '', status: '', exam: '', policy: '' };

export default function ExportPage({ title }: { title: string }) {
  const { data: settings } = useSettings();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selected, setSelected] = useState(DEFAULT_COLUMNS);

  const result = useExport(filters, selected);
  if (!caps.manage) return <NoAccess title={title} />;

  // Keep file order no matter in which order the chips were clicked.
  const columns = COLUMNS.filter((c) => selected.includes(c.key));
  const rows = (result.data?.rows ?? []).map((row) => columns.map((c) => c.format(row)));
  const total = result.data?.total ?? 0;
  const heading = settings.ward_name ? `${settings.ward_code} · ${settings.ward_name}` : settings.ward_code;

  async function download() {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await downloadXlsx(
      `${i18n.__('Resident-list', 'quan-li-dan-cu')}-${settings.ward_code}-${date}.xlsx`,
      [columns.map((c) => c.label), ...rows],
      heading,
    );
  }

  function print() {
    const opened = printTable(heading, columns.map((c) => c.label), rows, i18n.__('Internal data. Do not share without permission.', 'quan-li-dan-cu'));
    if (!opened) toast.error(i18n.__('The print window was blocked. Allow pop-ups for this site and try again.', 'quan-li-dan-cu'));
  }

  const toggle = (key: string) => setSelected(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  const pick = (name: keyof ExportFilters) => (value: string) => setFilters({ ...filters, [name]: value });

  return (
    <PageLayout title={title} description={i18n.__('Choose who is in the file and which columns it has, then download or print.', 'quan-li-dan-cu')}>
      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Who is in the file', 'quan-li-dan-cu')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder={i18n.__('Keyword', 'quan-li-dan-cu')}
            />
          </div>
          <FilterSelect label={i18n.__('Health exam', 'quan-li-dan-cu')} value={filters.exam} onChange={pick('exam')} options={{ yes: i18n.__('Examined', 'quan-li-dan-cu'), no: i18n.__('Not examined', 'quan-li-dan-cu') }} />
          <FilterSelect label={i18n.__('Residence', 'quan-li-dan-cu')} value={filters.status} onChange={pick('status')} options={RESIDENCE_STATUS_LABELS} />
          <FilterSelect label={i18n.__('Policy', 'quan-li-dan-cu')} value={filters.policy} onChange={pick('policy')} options={POLICY_LABELS} />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Columns', 'quan-li-dan-cu')}</h2>
        <div className="flex flex-wrap gap-2">
          {COLUMNS.map((column) => {
            const on = selected.includes(column.key);
            return (
              <button
                key={column.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(column.key)}
                className={cn('h-7 cursor-pointer rounded-full border px-3 text-xs transition-colors', on ? 'border-primary bg-primary/6 text-primary' : 'text-muted-foreground-600 hover:border-primary')}
              >
                {column.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset.label} variant="outline" size="sm" onClick={() => setSelected(preset.columns)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-semibold">
            {i18n.sprintf(
              /* translators: 1: number of people in the file, 2: rows shown on screen */
              i18n.__('Preview · %1$d people · the screen shows %2$d rows, the file has all of them', 'quan-li-dan-cu'),
              total,
              Math.min(PREVIEW_ROWS, total),
            )}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} disabled={!total || !columns.length}>
              <Printer /> {i18n.__('Print list (PDF)', 'quan-li-dan-cu')}
            </Button>
            <Button onClick={download} disabled={!total || !columns.length}>
              <Download /> {i18n.__('Download Excel', 'quan-li-dan-cu')}
            </Button>
          </div>
        </div>

        {!columns.length ? (
          <p className="m-0 text-sm text-muted-foreground">{i18n.__('Choose at least one column.', 'quan-li-dan-cu')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table className="[&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="[&_th]:text-xs [&_th]:uppercase">
                  {columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-20 text-center text-muted-foreground">
                      {result.isFetching ? i18n.__('Loading…', 'quan-li-dan-cu') : i18n.__('No matching residents.', 'quan-li-dan-cu')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="m-0 text-xs text-muted-foreground">{i18n.__('Internal data. Do not share without permission.', 'quan-li-dan-cu')}</p>
      </section>
    </PageLayout>
  );
}
