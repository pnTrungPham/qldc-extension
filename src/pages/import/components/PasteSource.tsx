import { useState } from 'react';

import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { SAMPLE_CHAT, isTabular, parseChat, parseTsv, toTable } from '../lib/parse';
import type { PendingRow, RawTable } from '../lib/targets';

/** Pasted chat text (one household per block) or a table copied from Excel. */
export default function PasteSource({
  onTables,
  onRows,
}: {
  onTables: (tables: RawTable[]) => void;
  onRows: (rows: PendingRow[]) => void;
}) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function read() {
    if (isTabular(text)) {
      const table = toTable(i18n.__('Pasted table', 'quan-li-dan-cu'), 'paste', parseTsv(text));
      if (table) onTables([table]);
      return setMessage(
        table
          ? { ok: true, text: i18n.sprintf(/* translators: %d: number of rows */ i18n.__('Read %d rows.', 'quan-li-dan-cu'), table.rows.length) }
          : { ok: false, text: i18n.__('No data rows found.', 'quan-li-dan-cu') },
      );
    }

    const rows = parseChat(text);
    if (rows.length) onRows(rows);
    setMessage(
      rows.length
        ? { ok: true, text: i18n.sprintf(/* translators: %d: number of people */ i18n.__('Read %d people.', 'quan-li-dan-cu'), rows.length) }
        : { ok: false, text: i18n.__('Nothing readable found. Each person needs a name and a 4-digit year of birth.', 'quan-li-dan-cu') },
    );
  }

  return (
    <div className="grid gap-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={i18n.__('Paste the message here. Leave one blank line between households.', 'quan-li-dan-cu')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setText(SAMPLE_CHAT)}>
          {i18n.__('Fill in a sample chat message', 'quan-li-dan-cu')}
        </Button>
        <Button onClick={read} disabled={!text.trim()}>
          {i18n.__('Read pasted data', 'quan-li-dan-cu')}
        </Button>
        {message && <span className={message.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{message.text}</span>}
      </div>
    </div>
  );
}
