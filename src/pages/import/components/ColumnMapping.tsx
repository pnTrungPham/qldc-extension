import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { TARGETS, TARGET_LABELS, type RawTable, type Target } from '../lib/targets';

const SKIP = '__skip';

/** One mapping row per spreadsheet column: pick which field it feeds. Guesses are pre-filled. */
export default function ColumnMapping({
  tables,
  onChange,
  onRemove,
}: {
  tables: RawTable[];
  onChange: (id: string, column: number, target: Target | '') => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <h3 className="m-0 text-sm font-semibold">{i18n.__('Column mapping (fix it if a guess is wrong)', 'quan-li-dan-cu')}</h3>
      {tables.map((table) => (
        <div key={table.id} className="grid gap-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {table.label} · {i18n.sprintf(/* translators: %d: number of rows */ i18n._n('%d row', '%d rows', table.rows.length, 'quan-li-dan-cu'), table.rows.length)}
            </span>
            <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => onRemove(table.id)}>
              {i18n.__('Remove', 'quan-li-dan-cu')}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {table.headers.map((header, column) => (
              <div key={column} className="grid gap-1">
                <span className="truncate text-xs text-muted-foreground">{header || i18n.sprintf(/* translators: %d: column number */ i18n.__('Column %d', 'quan-li-dan-cu'), column + 1)}</span>
                <Select value={table.mapping[column] || SKIP} onValueChange={(v) => onChange(table.id, column, v === SKIP ? '' : (v as Target))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP}>{i18n.__('— Skip —', 'quan-li-dan-cu')}</SelectItem>
                    {TARGETS.map((target) => (
                      <SelectItem key={target} value={target}>
                        {TARGET_LABELS[target]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
