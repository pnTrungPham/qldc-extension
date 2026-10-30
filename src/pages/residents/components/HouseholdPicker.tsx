import { useState } from 'react';

import { i18n } from '@/lib/i18n';
import { useHouseholds, type HouseholdSummary } from '@/lib/api/residents.api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/** Search the households in the data (code, a member's name or an address) and pick one. */
export default function HouseholdPicker({
  value,
  onChange,
  exclude = '',
  autoFocus,
}: {
  value: HouseholdSummary | null;
  onChange: (household: HouseholdSummary) => void;
  /** A household code to leave out (the one the person is already in). */
  exclude?: string;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState('');
  const found = useHouseholds(search, exclude).data ?? [];
  const label = i18n.__('Search by head, member, address or household code', 'quan-li-dan-cu');

  return (
    <div className="grid gap-3">
      <Input autoFocus={autoFocus} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={label} aria-label={label} />
      <ul className="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
        {found.length === 0 && <li className="px-1 py-2 text-sm text-muted-foreground">{i18n.__('No household found.', 'quan-li-dan-cu')}</li>}
        {found.map((household) => {
          const chosen = value?.code === household.code;
          return (
            <li key={household.code}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => onChange(household)}
                className={cn('grid w-full cursor-pointer gap-0.5 rounded-md border px-3 py-2 text-left text-sm', chosen ? 'border-primary bg-primary/6' : 'hover:bg-muted')}
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
    </div>
  );
}
