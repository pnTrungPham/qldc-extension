import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Dropdown over a value → label map, for form fields. `allowEmpty` adds a "—" option that maps to ''. */
export default function EnumSelect({
  value,
  options,
  onChange,
  disabled,
  allowEmpty,
  className,
  label,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  /** Extra classes for the trigger. */
  className?: string;
  /** Accessible name when no <label> points at the select. */
  label?: string;
}) {
  // Radix Select rejects an empty-string item value, so '' travels as a sentinel.
  const NONE = '__none';
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>—</SelectItem>}
        {Object.entries(options)
          .filter(([key]) => key !== '')
          .map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
