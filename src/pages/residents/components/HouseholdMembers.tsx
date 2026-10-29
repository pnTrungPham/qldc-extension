import { ArrowRightLeft, ChevronDown, ChevronRight, Plus, Split } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useHousehold, type Resident } from '@/lib/api/residents.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { RELATION_LABELS } from '../labels';

/** One menu for what can be done with a saved resident's household: add a member, move them elsewhere, or split them off. */
export function HouseholdActions({ resident, onAdd, onMove, onSplit }: { resident: Resident; onAdd: () => void; onMove: () => void; onSplit: () => void }) {
  const size = useHousehold(resident.household_code).data?.total ?? 0;
  if (!caps.edit) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {i18n.__('Manage household', 'quan-li-dan-cu')} <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Without a household code there is no household to add to or to leave. */}
        {resident.household_code !== '' && (
          <DropdownMenuItem onSelect={onAdd}>
            <Plus /> {i18n.__('Add member', 'quan-li-dan-cu')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onMove}>
          <ArrowRightLeft /> {i18n.__('Move to another household', 'quan-li-dan-cu')}
        </DropdownMenuItem>
        {size >= 2 && (
          <DropdownMenuItem onSelect={onSplit}>
            <Split /> {i18n.__('Split into a new household', 'quan-li-dan-cu')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Everyone living in the same household as `resident`, head first. Nothing for a household of one. */
export function HouseholdList({ resident, originId, onOpen }: { resident: Resident; originId?: number; onOpen: (member: Resident) => void }) {
  const members = [...(useHousehold(resident.household_code).data?.items ?? [])].sort(
    (a, b) => Number(b.is_head) - Number(a.is_head) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999) || a.id - b.id,
  );
  if (members.length < 2) return null;

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{i18n.__('Household members', 'quan-li-dan-cu')}</div>
      <ul className="m-0 grid list-none gap-1 p-0">
        {members.map((member) => {
          const row = (
            <>
              <span className="min-w-0 flex-1 truncate font-medium">{member.full_name}</span>
              <span className="text-muted-foreground">{RELATION_LABELS[member.relation]}</span>
              <span className="w-10 text-right text-muted-foreground">{member.birth_year ?? ''}</span>
            </>
          );
          // The row being viewed is a label, not a control: tinted, tagged "Viewing". The others are white buttons with an arrow.
          return (
            <li key={member.id}>
              {member.id === resident.id ? (
                <div aria-current="true" className="flex items-center gap-3 rounded-md border border-primary bg-primary/6 px-3 py-2 text-sm">
                  {row}
                  <span className="flex w-36 justify-end">
                    <Badge variant="primary-soft">{i18n.__('Viewing', 'quan-li-dan-cu')}</Badge>
                  </span>
                </div>
              ) : (
                // No CSS reset in this app: without bg-background a button is the browser's grey.
                <button
                  type="button"
                  onClick={() => onOpen(member)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-muted"
                >
                  {row}
                  <span className="flex w-36 items-center justify-end gap-2 text-muted-foreground">
                    {member.id === originId && <Badge variant="dimmed">{i18n.__('Opened from the list', 'quan-li-dan-cu')}</Badge>}
                    <ChevronRight className="size-4 shrink-0" />
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
