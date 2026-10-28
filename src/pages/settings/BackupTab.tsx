import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useBackupStatus, useInspectBackup, useRestoreBackup, useSaveBackupOptions, useUndoRestore, type BackupFile, type BackupSummary } from '@/lib/api/backup.api';
import { backUpNow, type RunResult } from '@/lib/auto-backup';
import { chooseFolder, folderAccess, getFolder, listBackups } from '@/lib/backup-folder';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { runMessage } from './run-message';

/** UTC "Y-m-d H:i:s" (last backup) or ISO (file's created_at) → the viewer's local date and time. */
const formatDate = (utc: string) => new Date(utc.includes('T') ? utc : utc.replace(' ', 'T') + 'Z').toLocaleString();

const canPickFolder = typeof window.showDirectoryPicker === 'function';

type Entry = { name: string; file: File };
type Picked = { file: unknown; summary: BackupSummary };

export default function BackupTab() {
  const status = useBackupStatus();
  const saveOptions = useSaveBackupOptions();
  const inspect = useInspectBackup();
  const restore = useRestoreBackup();
  const undo = useUndoRestore();
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [days, setDays] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [confirming, setConfirming] = useState<'restore' | 'undo' | null>(null);

  async function refresh(dir = folder) {
    // Listing needs the permission, which browsers drop on restart; without it the list stays empty.
    setEntries(dir && (await folderAccess(dir)) === 'granted' ? await listBackups(dir) : []);
  }

  useEffect(() => {
    void getFolder().then((dir) => {
      setFolder(dir);
      return refresh(dir);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!status.data) return null;
  const { auto, last_backup_at, can_undo } = status.data;

  const report = (result: RunResult) => {
    setMessage(runMessage(result));
    return result;
  };

  async function change() {
    try {
      const dir = await chooseFolder();
      setFolder(dir);
      setMessage(null);
      await refresh(dir);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
    }
  }

  async function allow() {
    if (folder && (await folderAccess(folder, true)) === 'granted') await backUp();
    else setMessage(runMessage('needs-access'));
  }

  async function backUp() {
    setRunning(true);
    try {
      report(await backUpNow());
      await refresh();
      void status.refetch();
    } catch (e) {
      console.error(e);
      setMessage(i18n.__('The backup could not be saved.', 'quan-li-dan-cu'));
    } finally {
      setRunning(false);
    }
  }

  function pick(read: () => Promise<string>) {
    setMessage(null);
    read()
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => ({}) as unknown) // not JSON: the server's inspect gives the "not a backup file" message
      .then((file) => inspect.mutate(file, { onSuccess: (summary) => setPicked({ file, summary }), onError: () => setPicked(null) }));
  }

  function doRestore() {
    const done = () => setConfirming(null);
    const ok = (summary: BackupSummary) => {
      toast.success(i18n.__('Backup restored.', 'quan-li-dan-cu'));
      setMessage(
        i18n.sprintf(
          /* translators: 1: backup date, 2: households, 3: people */
          i18n.__('Restored the backup from %1$s: %2$d households, %3$d people. The data that was in use before was saved first.', 'quan-li-dan-cu'),
          formatDate(summary.date),
          summary.households,
          summary.people,
        ),
      );
      setPicked(null);
      done();
      void refresh();
    };
    if (confirming === 'undo') undo.mutate(undefined, { onSuccess: ok, onError: () => {} });
    else if (picked) restore.mutate(picked.file, { onSuccess: ok, onError: () => {} });
  }

  function commitDays() {
    if (days === null) return;
    saveOptions.mutate({ auto, days: Number(days) }, { onSuccess: () => setDays(null) });
  }

  const busy = restore.isPending || undo.isPending;
  const error = confirming === 'undo' ? undo.error : restore.error;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Backup', 'quan-li-dan-cu')}</h2>
        {canPickFolder && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {i18n.__('Folder:', 'quan-li-dan-cu')} <strong>{folder?.name ?? i18n.__('No folder chosen', 'quan-li-dan-cu')}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={() => void change()}>
              <FolderOpen /> {folder ? i18n.__('Change folder', 'quan-li-dan-cu') : i18n.__('Choose folder', 'quan-li-dan-cu')}
            </Button>
          </div>
        )}
        <p className="m-0 text-sm">
          {i18n.__('Last backup:', 'quan-li-dan-cu')} {last_backup_at ? formatDate(last_backup_at) : i18n.__('never', 'quan-li-dan-cu')}
        </p>
        {canPickFolder && (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="auto"
                checked={auto}
                onCheckedChange={(checked) => saveOptions.mutate({ auto: checked, days: status.data.days })}
                disabled={saveOptions.isPending}
              />
              <Label htmlFor="auto">{i18n.__('Back up automatically', 'quan-li-dan-cu')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="days">{i18n.__('Every (days)', 'quan-li-dan-cu')}</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={30}
                className="w-20"
                value={days ?? String(status.data.days)}
                onChange={(e) => setDays(e.target.value)}
                onBlur={commitDays}
              />
            </div>
          </div>
        )}
        {saveOptions.isError && <p className="m-0 text-sm text-destructive">{saveOptions.error.message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void backUp()} disabled={running}>
            <Download /> {running ? i18n.__('Working…', 'quan-li-dan-cu') : i18n.__('Back up now', 'quan-li-dan-cu')}
          </Button>
          {message && <span className="text-sm">{message}</span>}
          {message === runMessage('needs-access') && (
            <Button variant="outline" size="sm" onClick={() => void allow()}>
              {i18n.__('Allow access', 'quan-li-dan-cu')}
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 text-sm font-semibold">{i18n.__('Restore', 'quan-li-dan-cu')}</h2>
        {entries.length > 0 && (
          <ul className="m-0 grid list-none gap-2 p-0">
            {entries.map((entry) => (
              <li key={entry.name}>
                <Entry entry={entry} onPick={() => pick(() => entry.file.text())} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => input.current?.click()} disabled={inspect.isPending}>
            <Upload /> {i18n.__('Choose another file…', 'quan-li-dan-cu')}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pick(() => file.text());
              e.target.value = '';
            }}
          />
          {can_undo && (
            <Button variant="outline" onClick={() => setConfirming('undo')}>
              <Undo2 /> {i18n.__('Undo the last restore', 'quan-li-dan-cu')}
            </Button>
          )}
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
              <Button variant="destructive" onClick={() => setConfirming('restore')}>
                {i18n.__('Restore this backup', 'quan-li-dan-cu')}
              </Button>
            </div>
          </>
        )}
      </section>

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirming === 'undo' ? i18n.__('Undo the last restore?', 'quan-li-dan-cu') : i18n.__('Restore this backup?', 'quan-li-dan-cu')}</DialogTitle>
              <DialogDescription>
                {i18n.__('All current residents are replaced by the backup. A copy of the current data is saved first.', 'quan-li-dan-cu')}
              </DialogDescription>
            </DialogHeader>
            {error && <p className="m-0 text-sm text-destructive">{error.message}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>
                {i18n.__('Cancel', 'quan-li-dan-cu')}
              </Button>
              <Button variant="destructive" onClick={doRestore} disabled={busy}>
                {busy ? i18n.__('Working…', 'quan-li-dan-cu') : i18n.__('Restore', 'quan-li-dan-cu')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** One file in the folder; reads it only to show its counts, and shows "Damaged file" if it does not parse. */
function Entry({ entry, onPick }: { entry: Entry; onPick: () => void }) {
  const [info, setInfo] = useState<BackupFile['counts'] & { created_at: string } | 'damaged' | null>(null);
  useEffect(() => {
    entry.file
      .text()
      .then((text) => {
        const f = JSON.parse(text) as Partial<BackupFile>;
        if (f.format !== 'qldc-backup' || !f.counts || !f.created_at) throw new Error();
        setInfo({ ...f.counts, created_at: f.created_at });
      })
      .catch(() => setInfo('damaged'));
  }, [entry]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <span>
        {info === 'damaged' ? (
          <span className="text-destructive">{i18n.__('Damaged file', 'quan-li-dan-cu')}</span>
        ) : info ? (
          <>
            <strong>{formatDate(info.created_at)}</strong>
            {' · '}
            {i18n.sprintf(
              /* translators: 1: number of households, 2: number of people */
              i18n.__('%1$d households, %2$d people', 'quan-li-dan-cu'),
              info.households,
              info.people,
            )}
          </>
        ) : (
          '…'
        )}
        <span className="ml-2 text-xs text-muted-foreground">{entry.name}</span>
      </span>
      <Button variant="outline" size="sm" disabled={info === 'damaged' || info === null} onClick={onPick}>
        {i18n.__('Choose', 'quan-li-dan-cu')}
      </Button>
    </div>
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
