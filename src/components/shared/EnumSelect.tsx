import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Dropdown over a value → label map, for form fields. `allowEmpty` adds a "—" option that maps to ''. */
export default function EnumSelect({
  value,
  options,
  onChange,
  disabled,
  allowEmpty,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  // Radix Select rejects an empty-string item value, so '' travels as a sentinel.
  const NONE = '__none';
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
      <SelectTrigger className="w-full">
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
