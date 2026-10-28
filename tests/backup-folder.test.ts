import { describe, expect, it } from 'vitest';

import type { BackupFile } from '@/lib/api/backup.api';
import { backupName, listBackups, toPrune, writeBackup } from '@/lib/backup-folder';

function fakeDir(initial: string[] = [], failWrite?: Error) {
  const files = new Map<string, string>(initial.map((n) => [n, '{}']));
  const dir = {
    files,
    async *values() {
      for (const name of [...files.keys()]) yield { kind: 'file', name, getFile: async () => new File([files.get(name)!], name) };
    },
    async *entries() {
      for await (const h of dir.values()) yield [h.name, h] as const;
    },
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (opts?.create) files.set(name, '');
      return {
        kind: 'file',
        name,
        async createWritable() {
          let text = '';
          return {
            write: async (s: string) => {
              if (failWrite) throw failWrite;
              text = s;
            },
            abort: async () => {},
            close: async () => void files.set(name, text),
          };
        },
      };
    },
    async removeEntry(name: string) {
      files.delete(name);
    },
  };
  return dir as unknown as FileSystemDirectoryHandle & { files: Map<string, string> };
}

const snap = { format: 'qldc-backup', version: 1 } as unknown as BackupFile;
const at = new Date(2026, 9, 28, 9, 30, 5);
const sl = (i: number) => `sao-luu-2026-01-${String(i).padStart(2, '0')}-000000.qldc.json`;
const tk = (i: number) => `truoc-khoi-phuc-2026-01-${String(i).padStart(2, '0')}-000000.qldc.json`;

describe('backupName', () => {
  it('adds a suffix when taken', () => {
    const base = 'sao-luu-2026-10-28-093005.qldc.json';
    expect(backupName('sao-luu', at, new Set())).toBe(base);
    expect(backupName('sao-luu', at, new Set([base]))).toBe('sao-luu-2026-10-28-093005-2.qldc.json');
    expect(backupName('sao-luu', at, new Set([base, 'sao-luu-2026-10-28-093005-2.qldc.json']))).toBe(
      'sao-luu-2026-10-28-093005-3.qldc.json',
    );
  });
});

describe('toPrune', () => {
  it('drops the oldest beyond the keep count, ignoring other names', () => {
    const names = [...Array.from({ length: 32 }, (_, i) => sl(i + 1)), ...Array.from({ length: 12 }, (_, i) => tk(i + 1)), 'notes.txt'];
    expect(toPrune(names).sort()).toEqual([sl(1), sl(2), tk(1), tk(2)].sort());
  });
  it('treats -10 as newer than -2', () => {
    const p = (s: string) => `sao-luu-2026-01-01-000000${s}.qldc.json`;
    const names = [p(''), p('-2'), p('-10'), ...Array.from({ length: 28 }, (_, i) => sl(i + 2))];
    expect(toPrune(names)).toEqual([p('')]);
  });
});

describe('writeBackup', () => {
  it('never overwrites', async () => {
    const dir = fakeDir();
    await writeBackup(dir, 'sao-luu', snap, at);
    await writeBackup(dir, 'sao-luu', snap, at);
    expect(dir.files.size).toBe(2);
    for (const text of dir.files.values()) expect(JSON.parse(text)).toEqual(snap);
  });
  it('removes the empty file when the write fails', async () => {
    const boom = new Error('boom');
    const dir = fakeDir([], boom);
    await expect(writeBackup(dir, 'sao-luu', snap, at)).rejects.toBe(boom);
    expect(dir.files.size).toBe(0);
    expect(await listBackups(dir)).toEqual([]);
  });
  it('prunes', async () => {
    const dir = fakeDir(Array.from({ length: 30 }, (_, i) => sl(i + 1)));
    await writeBackup(dir, 'sao-luu', snap, at);
    expect(dir.files.size).toBe(30);
    expect(dir.files.has(sl(1))).toBe(false);
  });
});

describe('listBackups', () => {
  it('lists matching files newest first', async () => {
    const out = await listBackups(fakeDir([sl(1), 'notes.txt', tk(5), sl(3)]));
    expect(out.map((b) => [b.name, b.kind])).toEqual([
      [tk(5), 'truoc-khoi-phuc'],
      [sl(3), 'sao-luu'],
      [sl(1), 'sao-luu'],
    ]);
  });
});
