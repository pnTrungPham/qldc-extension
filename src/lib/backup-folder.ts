import { db } from '@/backend/db';

import type { BackupFile } from './api/backup.api';

export type BackupKind = 'sao-luu' | 'truoc-khoi-phuc';
export const KEEP: Record<BackupKind, number> = { 'sao-luu': 30, 'truoc-khoi-phuc': 10 };

// The File System Access members TypeScript's DOM lib may lack.
type Mode = { mode: 'readwrite' };
type Dir = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission(d: Mode): Promise<PermissionState>;
  requestPermission(d: Mode): Promise<PermissionState>;
};
declare global {
  interface Window {
    showDirectoryPicker(o: Mode): Promise<FileSystemDirectoryHandle>;
  }
}

const PATTERN = /^(sao-luu|truoc-khoi-phuc)-(\d{4}-\d{2}-\d{2}-\d{6})(?:-(\d+))?\.qldc\.json$/;
const KEY = 'backup-folder';
const pad = (n: number) => String(n).padStart(2, '0');

export function backupName(kind: BackupKind, at: Date, taken: Set<string>): string {
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  let name = `${kind}-${stamp}.qldc.json`;
  for (let n = 2; taken.has(name); n++) name = `${kind}-${stamp}-${n}.qldc.json`;
  return name;
}

/** Parsed backup names, newest first. */
function parse(names: string[]) {
  return names
    .flatMap((name) => {
      const m = PATTERN.exec(name);
      return m ? [{ name, kind: m[1] as BackupKind, stamp: m[2], n: Number(m[3] ?? 1) }] : [];
    })
    .sort((a, b) => (a.stamp === b.stamp ? b.n - a.n : a.stamp < b.stamp ? 1 : -1));
}

export function toPrune(names: string[]): string[] {
  const all = parse(names);
  return (Object.keys(KEEP) as BackupKind[]).flatMap((k) =>
    all.filter((b) => b.kind === k).slice(KEEP[k]).map((b) => b.name),
  );
}

export async function getFolder() {
  return ((await db.meta.get(KEY))?.value as FileSystemDirectoryHandle | undefined) ?? null;
}

export async function chooseFolder() {
  const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
  await db.meta.put({ key: KEY, value: dir });
  return dir;
}

export function folderAccess(dir: FileSystemDirectoryHandle, ask = false) {
  const d = dir as Dir;
  return ask ? d.requestPermission({ mode: 'readwrite' }) : d.queryPermission({ mode: 'readwrite' });
}

async function fileHandles(dir: FileSystemDirectoryHandle) {
  const out: Array<{ name: string; getFile: () => Promise<File> }> = [];
  for await (const h of (dir as Dir).values()) if (h.kind === 'file') out.push({ name: h.name, getFile: () => (h as FileSystemFileHandle).getFile() });
  return out;
}

export async function writeBackup(dir: FileSystemDirectoryHandle, kind: BackupKind, file: BackupFile, at = new Date()) {
  const names = (await fileHandles(dir)).map((h) => h.name);
  const name = backupName(kind, at, new Set(names));
  const handle = await dir.getFileHandle(name, { create: true });
  try {
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(file));
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
  } catch (e) {
    // create:true left an empty file under the final name; never leave it to count or restore
    await dir.removeEntry(name).catch(() => {});
    throw e;
  }
  // pruning is housekeeping: the new file is already safe, so a stuck old one must not fail the backup
  for (const old of toPrune([...names, name])) await dir.removeEntry(old).catch(console.error);
  return name;
}

export async function listBackups(dir: FileSystemDirectoryHandle) {
  const handles = await fileHandles(dir);
  return Promise.all(
    parse(handles.map((h) => h.name)).map(async ({ name, kind }) => ({
      name,
      kind,
      file: await handles.find((h) => h.name === name)!.getFile(),
    })),
  );
}

export function downloadBackup(file: BackupFile) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: backupName('sao-luu', new Date(), new Set()) });
  a.click();
  URL.revokeObjectURL(url);
}
