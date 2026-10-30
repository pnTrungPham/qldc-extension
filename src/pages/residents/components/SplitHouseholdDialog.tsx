import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useHousehold, useSplitHousehold, type Resident } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Confirms taking one person out of their household to head a new one (the code is given by the server). */
export default function SplitHouseholdDialog({
  resident,
  formHasChanges,
  onClose,
  onSplit,
}: {
  resident: Resident;
  /** The detail form has edits that are not saved; the form reloads without them. */
  formHasChanges: boolean;
  onClose: () => void;
  onSplit: (split: Resident) => void;
}) {
  const split = useSplitHousehold();
  const own = useHousehold(resident.household_code).data;
  // Taking the head out of a household that still has other people leaves it without a head.
  const leavesNoHead = resident.is_head && (own?.total ?? 0) > 1;

  function confirm() {
    split.mutate(resident.id, {
      onSuccess: (done) => {
        toast.success(i18n.sprintf(/* translators: %s: household code */ i18n.__('Moved to household %s.', 'quan-li-dan-cu'), done.household_code));
        onSplit(done);
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{i18n.__('Split into a new household', 'quan-li-dan-cu')}</DialogTitle>
          <DialogDescription>
            {i18n.sprintf(
              /* translators: 1: the person's name, 2: their current household code */
              i18n.__('%1$s leaves household %2$s and becomes the head of a new household. The others stay where they are.', 'quan-li-dan-cu'),
              resident.full_name,
              resident.household_code,
            )}
          </DialogDescription>
        </DialogHeader>
        {leavesNoHead && (
          <p className="m-0 rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">
            {i18n.sprintf(
              /* translators: %s: household code */
              i18n.__('Household %s will be left without a head of household.', 'quan-li-dan-cu'),
              resident.household_code,
            )}
          </p>
        )}
        {formHasChanges && <p className="m-0 text-sm text-muted-foreground">{i18n.__('Unsaved changes in the form will be lost.', 'quan-li-dan-cu')}</p>}
        {split.isError && <p className="m-0 text-sm text-destructive">{split.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={split.isPending}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button onClick={confirm} disabled={split.isPending}>
            {split.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Split', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
