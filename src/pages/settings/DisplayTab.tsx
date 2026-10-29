import { i18n } from '@/lib/i18n';
import { COLUMN_IDS, DEFAULT_COLUMNS, useColumns, type ColumnId } from '@/lib/columns';
import { DEFAULT_DETAIL_FIELDS, DETAIL_FIELD_IDS, useDetailFields, type DetailFieldId } from '@/lib/detail-fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { COLUMN_VIEW } from '../residents/columns';

/** What the residents table and the resident drawer show. Each box is saved in this browser as soon as it is ticked. */
export default function DisplayTab() {
  const [columns, setColumns] = useColumns();
  const [fields, setFields] = useDetailFields();

  return (
    <div className="grid gap-6">
      <Choice
        title={i18n.__('Columns of the residents table', 'quan-li-dan-cu')}
        description={i18n.__('Tick what you want to see. The full name is always shown.', 'quan-li-dan-cu')}
        ids={COLUMN_IDS}
        labels={Object.fromEntries(COLUMN_IDS.map((id) => [id, COLUMN_VIEW[id].label])) as Record<ColumnId, string>}
        value={columns}
        defaults={DEFAULT_COLUMNS}
        onChange={setColumns}
      />
      <Choice
        title={i18n.__('Fields of the resident detail', 'quan-li-dan-cu')}
        description={i18n.__('A field you untick is only hidden: its value stays as it is.', 'quan-li-dan-cu')}
        note={i18n.__('Always shown: full name, year of birth, household code, relationship, address and household members.', 'quan-li-dan-cu')}
        ids={DETAIL_FIELD_IDS}
        labels={DETAIL_LABELS}
        value={fields}
        defaults={DEFAULT_DETAIL_FIELDS}
        onChange={setFields}
      />
    </div>
  );
}

const DETAIL_LABELS: Record<DetailFieldId, string> = {
  gender: i18n.__('Gender', 'quan-li-dan-cu'),
  phone: i18n.__('Phone', 'quan-li-dan-cu'),
  occupation: i18n.__('Occupation', 'quan-li-dan-cu'),
  residence_status: i18n.__('Residence status', 'quan-li-dan-cu'),
  verify_status: i18n.__('Document verification', 'quan-li-dan-cu'),
  policy_tags: i18n.__('Policy labels', 'quan-li-dan-cu'),
  support_flags: i18n.__('Field support flags', 'quan-li-dan-cu'),
  bhyt_number: i18n.__('Health insurance (BHYT) number', 'quan-li-dan-cu'),
  health_exam: i18n.__('Health exam 2026 done', 'quan-li-dan-cu'),
  exam_date: i18n.__('Examination date', 'quan-li-dan-cu'),
  exam_place: i18n.__('Examination place', 'quan-li-dan-cu'),
  note: i18n.__('Situation notes', 'quan-li-dan-cu'),
};

/** A card of tick boxes over `ids`, with a reset to `defaults`. `onChange(null)` means "back to the defaults". */
function Choice<T extends string>({
  title,
  description,
  note,
  ids,
  labels,
  value,
  defaults,
  onChange,
}: {
  title: string;
  description: string;
  note?: string;
  ids: readonly T[];
  labels: Record<T, string>;
  value: T[];
  defaults: readonly T[];
  onChange: (ids: T[] | null) => void;
}) {
  const isDefault = value.length === defaults.length && value.every((id) => defaults.includes(id));
  const toggle = (id: T, on: boolean) => onChange(ids.filter((other) => (other === id ? on : value.includes(other))));

  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="m-0 text-sm font-semibold">{title}</h2>
          <p className="m-0 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isDefault} onClick={() => onChange(null)}>
          {i18n.__('Reset to default', 'quan-li-dan-cu')}
        </Button>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {ids.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Checkbox checked={value.includes(id)} onCheckedChange={(checked) => toggle(id, !!checked)} />
              {labels[id]}
            </label>
          </li>
        ))}
      </ul>
      {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
