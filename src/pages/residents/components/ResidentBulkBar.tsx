import { ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useBulkResidents, type BulkAction, type ResidenceStatus } from '@/lib/api/residents.api';
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
    <BulkActionBox selected={ids.length} onClose={onClear} className="flex w-fit">
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
            {i18n.__('Bulk Actions', 'quan-li-dan-cu')}
            <ChevronsUpDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {trash ? (
            <DropdownMenuItem onSelect={() => apply({ action: 'restore' })}>{i18n.__('Restore', 'quan-li-dan-cu')}</DropdownMenuItem>
          ) : (
            <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{i18n.__('Change residence status', 'quan-li-dan-cu')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(Object.entries(RESIDENCE_STATUS_LABELS) as Array<[ResidenceStatus, string]>).map(([value, label]) => (
                <DropdownMenuItem key={value} onSelect={() => apply({ action: 'set_residence_status', value })}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{i18n.__('Health exam 2026', 'quan-li-dan-cu')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => apply({ action: 'set_health_exam', value: 'yes' })}>
                {i18n.__('Mark as examined', 'quan-li-dan-cu')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => apply({ action: 'set_health_exam', value: 'no' })}>
                {i18n.__('Mark as not examined', 'quan-li-dan-cu')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
