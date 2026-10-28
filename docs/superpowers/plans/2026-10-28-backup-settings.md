# QLDC Extension — Plan 2: Settings page and folder backups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings page (tabs General and Backup & restore) where the user picks a folder once; the app writes plain JSON backups there every N days, after imports and on demand, and restores from them with an undo.

**Architecture:** Backup content (snapshot, validate, restore, undo, options, due rules) lives in `src/backend/backup.ts` behind `router.ts`, like every other feature, and is tested over fake-indexeddb. Folder work (File System Access handles, permission, file names, retention) runs in the page, in `src/lib/backup-folder.ts`. `src/lib/auto-backup.ts` ties them together: one lock, the schedule, the toasts. The UI is a new `/settings` page; `WardDialog` and the WordPress `BackupPage` go.

**Tech Stack:** as Plan 1 (WXT, React 19, TanStack Query 5, Dexie 4, `@wordpress/i18n`, Vitest + fake-indexeddb), plus the browser's File System Access API and Web Locks. No new dependencies (`@radix-ui/react-tabs` and the `Switch`/`Tabs` UI are already in the repo).

**Spec:** `docs/superpowers/specs/2026-10-28-backup-settings-design.md` — read it with this plan; behaviour not repeated here comes from it.

## Global Constraints

- No passphrase, no encryption (user's decision). File is JSON.
- File names: `sao-luu-YYYY-MM-DD-HHmmss.qldc.json` and `truoc-khoi-phuc-YYYY-MM-DD-HHmmss.qldc.json`, local time; on a clash add `-2`, `-3`… before `.qldc.json`. Prefixes are not translated. Never overwrite, never touch other files.
- Keep 30 newest `sao-luu-*` and 10 newest `truoc-khoi-phuc-*`, counted separately.
- Every N days, N a whole number 1–30, default 1; automatic backup default on.
- File content `{ format: 'qldc-backup', version: 1, created_at, counts: { households, people }, residents, audit, settings }`. `residents` includes the trash and `id_last4`; no `full_name_search`; `settings` is ward settings only.
- Restore replaces `residents`, `audit` and ward settings, and stores the previous data as `db.meta` key `before-restore`, all in **one** `transaction()`.
- Inside `transaction()`, await only Dexie calls (`db.ts`). File writes happen outside it.
- Overdue: on and older than 2 × N days, off and older than 7 days, or never while residents exist. Toast at most once a day.
- UI text English through `i18n.__('…', 'quan-li-dan-cu')` (object call, literal domain), Vietnamese in `locales/quan-li-dan-cu-vi.po`.
- Timestamps stored as `now()` from `db.ts` (UTC `YYYY-MM-DD HH:MM:SS`).

## Review Focus

1. **The browser forgot the folder permission after a restart.** Expected: no backup is written, no prompt on load, a toast with a button asks to continue; nothing silently stops. Test in Task 4.
2. **The folder was deleted or renamed.** Expected: the run reports `missing`, the user is told to choose a folder again. Test in Task 4.
3. **A hand-edited, truncated or foreign JSON file is restored.** Expected: rejected with a message, data unchanged. Tests in Task 1.
4. **The days field gets `0`, `31`, `1.5` or text.** Expected: `invalid_arguments`, options unchanged. Test in Task 2.
5. **Two app tabs are open when a backup is due.** Expected: one file, not two (`navigator.locks`). Test in Task 4 (the runner takes the lock), checked by hand in Task 5.

---

## File Structure

```
src/backend/backup.ts          # NEW: snapshot, inspect, restore, undo, options, isDue/isOverdue
src/backend/router.ts          # EDIT: /backup* and /restore/* routes
src/lib/api/backup.api.ts      # REWRITE: types + hooks for the new routes
src/lib/backup-folder.ts       # NEW: folder handle, permission, backupName, toPrune, write, list, download
src/lib/auto-backup.ts         # NEW: backUpNow, runDueBackup, startAutoBackup, restoreBackup
src/lib/api/import.api.ts      # EDIT: back up after a commit
entrypoints/app/main.tsx       # EDIT: drop StorageWarning, start auto backup
src/pages/settings/SettingsPage.tsx   # NEW: tabs, ?tab= in the URL
src/pages/settings/GeneralTab.tsx     # NEW: the WardDialog form, inline
src/pages/settings/BackupTab.tsx      # NEW: folder, options, back up now, restore list, undo
src/tabs.tsx, src/components/layout/Header.tsx   # EDIT: /settings route, gear links to it
DELETE: src/components/layout/WardDialog.tsx, src/pages/backup/BackupPage.tsx
tests/backup.test.ts, tests/backup-folder.test.ts, tests/auto-backup.test.ts
```

---

### Task 1: Backup content — snapshot, inspect, restore, undo

**Files:**
- Create: `src/backend/backup.ts`, `tests/backup.test.ts`
- Modify: `src/backend/router.ts`, `src/lib/api/backup.api.ts`

**Interfaces:**
- Consumes: `db`, `now`, `transaction` (`db.ts`); `sanitize`, `isInvalid` (`resident.ts`); `fold` (`@/lib/fold`); `getSettings` (`settings.ts`).
- Produces, in `src/lib/api/backup.api.ts` (types only in this task; Task 2 and 5 add hooks):
  - `type BackupFile = { format: 'qldc-backup'; version: 1; created_at: string; counts: { households: number; people: number }; residents: Resident[]; audit: AuditRow[]; settings: Settings }`
  - `type BackupSummary = { date: string; households: number; people: number }` (`date` = `created_at`).
- Produces, in `src/backend/backup.ts`:
  - `snapshot(): Promise<BackupFile>` — one Dexie read transaction; `counts` from residents with `deleted_at === null`, households = distinct non-empty `household_code` (as `residents.stats()`).
  - `inspect(input: unknown): BackupSummary | Invalid`
  - `restore(input: unknown): Promise<BackupSummary>` — throws `ApiError` `invalid_arguments` on a bad file.
  - `undoRestore(): Promise<BackupSummary>` — restores `before-restore`; `not_found` when there is none.
- Routes: `POST /backup` → `snapshot()`; `POST /restore/inspect { file }`; `POST /restore/commit { file }`; `POST /restore/undo`.

Validation (`inspect` and `restore` share it): object with `format === 'qldc-backup'` and `version === 1`; `residents` an array whose items each pass `sanitize()` and have a positive integer `id` (unique), string `created_at`/`updated_at`, and `deleted_at` string or null; `audit` an array of `{ action: string, resident_id: integer, changed_fields: string[], created_at: string }`; `settings` an object with string `ward_code`/`ward_name`. The first failure's message is returned as `{ error }` (translatable: `'This is not a backup file, or it is damaged.'` for shape errors; the `sanitize` message for a resident).

Restore writes each resident as `{ ...sanitized, id, created_at, updated_at, created_by: 0, updated_by: 0, deleted_at, full_name_search: fold(full_name) }` (ids kept, so audit rows still point at them); audit rows keep their `id`; settings go in with `db.meta.put({ key: 'settings', value })` (not `saveSettings`: its ward-name rule would reject a backup made before the ward was named; `getSettings()` normalizes on read).

- [ ] **Step 1: Failing tests in `tests/backup.test.ts`** (setup as `tests/router.test.ts`: clear the three tables, create two residents through `route`, trash one):
  - `round trip`: `snapshot()`, then add a third resident, then `restore(file)` → `db.residents.count()` is 2, the trashed one is still trashed, `id_last4` and ids equal the originals, `GET /residents?search=nguyen` still finds "Nguyễn Văn An" (search key rebuilt).
  - `snapshot has the agreed shape`: `format: 'qldc-backup'`, `version: 1`, `counts: { people: 1, households: … }` (trash excluded), no `full_name_search` on any resident.
  - `foreign file changes nothing`: each of `{}`, `{ format: 'x', version: 1 }`, `{ ...file, version: 2 }`, `{ ...file, residents: [{ full_name: 'X' }] }` → `restore` rejects with `invalid_arguments`, resident count unchanged; `inspect` returns `{ error }`.
  - `failure halfway changes nothing`: `vi.spyOn(db.audit, 'bulkAdd').mockRejectedValueOnce(new Error('disk'))` → `restore(file)` rejects, the third resident is still there, no `before-restore` in `db.meta`.
  - `restore keeps the previous data for undo`: after `restore(file)`, `undoRestore()` brings back 3 residents; a second `undoRestore()` goes back to 2.
  - `undo without a restore`: rejects with `not_found`.
  - `inspect` returns `{ date: file.created_at, households, people }`.
- [ ] **Step 2: Run** `pnpm vitest run tests/backup.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `src/backend/backup.ts` (write residents and audit with `bulkAdd` after `clear()`), the four routes in `router.ts`, and the two types in `backup.api.ts` (remove its `.kpb`/base64 hooks; Task 5 replaces the page that used them, so the build may break until then — keep `pnpm check` for Task 5).
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: backup snapshot and restore with undo`.

### Task 2: Backup options and when a backup is due

**Files:**
- Modify: `src/backend/backup.ts`, `src/backend/router.ts`, `src/lib/api/backup.api.ts`
- Test: `tests/backup.test.ts`

**Interfaces:**
- Produces, in `backup.api.ts`:
  - `type BackupOptions = { auto: boolean; days: number }`
  - `type BackupStatus = BackupOptions & { last_backup_at: string | null; due: boolean; overdue: boolean; warned_today: boolean; can_undo: boolean }`
  - hooks `useBackupStatus()` (query key `['backup-status']`), `useSaveBackupOptions()` (sets that query's data on success).
- Produces, in `backup.ts`:
  - `isDue(options: BackupOptions, last: string | null, at: Date): boolean` — `auto` and (`last` null or age ≥ `days` × 24 h).
  - `isOverdue(options: BackupOptions, last: string | null, hasResidents: boolean, at: Date): boolean` — the Global Constraints rule.
  - `getBackupStatus(at?: Date): Promise<BackupStatus>`; `saveBackupOptions(input: unknown): Promise<BackupOptions | Invalid>`; `markBackedUp(): Promise<void>`; `markWarned(): Promise<void>`.
- `db.meta` keys: `backup-options` (`BackupOptions`, default `{ auto: true, days: 1 }`), `backup-last` (`now()` string), `backup-warned` (local `YYYY-MM-DD`).
- Routes: `GET /backup/status`; `POST /backup/options { auto, days }`; `POST /backup/done`; `POST /backup/warned`. `/backup/*` routes go before `POST /backup` only if patterns overlap (they don't with `^…$`).

- [ ] **Step 1: Failing tests** (add to `tests/backup.test.ts`; `at` fixed with `new Date('2026-10-28T12:00:00Z')`, `last` as `now()`-format strings):
  - `isDue`: `{auto:true,days:1}` with `last` null → true; 23 h ago → false; 24 h ago → true; `auto:false` and null → false.
  - `isOverdue`: `{auto:true,days:3}` 6 days ago → false, 6 days + 1 min → true; `{auto:false,days:3}` 7 days + 1 min → true, 6 days → false; never backed up with residents → true, without → false.
  - `days validation`: `POST /backup/options` with `days` `0`, `31`, `1.5`, `'2'` each rejects `invalid_arguments`; `{ auto: false, days: 30 }` saves and `GET /backup/status` shows it.
  - `done and warned`: after `POST /backup/done`, status has `last_backup_at` set and `due` false; after `POST /backup/warned`, `warned_today` true; after a restore, `can_undo` true.
- [ ] **Step 2: Run** `pnpm vitest run tests/backup.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions, routes and hooks. Translatable error: `'Enter a whole number of days from 1 to 30.'`.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: backup options and due rules`.

### Task 3: The backup folder

**Files:**
- Create: `src/lib/backup-folder.ts`, `tests/backup-folder.test.ts`

**Interfaces:**
- Consumes: `BackupFile` (Task 1), `db.meta`.
- Produces:
  - `type BackupKind = 'sao-luu' | 'truoc-khoi-phuc'`; `KEEP: Record<BackupKind, number> = { 'sao-luu': 30, 'truoc-khoi-phuc': 10 }`
  - `backupName(kind: BackupKind, at: Date, taken: Set<string>): string`
  - `toPrune(names: string[]): string[]` — names to delete; ignores names that don't match either pattern.
  - `getFolder(): Promise<FileSystemDirectoryHandle | null>` / `chooseFolder(): Promise<FileSystemDirectoryHandle>` (`showDirectoryPicker({ mode: 'readwrite' })`, stored as `db.meta` key `backup-folder`).
  - `folderAccess(dir, ask = false): Promise<PermissionState>` — `queryPermission`, or `requestPermission` when `ask`.
  - `writeBackup(dir, kind: BackupKind, file: BackupFile, at = new Date()): Promise<string>` — name from `backupName` over the folder's current names, `getFileHandle(name, { create: true })` → `createWritable()` → `write(JSON.stringify(file))` → `close()`, then `removeEntry` each of `toPrune`; returns the name. A `NotFoundError` from the folder propagates.
  - `listBackups(dir): Promise<Array<{ name: string; kind: BackupKind; file: File }>>` — matching names only, newest first.
  - `downloadBackup(file: BackupFile): void` — `<a download>` with `backupName('sao-luu', new Date(), new Set())`.

Pattern: `^(sao-luu|truoc-khoi-phuc)-\d{4}-\d{2}-\d{2}-\d{6}(-\d+)?\.qldc\.json$`. Newest first = sort by the timestamp part, then by suffix number, descending (plain string sort puts `-10` before `-2`).

- [ ] **Step 1: Failing tests in `tests/backup-folder.test.ts`** (a small in-memory fake `FileSystemDirectoryHandle` in the test file: `values()`/`entries()`, `getFileHandle`, `removeEntry`, writables that store the string on `close()`):
  - `backupName`: `('sao-luu', new Date(2026, 9, 28, 9, 30, 5), new Set())` → `'sao-luu-2026-10-28-093005.qldc.json'`; with that name taken → `…-093005-2.qldc.json`; with both taken → `-3`.
  - `toPrune`: 32 `sao-luu` names + 12 `truoc-khoi-phuc` names + `notes.txt` → returns the 2 oldest `sao-luu` and 2 oldest `truoc-khoi-phuc`, never `notes.txt`; a set with `-2` and `-10` suffixes in one second keeps `-10` as newer.
  - `writeBackup never overwrites`: two writes with the same `at` → two files, contents both parse to the snapshot.
  - `writeBackup prunes`: folder pre-filled with 30 `sao-luu` files → after one write, 30 remain and the oldest is gone.
  - `listBackups`: returns matching files only, newest first, with `kind`.
- [ ] **Step 2: Run** `pnpm vitest run tests/backup-folder.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/lib/backup-folder.ts`. TypeScript's DOM lib may lack `queryPermission`/`requestPermission`/`showDirectoryPicker`; declare the missing members in this file, not with `any`.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: write and prune backups in a chosen folder`.

### Task 4: Automatic backups

**Files:**
- Create: `src/lib/auto-backup.ts`, `tests/auto-backup.test.ts`
- Modify: `src/lib/api/import.api.ts`, `entrypoints/app/main.tsx`
- Delete: the `StorageWarning` component and its use in `main.tsx` (keep `persistStorage()`; its test stays).

**Interfaces:**
- Consumes: routes from Tasks 1–2 through `api()`; everything in Task 3.
- Produces:
  - `type RunResult = 'done' | 'downloaded' | 'skipped' | 'needs-access' | 'missing'`
  - `backUpNow(kind: BackupKind = 'sao-luu'): Promise<RunResult>` — inside `navigator.locks.request('qldc-backup', …)`: `POST /backup`, then folder granted → `writeBackup` → `POST /backup/done` (for `'sao-luu'` only; a safety copy is not a scheduled backup) → `'done'`; no folder and `kind === 'sao-luu'` → `downloadBackup` → `POST /backup/done` → `'downloaded'`; folder not granted → `'needs-access'`; `NotFoundError` → `'missing'`. A `truoc-khoi-phuc` with no usable folder → `'skipped'`.
  - `runDueBackup(): Promise<RunResult>` — `GET /backup/status`; not `due` or no folder → `'skipped'`; else `backUpNow()`, but never download (no folder → `'skipped'`).
  - `backupAfterImport(): Promise<RunResult>` — `auto` on and folder set → `backUpNow()`, else `'skipped'`.
  - `restoreBackup(file: unknown): Promise<BackupSummary>` — `backUpNow('truoc-khoi-phuc')` (result ignored), then `POST /restore/commit { file }`.
  - `startAutoBackup(): () => void` — `runDueBackup()` now and every hour (`setInterval`, cleared by the returned function); `'needs-access'` → one `toast.warning` per app open with action `'Continue automatic backup'` that calls `folderAccess(dir, true)` then `runDueBackup()`; `'missing'` → `toast.error('The backup folder is gone. Choose it again in Settings.')`; then, if `overdue && !warned_today`, `toast.warning('It has been a while since the last backup.')` with action linking to `#/settings?tab=backup`, and `POST /backup/warned`.
- `useCommitImport` `onSuccess` also calls `void backupAfterImport()`. `main.tsx` calls `startAutoBackup()` after render (in an effect inside a component rendered after `<Toaster />`, as `StorageWarning` did, so toasts aren't dropped).

- [ ] **Step 1: Failing tests in `tests/auto-backup.test.ts`** (`vi.mock('@/lib/backup-folder')` keeping `backupName`/`toPrune` real; stub `navigator.locks` with `{ request: vi.fn((_, fn) => fn()) }`; real backend over fake-indexeddb):
  - `permission lost`: `getFolder` → a handle, `folderAccess` → `'prompt'`, status due → `runDueBackup()` is `'needs-access'`, `writeBackup` not called, `last_backup_at` still null.
  - `folder gone`: `writeBackup` rejects with `new DOMException('', 'NotFoundError')` → `'missing'`, `last_backup_at` still null.
  - `due backup writes once and marks done`: granted → `'done'`, `writeBackup` called once with kind `'sao-luu'`, a second `runDueBackup()` → `'skipped'`.
  - `takes the lock`: `navigator.locks.request` called with `'qldc-backup'`.
  - `no folder`: `runDueBackup()` → `'skipped'`; `backUpNow()` → `'downloaded'` and `last_backup_at` set.
  - `import with auto off`: options `{ auto: false, days: 1 }` → `backupAfterImport()` is `'skipped'`.
  - `restore writes a safety copy first`: granted → `restoreBackup(file)` calls `writeBackup` with `'truoc-khoi-phuc'` before the data changes.
- [ ] **Step 2: Run** `pnpm vitest run tests/auto-backup.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `auto-backup.ts`, the import hook and the `main.tsx` change.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: automatic backups on a schedule and after imports`.

### Task 5: Settings page

**Files:**
- Create: `src/pages/settings/SettingsPage.tsx`, `GeneralTab.tsx`, `BackupTab.tsx`
- Modify: `src/tabs.tsx` (replace the `/backup` entry with `{ path: '/settings', label: 'Settings', icon: Settings, page: SettingsPage, visible: () => false }`), `src/components/layout/Header.tsx` (gear button → `<NavLink to="/settings">`, label `'Settings'`), `src/lib/api/backup.api.ts` (hooks `useInspectBackup`, `useRestoreBackup` → `restoreBackup`, `useUndoRestore`; each restore invalidates all queries), `locales/quan-li-dan-cu-vi.po`, `locales/vi.json`, `locales/quan-li-dan-cu.pot`, `README.md` (backup section; drop "Encrypted backups arrive in Plan 2")
- Delete: `src/components/layout/WardDialog.tsx`, `src/pages/backup/BackupPage.tsx`

**Interfaces:**
- Consumes: hooks from Tasks 1–2, `backUpNow`/`restoreBackup` (Task 4), `getFolder`/`chooseFolder`/`folderAccess`/`listBackups` (Task 3).

Behaviour (layout and wording are the builder's; the spec lists what each tab shows):
- `SettingsPage`: `Tabs` with values `general` and `backup`, bound to `?tab=` via `useSearchParams` (default `general`).
- `GeneralTab`: the WardDialog form, same `useSaveSettings` and messages, without the dialog.
- `BackupTab`: folder name (or "No folder chosen") with Choose/Change folder; last backup (`formatDate` from the old `BackupPage`); `Switch` for automatic backup; days field (number input, saves on blur through `useSaveBackupOptions`, shows the server message); Back up now (shows the `RunResult`: `'needs-access'` asks for access with a button, `'missing'` says choose again); restore list from `listBackups` with date/households/people from each file's `counts` (parse lazily, show "Damaged file" when it doesn't parse); "Choose another file…" (`accept=".json"`); confirmation dialog copied from the old `BackupPage`; "Undo the last restore" when `can_undo`, with its own confirmation.
- When the browser lacks `showDirectoryPicker`, hide the folder controls and keep Back up now (download) and restore from a file.

- [ ] **Step 1: Build the three components, the route and the header change; delete the two old files.**
- [ ] **Step 2: Run** `pnpm check && pnpm vitest run`. Expected: no type errors, all PASS.
- [ ] **Step 3: Translations:** `./scripts/i18n.sh makepot`, translate every new msgid in `locales/quan-li-dan-cu-vi.po`, then `./scripts/i18n.sh json`. Check `grep -c 'msgstr ""' locales/quan-li-dan-cu-vi.po` did not go up from before this task (the header line is one).
- [ ] **Step 4: Manual QA** (`pnpm build`, reload the unpacked extension in Edge or Chrome):
  1. Gear opens Settings → General; saving the ward name updates the header.
  2. Backup tab: choose a folder in iCloud/Drive; Back up now writes `sao-luu-….qldc.json`; "Last backup" updates.
  3. Set days to 1, reopen the app the next day (or set `backup-last` back a day in DevTools → IndexedDB): a file appears on open.
  4. Restart the browser: the "Continue automatic backup" toast appears; its button asks for access, then writes.
  5. Import a sheet: a new file appears right after.
  6. Open two app tabs while a backup is due: one new file, not two.
  7. Restore an older file: data replaced, a `truoc-khoi-phuc-…` file appears; Undo brings the data back.
  8. Restore a `.json` that isn't a backup: error shown, data unchanged.
  9. No "Chrome may clear this data" toast on open.
- [ ] **Step 5: Commit** `feat: settings page with backup and restore`.
