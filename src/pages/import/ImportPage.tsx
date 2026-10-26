import { useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { downloadXlsx } from '@/lib/excel';
import type { ImportResult } from '@/lib/api/import.api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageLayout from '@/components/layout/PageLayout';
import NoAccess from '@/components/shared/NoAccess';

import ColumnMapping from './components/ColumnMapping';
import FileSource from './components/FileSource';
import PaperSource from './components/PaperSource';
import PasteSource from './components/PasteSource';
import PendingList from './components/PendingList';
import { buildPending } from './lib/pending';
import { TARGETS, TARGET_LABELS, type PendingRow, type RawTable, type RowEdits } from './lib/targets';

/** Three sources, one waiting list. Data is written only when the manager confirms. */
export default function ImportPage({ title }: { title: string }) {
  const navigate = useNavigate();
  const [tables, setTables] = useState<RawTable[]>([]);
  const [direct, setDirect] = useState<PendingRow[]>([]);
  const [edits, setEdits] = useState<RowEdits>({});
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const paperGroups = useRef(0);

  const pending = useMemo(() => buildPending(tables, direct, edits), [tables, direct, edits]);

  if (!caps.manage) return <NoAccess title={title} />;

  const reset = () => {
    setTables([]);
    setDirect([]);
    setEdits({});
  };

  return (
    <PageLayout
      title={title}
      description={i18n.__('Add people from an Excel file, a pasted message or a paper form. Review the list, then confirm.', 'quan-li-dan-cu')}
      actions={
        <Button variant="outline" onClick={() => downloadXlsx('Resident-template.xlsx', [TARGETS.map((target) => TARGET_LABELS[target])])}>
          <Download /> {i18n.__('Download Excel template', 'quan-li-dan-cu')}
        </Button>
      }
    >
      {result && (
        <div className="grid gap-2 rounded-md border border-success bg-success/6 px-4 py-3 text-sm">
          <p className="m-0 font-medium">
            {i18n.sprintf(
              /* translators: 1: people added, 2: households added, 3: people updated, 4: rows skipped */
              i18n.__('Data saved. Added %1$d people in %2$d households · Updated %3$d · Skipped %4$d', 'quan-li-dan-cu'),
              result.added_people,
              result.added_households,
              result.updated,
              result.skipped,
            )}
          </p>
          <div>
            <Button size="sm" onClick={() => navigate('/residents')}>
              {i18n.__('View residents now', 'quan-li-dan-cu')}
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">{i18n.__('Excel / CSV file', 'quan-li-dan-cu')}</TabsTrigger>
          <TabsTrigger value="paste">{i18n.__('Paste raw data', 'quan-li-dan-cu')}</TabsTrigger>
          <TabsTrigger value="paper">{i18n.__('Paper form', 'quan-li-dan-cu')}</TabsTrigger>
        </TabsList>
        <TabsContent value="file">
          <FileSource onTables={(added) => setTables([...tables, ...added])} />
        </TabsContent>
        <TabsContent value="paste">
          <PasteSource onTables={(added) => setTables([...tables, ...added])} onRows={(rows) => setDirect([...direct, ...rows])} />
        </TabsContent>
        <TabsContent value="paper">
          <PaperSource onRows={(rows) => setDirect([...direct, ...rows])} nextGroup={() => `paper:${++paperGroups.current}`} />
        </TabsContent>
      </Tabs>

      {tables.length > 0 && (
        <ColumnMapping
          tables={tables}
          onChange={(id, column, target) =>
            setTables(tables.map((t) => (t.id === id ? { ...t, mapping: t.mapping.map((m, i) => (i === column ? target : m)) } : t)))
          }
          onRemove={(id) => setTables(tables.filter((t) => t.id !== id))}
        />
      )}

      {pending.rows.length > 0 && (
        <PendingList
          rows={pending.rows}
          cccdDetected={pending.cccdDetected}
          autoUpdate={autoUpdate}
          onAutoUpdate={setAutoUpdate}
          onEdit={(key, target, value) => setEdits({ ...edits, [key]: { ...edits[key], [target]: value } })}
          onClear={reset}
          onDone={(done) => {
            setResult(done);
            reset();
          }}
        />
      )}
    </PageLayout>
  );
}
