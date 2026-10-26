import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { readTable } from '@/lib/excel';
import { Button } from '@/components/ui/button';

import { toTable } from '../lib/parse';
import type { RawTable } from '../lib/targets';

/** Drop zone / picker for .xlsx, .xls and .csv files. Each file becomes one table to map. */
export default function FileSource({ onTables }: { onTables: (tables: RawTable[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [reading, setReading] = useState(false);

  async function read(files: File[]) {
    setReading(true);
    const tables: RawTable[] = [];
    for (const file of files) {
      try {
        const { rows, sheets } = await readTable(file);
        if (sheets > 1) {
          toast.warning(
            i18n.sprintf(/* translators: 1: file name, 2: number of sheets */ i18n.__('%1$s has %2$d sheets. Only the first one was read.', 'quan-li-dan-cu'), file.name, sheets),
          );
        }
        const table = toTable(file.name, 'file', rows);
        if (table) tables.push(table);
        else toast.error(i18n.sprintf(/* translators: %s: file name */ i18n.__('No data rows found in %s.', 'quan-li-dan-cu'), file.name));
      } catch {
        toast.error(i18n.sprintf(/* translators: %s: file name */ i18n.__('Could not read %s.', 'quan-li-dan-cu'), file.name));
      }
    }
    setReading(false);
    if (!tables.length) return;

    onTables(tables);
    setStatus(
      i18n.sprintf(
        /* translators: 1: number of rows, 2: number of files, 3: file names */
        i18n.__('Read %1$d rows from %2$d files: %3$s', 'quan-li-dan-cu'),
        tables.reduce((sum, t) => sum + t.rows.length, 0),
        tables.length,
        tables.map((t) => t.label).join(', '),
      ),
    );
  }

  return (
    <div className="grid gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void read([...e.dataTransfer.files]);
        }}
        className={cn(
          'grid justify-items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground',
          dragging && 'border-primary bg-primary/6',
        )}
      >
        <FileSpreadsheet className="size-8" />
        <p className="m-0">{i18n.__('Drop Excel or CSV files here, or choose them.', 'quan-li-dan-cu')}</p>
        <Button variant="outline" onClick={() => input.current?.click()} disabled={reading}>
          {reading ? i18n.__('Reading…', 'quan-li-dan-cu') : i18n.__('Choose files', 'quan-li-dan-cu')}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            void read([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      {status && <p className="m-0 text-sm text-success">{status}</p>}
    </div>
  );
}
