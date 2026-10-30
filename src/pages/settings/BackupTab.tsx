import { useEffect, useRef, useState } from 'react';
import { Check, Download, Folder, FolderOpen, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useBackupStatus, useInspectBackup, useRestoreBackup, useSaveBackupOptions, useUndoRestore, type BackupFile, type BackupSummary } from '@/lib/api/backup.api';
import { backUpNow, type RunResult } from '@/lib/auto-backup';
import { chooseFolder, folderAccess, getFolder, listBackups } from '@/lib/backup-folder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { runMessage } from '@/lib/run-message';

import { SettingRow, SettingsCard, SettingsSection } from './layout';

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
  const [result, setResult] = useState<RunResult | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
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
  const { auto, last_backup_at, undo: undoInfo, overdue, days: savedDays } = status.data;

  const report = (r: RunResult) => {
    setMessage(runMessage(r));
    setResult(r);
    return r;
  };

  const say = (text: string | null) => {
    setMessage(text);
    setResult(null);
  };

  const ask = (kind: 'restore' | 'undo') => {
    restore.reset();
    undo.reset();
    setConfirming(kind);
  };

  async function change() {
    try {
      const dir = await chooseFolder();
      setFolder(dir);
      say(null);
      await refresh(dir);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e;
    }
  }

  async function allow() {
    if (folder && (await folderAccess(folder, true)) === 'granted') await backUp();
    else report('needs-access');
  }

  async function backUp() {
    setRunning(true);
    try {
      report(await backUpNow());
      await refresh();
      void status.refetch();
    } catch (e) {
      console.error(e);
      say(i18n.__('The backup could not be saved.', 'quan-li-dan-cu'));
    } finally {
      setRunning(false);
    }
  }

  function pick(read: () => Promise<string>, name: string | null = null) {
    say(null);
    read()
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => ({}) as unknown) // not JSON: the server's inspect gives the "not a backup file" message
      .then((file) => inspect.mutate(file, { onSuccess: (summary) => (setPicked({ file, summary }), setPickedName(name)), onError: () => setPicked(null) }));
  }

  function doRestore() {
    const done = () => setConfirming(null);
    const ok = (summary: BackupSummary) => {
      toast.success(i18n.__('Backup restored.', 'quan-li-dan-cu'));
      say(
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
    saveOptions.mutate({ auto, days: Number(days) }, { onSuccess: () => setDays(null), onError: () => setDays(null) });
  }

  function toggleAuto(checked: boolean) {
    setDays(null); // drop a rejected value: the field shows what the server has
    saveOptions.mutate({ auto: checked, days: savedDays });
  }

  const busy = restore.isPending || undo.isPending;
  const error = confirming === 'undo' ? undo.error : restore.error;
  const folderName = folder?.name;

  return (
    <SettingsSection
      title={i18n.__('Backup & restore', 'quan-li-dan-cu')}
      description={i18n.__('Keep copies of your data in a folder you choose, and go back to an earlier copy.', 'quan-li-dan-cu')}
    >
      <SettingsCard>
        <SettingRow title={i18n.__('Backup folder', 'quan-li-dan-cu')} description={i18n.__('Choose a folder, ideally inside iCloud Drive or Google Drive, so a copy also leaves this computer.', 'quan-li-dan-cu')}>
          {canPickFolder ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-2 pl-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                {folderName ? <strong className="truncate">{folderName}</strong> : <span className="text-muted-foreground">{i18n.__('No folder chosen', 'quan-li-dan-cu')}</span>}
              </span>
              <Button variant="outline" size="sm" onClick={() => void change()}>
                <FolderOpen /> {folder ? i18n.__('Change folder', 'quan-li-dan-cu') : i18n.__('Choose folder', 'quan-li-dan-cu')}
              </Button>
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">{i18n.__('This browser cannot save to a folder: backups are downloaded instead.', 'quan-li-dan-cu')}</p>
          )}
        </SettingRow>

        {canPickFolder && (
          <SettingRow
            title={i18n.__('Back up automatically', 'quan-li-dan-cu')}
            description={i18n.__('A copy is made when the app is open and the last one is older than this many days.', 'quan-li-dan-cu')}
          >
            <div className="flex flex-wrap items-center gap-4">
              <Switch id="auto" checked={auto} onCheckedChange={toggleAuto} disabled={saveOptions.isPending} aria-label={i18n.__('Back up automatically', 'quan-li-dan-cu')} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Label htmlFor="days" className="font-normal">
                  {i18n.__('Every', 'quan-li-dan-cu')}
                </Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={30}
                  className="w-16 bg-background"
                  disabled={!auto}
                  value={days ?? String(savedDays)}
                  onChange={(e) => setDays(e.target.value)}
                  onBlur={commitDays}
                />
                <span>{i18n.__('days', 'quan-li-dan-cu')}</span>
              </div>
            </div>
            {saveOptions.isError && <p className="m-0 text-sm text-destructive">{saveOptions.error.message}</p>}
          </SettingRow>
        )}

        <SettingRow title={i18n.__('Back up now', 'quan-li-dan-cu')} note={i18n.__('Backup files are not encrypted: keep the folder somewhere only you can open.', 'quan-li-dan-cu')}>
          {last_backup_at === null ? (
            <Badge variant="dimmed" className="justify-self-start">{i18n.__('No backup yet', 'quan-li-dan-cu')}</Badge>
          ) : (
            <Badge variant={overdue ? 'warning-soft' : 'success-soft'} className="justify-self-start">
              {i18n.sprintf(
                /* translators: %s: date and time of the last backup */
                i18n.__('Last backup: %s', 'quan-li-dan-cu'),
                formatDate(last_backup_at),
              )}
            </Badge>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void backUp()} disabled={running}>
              <Download /> {running ? i18n.__('Working…', 'quan-li-dan-cu') : i18n.__('Back up now', 'quan-li-dan-cu')}
            </Button>
            {message && <span className="text-sm">{message}</span>}
            {result === 'needs-access' && (
              <Button variant="outline" size="sm" onClick={() => void allow()}>
                {i18n.__('Allow access', 'quan-li-dan-cu')}
              </Button>
            )}
          </div>
        </SettingRow>

        <SettingRow title={i18n.__('Restore', 'quan-li-dan-cu')} description={i18n.__('Go back to an earlier copy. The current data is saved first.', 'quan-li-dan-cu')}>
          {entries.length > 0 ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {entries.map((entry) => (
                <li key={entry.name}>
                  <Entry entry={entry} selected={picked !== null && pickedName === entry.name} onPick={() => pick(() => entry.file.text(), entry.name)} />
                </li>
              ))}
            </ul>
          ) : folder ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
              <Folder className="size-4" /> {i18n.__('No backups in this folder yet.', 'quan-li-dan-cu')}
            </div>
          ) : (
            canPickFolder && <p className="m-0 text-sm text-muted-foreground">{i18n.__('Choose a backup folder above to see its copies here.', 'quan-li-dan-cu')}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={inspect.isPending}>
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
            {undoInfo && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => ask('undo')}>
                <Undo2 /> {i18n.__('Undo the last restore', 'quan-li-dan-cu')} ({formatDate(undoInfo.date)})
              </Button>
            )}
          </div>
          {inspect.isError && <p className="m-0 text-sm text-destructive">{inspect.error.message}</p>}
          {picked && (
            <div className="grid gap-3 rounded-md border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label={i18n.__('Backup date', 'quan-li-dan-cu')} value={formatDate(picked.summary.date)} />
                <Stat label={i18n.__('Households', 'quan-li-dan-cu')} value={String(picked.summary.households)} />
                <Stat label={i18n.__('People', 'quan-li-dan-cu')} value={String(picked.summary.people)} />
              </div>
              <div>
                <Button variant="destructive" onClick={() => ask('restore')}>
                  {i18n.__('Restore this backup', 'quan-li-dan-cu')}
                </Button>
              </div>
            </div>
          )}
        </SettingRow>
      </SettingsCard>

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirming === 'undo' ? i18n.__('Undo the last restore?', 'quan-li-dan-cu') : i18n.__('Restore this backup?', 'quan-li-dan-cu')}</DialogTitle>
              <DialogDescription>
                {confirming === 'undo'
                  ? i18n.__('The data from before the last restore comes back, and the current data is saved first.', 'quan-li-dan-cu')
                  : i18n.__('All current residents are replaced by the backup. A copy of the current data is saved first.', 'quan-li-dan-cu')}
              </DialogDescription>
            </DialogHeader>
            {confirming === 'undo' && undoInfo && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label={i18n.__('Backup date', 'quan-li-dan-cu')} value={formatDate(undoInfo.date)} />
                <Stat label={i18n.__('Households', 'quan-li-dan-cu')} value={String(undoInfo.households)} />
                <Stat label={i18n.__('People', 'quan-li-dan-cu')} value={String(undoInfo.people)} />
              </div>
            )}
            {error && <p className="m-0 text-sm text-destructive">{error.message}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>
                {i18n.__('Cancel', 'quan-li-dan-cu')}
              </Button>
              <Button variant="destructive" onClick={doRestore} disabled={busy}>
                {busy ? i18n.__('Working…', 'quan-li-dan-cu') : confirming === 'undo' ? i18n.__('Undo', 'quan-li-dan-cu') : i18n.__('Restore', 'quan-li-dan-cu')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SettingsSection>
  );
}

/** One file in the folder; reads it only to show its counts, and shows "Damaged file" if it does not parse. */
function Entry({ entry, selected, onPick }: { entry: Entry; selected: boolean; onPick: () => void }) {
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
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${selected ? 'border-primary bg-primary/6' : ''}`}>
      <div className="grid min-w-0 gap-0.5">
        {info === 'damaged' ? (
          <span className="text-destructive">{i18n.__('Damaged file', 'quan-li-dan-cu')}</span>
        ) : info ? (
          <>
            <strong>{formatDate(info.created_at)}</strong>
            <span className="text-muted-foreground">
              {i18n.sprintf(
                /* translators: 1: number of households, 2: number of people */
                i18n.__('%1$d households, %2$d people', 'quan-li-dan-cu'),
                info.households,
                info.people,
              )}
            </span>
          </>
        ) : (
          '…'
        )}
        <span className="truncate text-xs text-muted-foreground">{entry.name}</span>
      </div>
      <Button variant={selected ? 'primary-soft' : 'outline'} size="sm" disabled={info === 'damaged' || info === null} aria-pressed={selected} onClick={onPick}>
        {selected ? (
          <>
            <Check /> {i18n.__('Selected', 'quan-li-dan-cu')}
          </>
        ) : (
          i18n.__('Choose', 'quan-li-dan-cu')
        )}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
