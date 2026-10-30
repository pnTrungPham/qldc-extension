import { useEffect, useState } from 'react';
import { ListFilter, Search, X } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { POLICY_LABELS, SUPPORT_LABELS, VERIFY_LABELS } from '../labels';
import { RESIDENCE_STATUS_LABELS } from './ResidenceStatusBadge';

export type Filters = { search: string; status: string; exam: string; phone: string; head: string; verify: string; policy: string; support: string };
export const NO_FILTERS: Filters = { search: '', status: '', exam: '', phone: '', head: '', verify: '', policy: '', support: '' };

type Group = { key: Exclude<keyof Filters, 'search'>; label: string; options: Record<string, string> };

const yesNo = (yes: string, no: string) => ({ yes, no });

/** The filters, in the order the panel shows them. One value per group; empty string = no filter. */
export const FILTER_GROUPS: Group[] = [
  { key: 'status', label: i18n.__('Residence', 'quan-li-dan-cu'), options: RESIDENCE_STATUS_LABELS },
  { key: 'head', label: i18n.__('Head of household', 'quan-li-dan-cu'), options: yesNo(i18n.__('Heads only', 'quan-li-dan-cu'), i18n.__('Not heads', 'quan-li-dan-cu')) },
  { key: 'exam', label: i18n.__('Health exam 2026', 'quan-li-dan-cu'), options: yesNo(i18n.__('Examined', 'quan-li-dan-cu'), i18n.__('Not examined', 'quan-li-dan-cu')) },
  { key: 'phone', label: i18n.__('Phone', 'quan-li-dan-cu'), options: yesNo(i18n.__('Has number', 'quan-li-dan-cu'), i18n.__('Missing number', 'quan-li-dan-cu')) },
  { key: 'verify', label: i18n.__('Document verification', 'quan-li-dan-cu'), options: VERIFY_LABELS },
  { key: 'policy', label: i18n.__('Policy labels', 'quan-li-dan-cu'), options: POLICY_LABELS },
  { key: 'support', label: i18n.__('Field support flags', 'quan-li-dan-cu'), options: SUPPORT_LABELS },
];

/** Search box (debounced), a Filters button with a panel of choices, and a chip for each filter in use. */
export default function ResidentFilters({ value, onChange }: { value: Filters; onChange: (value: Filters) => void }) {
  const [search, setSearch] = useState(value.search);

  useEffect(() => setSearch(value.search), [value.search]);
  useEffect(() => {
    if (search === value.search) return;
    const timer = setTimeout(() => onChange({ ...value, search }), 300);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  const chosen = FILTER_GROUPS.filter(({ key }) => value[key]);
  const set = (key: Group['key'], option: string) => onChange({ ...value, [key]: value[key] === option ? '' : option });
  const searchLabel = i18n.__('Search name, address, phone…', 'quan-li-dan-cu');

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchLabel} aria-label={searchLabel} className="px-9" />
          {search && (
            <button
              type="button"
              aria-label={i18n.__('Clear search', 'quan-li-dan-cu')}
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded border-0 bg-transparent text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[1.5px] focus-visible:ring-primary"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={chosen.length ? 'primary-soft' : 'outline'}>
              <ListFilter /> {i18n.__('Filters', 'quan-li-dan-cu')}
              {chosen.length > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{chosen.length}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="grid max-h-[70vh] w-[min(26rem,90vw)] gap-4 overflow-y-auto">
            {FILTER_GROUPS.map(({ key, label, options }) => (
              <div key={key} className="grid gap-1.5">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(options).map(([option, text]) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={value[key] === option}
                      onClick={() => set(key, option)}
                      className={cn(
                        'cursor-pointer rounded-full border border-solid px-3 py-1 text-sm outline-none focus-visible:ring-[1.5px] focus-visible:ring-primary',
                        value[key] === option ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border bg-background text-foreground hover:border-primary hover:text-primary',
                      )}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chosen.map(({ key, label, options }) => (
            <span key={key} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-3 text-sm text-primary">
              {label}: {options[value[key]]}
              <button
                type="button"
                aria-label={i18n.sprintf(/* translators: %s: name of the filter */ i18n.__('Remove filter: %s', 'quan-li-dan-cu'), label)}
                onClick={() => onChange({ ...value, [key]: '' })}
                className="grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-primary outline-none hover:bg-primary/15 focus-visible:ring-[1.5px] focus-visible:ring-primary"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...NO_FILTERS, search: value.search })}>
            {i18n.__('Clear filters', 'quan-li-dan-cu')}
          </Button>
        </div>
      )}
    </div>
  );
}
