import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilterSelect from '@/components/shared/FilterSelect';

import { RESIDENCE_STATUS_LABELS } from './ResidenceStatusBadge';

export type Filters = { search: string; status: string; exam: string; phone: string };
export const NO_FILTERS: Filters = { search: '', status: '', exam: '', phone: '' };

/** Search box (debounced) + status / health exam / phone selects. Empty string = no filter. */
export default function ResidentFilters({ value, onChange }: { value: Filters; onChange: (value: Filters) => void }) {
  const [search, setSearch] = useState(value.search);

  useEffect(() => setSearch(value.search), [value.search]);
  useEffect(() => {
    if (search === value.search) return;
    const timer = setTimeout(() => onChange({ ...value, search }), 300);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  const active = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.__('Search name, address, phone…', 'quan-li-dan-cu')}
          className="pl-9"
        />
      </div>
      <FilterSelect
        label={i18n.__('Residence', 'quan-li-dan-cu')}
        value={value.status}
        options={RESIDENCE_STATUS_LABELS}
        onChange={(status) => onChange({ ...value, status })}
      />
      <FilterSelect
        label={i18n.__('Health exam 2026', 'quan-li-dan-cu')}
        value={value.exam}
        options={{ yes: i18n.__('Examined', 'quan-li-dan-cu'), no: i18n.__('Not examined', 'quan-li-dan-cu') }}
        onChange={(exam) => onChange({ ...value, exam })}
      />
      <FilterSelect
        label={i18n.__('Phone', 'quan-li-dan-cu')}
        value={value.phone}
        options={{ yes: i18n.__('Has number', 'quan-li-dan-cu'), no: i18n.__('Missing number', 'quan-li-dan-cu') }}
        onChange={(phone) => onChange({ ...value, phone })}
      />
      {active && (
        <Button variant="ghost" onClick={() => onChange(NO_FILTERS)}>
          {i18n.__('Clear filters', 'quan-li-dan-cu')} <X />
        </Button>
      )}
    </div>
  );
}
