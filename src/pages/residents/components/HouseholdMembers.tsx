import { ArrowRightLeft, Plus } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useHousehold, type Resident } from '@/lib/api/residents.api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { RELATION_LABELS } from '../labels';

/** Buttons for the Household section of a saved resident: add a member to the household, or move this person out of it. */
export function HouseholdActions({ resident, onAdd, onMove }: { resident: Resident; onAdd: () => void; onMove: () => void }) {
  if (!caps.edit) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {/* Without a household code there is no household to add to. */}
      {resident.household_code !== '' && (
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus /> {i18n.__('Add member', 'quan-li-dan-cu')}
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onMove}>
        <ArrowRightLeft /> {i18n.__('Move to another household', 'quan-li-dan-cu')}
      </Button>
    </div>
  );
}

/** Everyone living in the same household as `resident`, head first. Nothing for a household of one. */
export function HouseholdList({ resident, onOpen }: { resident: Resident; onOpen: (member: Resident) => void }) {
  const members = [...(useHousehold(resident.household_code).data?.items ?? [])].sort(
    (a, b) => Number(b.is_head) - Number(a.is_head) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999) || a.id - b.id,
  );
  if (members.length < 2) return null;

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{i18n.__('Household members', 'quan-li-dan-cu')}</div>
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
    </div>
  );
}
