import { useState } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useHousehold, useHouseholds, useSaveResident, type HouseholdSummary, type Relation, type Resident } from '@/lib/api/residents.api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EnumSelect from '@/components/shared/EnumSelect';

import { RELATION_LABELS } from '../labels';

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
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<HouseholdSummary | null>(null);
  const [relation, setRelation] = useState<Relation>('other');
  const found = useHouseholds(search, resident.household_code).data ?? [];
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
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={i18n.__('Search by head, member, address or household code', 'quan-li-dan-cu')}
            aria-label={i18n.__('Search by head, member, address or household code', 'quan-li-dan-cu')}
          />
          <ul className="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
            {found.length === 0 && <li className="px-1 py-2 text-sm text-muted-foreground">{i18n.__('No household found.', 'quan-li-dan-cu')}</li>}
            {found.map((household) => {
              const chosen = target?.code === household.code;
              return (
                <li key={household.code}>
                  <button
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setTarget(household)}
                    className={cn(
                      'grid w-full cursor-pointer gap-0.5 rounded-md border px-3 py-2 text-left text-sm',
                      chosen ? 'border-primary bg-primary/6' : 'hover:bg-muted',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {household.code} · {household.head_name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {i18n.sprintf(
                          /* translators: %d: number of people in the household */
                          i18n._n('%d person', '%d people', household.size, 'quan-li-dan-cu'),
                          household.size,
                        )}
                      </span>
                    </span>
                    {household.address && <span className="truncate text-muted-foreground">{household.address}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
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
