import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { downloadXlsx } from '@/lib/excel';
import { api } from '@/lib/api/client';
import type { ExportRow } from '@/lib/api/export.api';
import { useSettings } from '@/lib/api/settings.api';
import { useBulkResidents, type BulkAction, type ResidenceStatus, type VerifyStatus } from '@/lib/api/residents.api';
import { BulkActionBox } from '@/components/ui/bulk-actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

import { COLUMNS, DEFAULT_COLUMNS } from '../../export/lib/columns';
import { POLICY_LABELS, VERIFY_LABELS } from '../labels';
import { RESIDENCE_STATUS_LABELS } from './ResidenceStatusBadge';

/** "N selected" bar with the actions that apply to every checked row. */
export default function ResidentBulkBar({
  ids,
  trash,
  onClear,
  onDelete,
}: {
  ids: number[];
  /** In the trash view the actions are Restore and Delete permanently. */
  trash: boolean;
  onClear: () => void;
  onDelete: () => void;
}) {
  const bulk = useBulkResidents();
  const { data: settings } = useSettings();

  /** The chosen people as an Excel file, with the same default columns as the Export page. */
  async function exportChosen() {
    const query = new URLSearchParams();
    ids.forEach((id) => query.append('ids[]', String(id)));
    DEFAULT_COLUMNS.forEach((column) => query.append('columns[]', column));
    const { rows } = await api<{ rows: ExportRow[] }>(`/export?${query}`);
    const columns = COLUMNS.filter((c) => DEFAULT_COLUMNS.includes(c.key));
    const day = new Date().toISOString().slice(0, 10);
    await downloadXlsx(
      `${i18n.__('Resident-list', 'quan-li-dan-cu')}-${settings.ward_code}-${day}.xlsx`,
      [columns.map((c) => c.label), ...rows.map((row) => columns.map((c) => c.format(row)))],
      settings.ward_name ? `${settings.ward_code} · ${settings.ward_name}` : settings.ward_code,
    );
  }

  function apply(change: BulkAction) {
    bulk.mutate(
      { ids, ...change },
      {
        onSuccess: ({ affected }) => {
          toast.success(
            change.action === 'restore'
              ? i18n.sprintf(
                  /* translators: %d: number of residents restored from the trash */
                  i18n._n('Restored %d resident.', 'Restored %d residents.', affected, 'quan-li-dan-cu'),
                  affected,
                )
              : i18n.sprintf(
                  /* translators: %d: number of residents changed */
                  i18n._n('Updated %d resident.', 'Updated %d residents.', affected, 'quan-li-dan-cu'),
                  affected,
                ),
          );
          onClear();
        },
      },
    );
  }

  return (
    // Sticks to the bottom of the screen, so it is in view however long the table is.
    <BulkActionBox selected={ids.length} onClose={onClear} className="sticky bottom-3 z-10 flex w-fit bg-background shadow-md">
      <span className="text-sm font-medium whitespace-nowrap">
        {i18n.sprintf(
          /* translators: %d: number of selected residents */
          i18n.__('%d selected', 'quan-li-dan-cu'),
          ids.length,
        )}
      </span>
      <Separator orientation="vertical" className="h-5!" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={bulk.isPending}>
            {i18n.__('Actions', 'quan-li-dan-cu')}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {trash ? (
            <DropdownMenuItem onSelect={() => apply({ action: 'restore' })}>{i18n.__('Restore', 'quan-li-dan-cu')}</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => apply({ action: 'set_health_exam', value: 'yes' })}>{i18n.__('Mark as examined', 'quan-li-dan-cu')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => apply({ action: 'set_health_exam', value: 'no' })}>{i18n.__('Mark as not examined', 'quan-li-dan-cu')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <ChoiceMenu label={i18n.__('Change residence status', 'quan-li-dan-cu')} options={RESIDENCE_STATUS_LABELS} onPick={(value) => apply({ action: 'set_residence_status', value: value as ResidenceStatus })} />
              <ChoiceMenu label={i18n.__('Change document verification', 'quan-li-dan-cu')} options={VERIFY_LABELS} onPick={(value) => apply({ action: 'set_verify_status', value: value as VerifyStatus })} />
              <ChoiceMenu label={i18n.__('Add a policy label', 'quan-li-dan-cu')} options={POLICY_LABELS} onPick={(value) => apply({ action: 'add_policy_tag', value })} />
              <ChoiceMenu label={i18n.__('Remove a policy label', 'quan-li-dan-cu')} options={POLICY_LABELS} onPick={(value) => apply({ action: 'remove_policy_tag', value })} />
              {caps.manage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void exportChosen().catch((e: Error) => toast.error(e.message))}>{i18n.__('Export to Excel', 'quan-li-dan-cu')}</DropdownMenuItem>
                </>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            {trash ? i18n.__('Delete permanently', 'quan-li-dan-cu') : i18n.__('Move to trash', 'quan-li-dan-cu')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </BulkActionBox>
  );
}

/** A menu item that opens the list of values to choose from. */
function ChoiceMenu({ label, options, onPick }: { label: string; options: Record<string, string>; onPick: (value: string) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {Object.entries(options).map(([value, text]) => (
          <DropdownMenuItem key={value} onSelect={() => onPick(value)}>
            {text}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
