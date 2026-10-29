import { i18n } from '@/lib/i18n';
import { useHousehold, type Resident } from '@/lib/api/residents.api';
import { cn } from '@/lib/utils';

import { RELATION_LABELS } from '../labels';

/** Everyone living in the same household as `resident`, head first. Hidden for a household of one. */
export default function HouseholdMembers({ resident, onOpen }: { resident: Resident; onOpen: (member: Resident) => void }) {
  const members = [...(useHousehold(resident.household_code).data?.items ?? [])].sort(
    (a, b) => Number(b.is_head) - Number(a.is_head) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999) || a.id - b.id,
  );
  if (members.length < 2) return null;

  return (
    <section className="mb-5 grid gap-2">
      <h3 className="m-0 text-sm font-semibold">{i18n.__('Household members', 'quan-li-dan-cu')}</h3>
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
    </section>
  );
}
