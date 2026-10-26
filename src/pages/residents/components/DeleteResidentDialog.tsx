import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useDeleteResident, type Resident } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Confirms a soft delete. Mounted only while a resident is chosen. */
export default function DeleteResidentDialog({
  resident,
  onClose,
  onDeleted,
}: {
  resident: Resident;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteResident();

  function confirm() {
    remove.mutate(resident.id, {
      onSuccess: () => {
        toast.success(
          i18n.sprintf(
            /* translators: %s: resident full name */
            i18n.__('Moved %s to the trash', 'quan-li-dan-cu'),
            resident.full_name,
          ),
        );
        onDeleted();
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{i18n.__('Move this resident to the trash?', 'quan-li-dan-cu')}</DialogTitle>
          <DialogDescription asChild>
            <div className="grid gap-2 text-sm">
              <p>
                <strong className="text-foreground">{resident.full_name}</strong>
                {resident.birth_year ? ` · ${resident.birth_year}` : ''}
                {resident.address ? ` · ${resident.address}` : ''}
              </p>
              <p>
                {i18n.__('This person will be removed from the list. You can restore them from the trash.', 'quan-li-dan-cu')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>
            {i18n.__('Move to trash', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
