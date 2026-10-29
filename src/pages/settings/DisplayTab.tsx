import { i18n } from '@/lib/i18n';
import { COLUMN_IDS, DEFAULT_COLUMNS, useColumns, type ColumnId } from '@/lib/columns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { COLUMN_VIEW } from '../residents/columns';

/** Which columns the residents table shows. Saved in this browser as soon as a box is ticked. */
export default function DisplayTab() {
  const [columns, setColumns] = useColumns();
  const isDefault = columns.length === DEFAULT_COLUMNS.length && columns.every((id) => DEFAULT_COLUMNS.includes(id));

  const toggle = (id: ColumnId, on: boolean) => setColumns(on ? COLUMN_IDS.filter((c) => c === id || columns.includes(c)) : columns.filter((c) => c !== id));

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="m-0 text-sm font-semibold">{i18n.__('Columns of the residents table', 'quan-li-dan-cu')}</h2>
          <p className="m-0 text-sm text-muted-foreground">{i18n.__('Tick what you want to see. The full name is always shown.', 'quan-li-dan-cu')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isDefault} onClick={() => setColumns(null)}>
          {i18n.__('Reset to default', 'quan-li-dan-cu')}
        </Button>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        <li className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Checkbox checked disabled aria-label={i18n.__('Full name', 'quan-li-dan-cu')} />
          {i18n.__('Full name', 'quan-li-dan-cu')}
        </li>
        {COLUMN_IDS.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Checkbox checked={columns.includes(id)} onCheckedChange={(checked) => toggle(id, !!checked)} />
              {COLUMN_VIEW[id].label}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
