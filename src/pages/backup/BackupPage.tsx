import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useCreateBackup, useInspectBackup, useRestoreBackup, type BackupSummary } from '@/lib/api/backup.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageLayout from '@/components/layout/PageLayout';
import NoAccess from '@/components/shared/NoAccess';

/** UTC "Y-m-d H:i:s" from the server → the viewer's local date and time. */
const formatDate = (utc: string) => new Date(utc.replace(' ', 'T') + 'Z').toLocaleString();

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export default function BackupPage({ title }: { title: string }) {
  const create = useCreateBackup();
  const inspect = useInspectBackup();
  const restore = useRestoreBackup();
  const input = useRef<HTMLInputElement>(null);
  const [created, setCreated] = useState<BackupSummary | null>(null);
  const [picked, setPicked] = useState<{ content: string; summary: BackupSummary } | null>(null);
  const [restored, setRestored] = useState<BackupSummary | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!caps.manage) {
    return <NoAccess title={title} message={i18n.__('Only administrator accounts can back up and restore.', 'quan-li-dan-cu')} />;
  }

  function backUp() {
    create.mutate(undefined, {
      onSuccess: ({ content, ...summary }) => {
        const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        link.download = `${i18n.__('backup', 'quan-li-dan-cu')}-${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}.kpb`;
        link.click();
        URL.revokeObjectURL(link.href);
        setCreated(summary);
      },
    });
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setRestored(null);
    const content = await toBase64(file);
    inspect.mutate(content, { onSuccess: (summary) => setPicked({ content, summary }), onError: () => setPicked(null) });
  }

  function doRestore() {
    if (!picked) return;
    restore.mutate(picked.content, {
      onSuccess: (summary) => {
        toast.success(i18n.__('Backup restored.', 'quan-li-dan-cu'));
        setRestored(summary);
        setPicked(null);
        setConfirming(false);
      },
      onError: () => setConfirming(false),
    });
  }

  return (
    <PageLayout title={title} description={i18n.__('Keep a copy of your data, or go back to an earlier copy.', 'quan-li-dan-cu')}>
      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Create a backup', 'quan-li-dan-cu')}</h2>
        <div>
          <Button onClick={backUp} disabled={create.isPending}>
            <Download /> {create.isPending ? i18n.__('Working…', 'quan-li-dan-cu') : i18n.__('Back up data', 'quan-li-dan-cu')}
          </Button>
        </div>
        {created && (
          <p className="m-0 text-sm text-success">
            {i18n.sprintf(
              /* translators: 1: number of households, 2: number of people */
              i18n.__('Backup done: %1$d households, %2$d people.', 'quan-li-dan-cu'),
              created.households,
              created.people,
            )}
          </p>
        )}
        <div className="rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">
          {i18n.__('A .kpb file only opens on the WordPress site that made it. To move to another site, use a database export tool.', 'quan-li-dan-cu')}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Restore', 'quan-li-dan-cu')}</h2>
        <div>
          <Button variant="outline" onClick={() => input.current?.click()} disabled={inspect.isPending}>
            <Upload /> {i18n.__('Choose a .kpb file', 'quan-li-dan-cu')}
          </Button>
          <input ref={input} type="file" accept=".kpb" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {inspect.isError && <p className="m-0 text-sm text-destructive">{inspect.error.message}</p>}

        {picked && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={i18n.__('Backup date', 'quan-li-dan-cu')} value={formatDate(picked.summary.date)} />
              <Stat label={i18n.__('Households', 'quan-li-dan-cu')} value={String(picked.summary.households)} />
              <Stat label={i18n.__('People', 'quan-li-dan-cu')} value={String(picked.summary.people)} />
            </div>
            <div>
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                {i18n.__('Restore this backup', 'quan-li-dan-cu')}
              </Button>
            </div>
          </>
        )}
        {restored && (
          <p className="m-0 text-sm text-success">
            {i18n.sprintf(
              /* translators: 1: backup date, 2: households, 3: people */
              i18n.__('Restored the backup from %1$s: %2$d households, %3$d people. The data that was in use before was saved first.', 'quan-li-dan-cu'),
              formatDate(restored.date),
              restored.households,
              restored.people,
            )}
          </p>
        )}
      </section>

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{i18n.__('Restore this backup?', 'quan-li-dan-cu')}</DialogTitle>
              <DialogDescription>
                {i18n.__('All current residents are replaced by the backup. A copy of the current data is saved first.', 'quan-li-dan-cu')}
              </DialogDescription>
            </DialogHeader>
            {restore.isError && <p className="m-0 text-sm text-destructive">{restore.error.message}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                {i18n.__('Cancel', 'quan-li-dan-cu')}
              </Button>
              <Button variant="destructive" onClick={doRestore} disabled={restore.isPending}>
                {restore.isPending ? i18n.__('Working…', 'quan-li-dan-cu') : i18n.__('Restore', 'quan-li-dan-cu')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
