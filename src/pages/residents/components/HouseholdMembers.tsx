import { Plus } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useHousehold, type Resident } from '@/lib/api/residents.api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { RELATION_LABELS } from '../labels';

/**
 * Everyone living in the same household as `resident`, head first, and a button to add one more.
 * Hidden when there is nobody to list and nothing to add (a household of one that cannot be edited).
 */
export default function HouseholdMembers({
  resident,
  onOpen,
  onAdd,
}: {
  resident: Resident;
  onOpen: (member: Resident) => void;
  onAdd: () => void;
}) {
  const members = [...(useHousehold(resident.household_code).data?.items ?? [])].sort(
    (a, b) => Number(b.is_head) - Number(a.is_head) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999) || a.id - b.id,
  );
  // Without a household code there is no household to add to.
  const canAdd = caps.edit && resident.household_code !== '';
  if (members.length < 2 && !canAdd) return null;

  return (
    <section className="mb-5 grid gap-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold">{i18n.__('Household members', 'quan-li-dan-cu')}</h3>
        {canAdd && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus /> {i18n.__('Add member', 'quan-li-dan-cu')}
          </Button>
        )}
      </div>
      {members.length >= 2 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {members.map((member) => {
            const current = member.id === resident.id;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  disabled={current}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onOpen(member)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm',
                    current ? 'border-primary bg-primary/6' : 'cursor-pointer hover:bg-muted',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{member.full_name}</span>
                  <span className="text-muted-foreground">{RELATION_LABELS[member.relation]}</span>
                  <span className="w-10 text-right text-muted-foreground">{member.birth_year ?? ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
