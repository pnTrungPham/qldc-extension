import { useState } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useHousehold, useSaveResident, type HouseholdSummary, type Relation, type Resident } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import EnumSelect from '@/components/shared/EnumSelect';

import { RELATION_LABELS } from '../labels';
import HouseholdPicker from './HouseholdPicker';

/**
 * Move a saved resident into another household: search for it, pick it, say how they relate to its head.
 * The household's code and address replace theirs; everything else about them stays.
 */
export default function MoveHouseholdDialog({
  resident,
  formHasChanges,
  onClose,
  onMoved,
}: {
  resident: Resident;
  /** The detail form has edits that are not saved; moving reloads the form without them. */
  formHasChanges: boolean;
  onClose: () => void;
  onMoved: (moved: Resident) => void;
}) {
  const [target, setTarget] = useState<HouseholdSummary | null>(null);
  const [relation, setRelation] = useState<Relation>('other');
  const save = useSaveResident();
  // Moving the head out of a household that still has other people leaves it without a head.
  const own = useHousehold(resident.household_code).data;
  const leavesNoHead = resident.is_head && (own?.total ?? 0) > 1;

  function move() {
    if (!target) return;
    save.mutate(
      // An empty address on the household must not wipe theirs.
      { id: resident.id, data: { household_code: target.code, relation, ...(target.address ? { address: target.address } : {}) } },
      {
        onSuccess: (moved) => {
          toast.success(i18n.sprintf(/* translators: %s: household code */ i18n.__('Moved to household %s.', 'quan-li-dan-cu'), target.code));
          onMoved(moved);
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{i18n.__('Move to another household', 'quan-li-dan-cu')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <HouseholdPicker autoFocus exclude={resident.household_code} value={target} onChange={setTarget} />
          {target && (
            <div className="grid gap-1.5">
              <Label>{i18n.__('Relationship to head', 'quan-li-dan-cu')}</Label>
              <EnumSelect value={relation} options={RELATION_LABELS} onChange={(v) => setRelation(v as Relation)} />
            </div>
          )}
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
          {save.isError && <p className="m-0 text-sm text-destructive">{save.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button onClick={move} disabled={!target || save.isPending}>
            {save.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Move', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
