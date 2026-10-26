import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useBulkResidents, useEmptyTrash } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Confirms removing the checked residents. `trash` moves them to the trash (reversible); `purge` and `empty`
 * delete for good, so they say so. Mounted only while open.
 */
export default function BulkDeleteDialog({
  mode,
  ids,
  count,
  onClose,
  onDone,
}: {
  mode: 'trash' | 'purge' | 'empty';
  ids: number[];
  /** How many people the action touches (the whole trash for `empty`). */
  count: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const bulk = useBulkResidents();
  const empty = useEmptyTrash();
  const pending = bulk.isPending || empty.isPending;
  const forever = mode !== 'trash';

  function confirm() {
    const done = ({ affected }: { affected: number }) => {
      toast.success(
        forever
          ? i18n.sprintf(
              /* translators: %d: number of residents deleted permanently */
              i18n._n('Permanently deleted %d resident.', 'Permanently deleted %d residents.', affected, 'quan-li-dan-cu'),
              affected,
            )
          : i18n.sprintf(
              /* translators: %d: number of residents moved to the trash */
              i18n._n('Moved %d resident to the trash.', 'Moved %d residents to the trash.', affected, 'quan-li-dan-cu'),
              affected,
            ),
      );
      onDone();
    };

    if (mode === 'empty') empty.mutate(undefined, { onSuccess: done });
    else bulk.mutate({ ids, action: mode === 'purge' ? 'purge' : 'delete' }, { onSuccess: done });
  }

  const title = forever
    ? i18n.sprintf(
        /* translators: %d: number of residents */
        i18n._n('Permanently delete %d resident?', 'Permanently delete %d residents?', count, 'quan-li-dan-cu'),
        count,
      )
    : i18n.sprintf(
        /* translators: %d: number of residents */
        i18n._n('Move %d resident to the trash?', 'Move %d residents to the trash?', count, 'quan-li-dan-cu'),
        count,
      );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {forever
              ? i18n.__('This cannot be undone. The only way back is a backup file.', 'quan-li-dan-cu')
              : i18n.__('You can restore them from the trash.', 'quan-li-dan-cu')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {forever ? i18n.__('Delete permanently', 'quan-li-dan-cu') : i18n.__('Move to trash', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
