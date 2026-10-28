# Settings page and folder backups — design

Decided in the 2026-10-28 conversation. Replaces the roadmap's Plan 2 ("encrypted `.kpb`"): the user chose
**no passphrase**.

## Why

All data lives in one browser profile's IndexedDB. Uninstalling the extension, removing the profile or
clearing site data loses everything, and today the only way out is a manual export. The user wants backups
that happen on their own, into a folder on the machine they pick (ideally an iCloud or Google Drive folder,
so a copy also leaves the machine), and a way to restore from them.

The user also wants one **Settings** page with small tabs, so later features have a home.

## Goals

- A `/settings` page with tabs. First two: **General** (ward code and name, moved from `WardDialog`) and
  **Backup & restore**.
- Pick a folder once. The app writes backup files there by itself, every **N days** (the user types N).
- "Back up now" button.
- Restore from a file in that folder (listed) or any file the user picks.
- A backup file opens on any machine with the extension, with no password.

## Non-goals

- Encryption or a passphrase (the user's decision; see Risks).
- Backing up while the app tab is closed (no background-worker backups).
- Google Drive / cloud APIs. A synced folder covers it.
- Merging a backup into current data. Restore replaces everything.
- Other settings tabs. Add them when a feature needs one.

## Anti-goals (a failure even if it works)

- Losing data: a restore that fails halfway, or one that does not keep the current data first.
- Nagging: a warning on every launch (the current "Chrome may clear this data" toast is exactly this, and
  goes away).
- A backup that silently stops. If the app cannot write to the folder, the user must see it.

## Behaviour

### Settings page

- Route `/settings`, reached by the gear button in the header (today it opens `WardDialog`). It is not a
  header tab.
- Tabs with `src/components/ui/tabs.tsx`. The selected tab is in the URL (`/settings?tab=backup`), so the
  backup warning can link straight to it.
- **General**: the `WardDialog` form inline, same validation and API (`/settings`). `WardDialog` is deleted.
- **Backup & restore**: replaces the hidden `/backup` tab and `BackupPage.tsx`'s WordPress copy (the `.kpb`
  and "only opens on the WordPress site" text go).

### Backup settings

| Setting | Default | Rule |
|---|---|---|
| Automatic backup on/off | on, once a folder is chosen | switch |
| Every N days | 1 | whole number, 1–30 |
| Folder | none | chosen with `showDirectoryPicker({ mode: 'readwrite' })` |

Stored in `db.meta` (the `FileSystemDirectoryHandle` is structured-cloneable, so it goes in IndexedDB as is),
along with the time of the last successful backup.

The page shows: the folder name, "Last backup: <local date and time>", the switch, the days input,
"Change folder", "Back up now".

### When a backup runs

- On app open: if automatic backup is on and the last backup is older than N days, back up.
- While the app stays open: check again every hour, same rule.
- After an import commit: back up if automatic backup is on and a folder is set, whatever N is.
  *(Builder-check call: "off" means off.)*
- "Back up now": always. With no folder set it downloads the file instead; a download counts as the last
  backup. *(Call.)*
- Only one tab backs up at a time (two open tabs must not write two files for the same moment). Use
  `navigator.locks.request('qldc-backup', …)`.

### Folder permission

Browsers usually drop the folder permission when restarted, and `requestPermission()` needs a click.
- Before writing, `queryPermission({ mode: 'readwrite' })`. If it is not `granted`, do not prompt on load:
  show a persistent banner/toast "Click to continue automatic backup" whose button calls
  `requestPermission()`, then runs the due backup.
- If the folder was deleted or moved (write throws `NotFoundError`), say so and point to "Change folder".

### The file

- Name: `sao-luu-YYYY-MM-DD-HHmmss.qldc.json` (local time, with seconds). If that name exists, add `-2`,
  `-3`… before `.qldc.json`; never overwrite a file. Safety copies taken before a restore use the prefix
  `truoc-khoi-phuc-` with the same pattern. Prefixes are fixed, not translated, so the listing can find
  the files. *(Call: seconds plus suffix, so two backups in one minute never replace each other.)*
- Content, one JSON object:
  `{ format: 'qldc-backup', version: 1, created_at, counts: { households, people }, residents, audit, settings }`.
  `residents` includes the trash. `settings` holds the ward settings only, never the folder handle.
  `full_name_search` is not stored; it is rebuilt on restore.
- Read all tables in one Dexie read transaction, then write the file **outside** the transaction
  (`db.ts`: awaiting non-Dexie work inside a transaction commits it early).
- Write to the final name with `createWritable()` (it writes to a temp file and swaps on `close()`), so a
  half-written backup never appears.
- Retention: keep the 30 newest `sao-luu-*.qldc.json` files and the 10 newest `truoc-khoi-phuc-*.qldc.json`
  files, counted separately; delete older ones of each kind. Never touch other files. *(Call: safety copies
  are counted apart so a run of backups cannot push them out, and vice versa. Imports are rare enough that
  30 files still span weeks.)*

### Restore

- The tab lists the backup files in the folder, newest first, with date, households and people (from
  `counts`). Plus "Choose another file…" (`<input type="file" accept=".json">`).
- Pick one → show its date and counts → "Restore this backup" → confirmation dialog (as in today's
  `BackupPage`).
- On confirm, in order:
  1. Save the current data as `db.meta` key `before-restore` (same JSON), in the **same** `transaction()`
     that replaces `residents`, `audit` and the ward settings. Any error leaves the data as it was, and a
     finished restore always has the previous data next to it, whatever the folder's state.
  2. Before that transaction, if the folder is set and writable, also write a `truoc-khoi-phuc-…` file.
     If it is not writable, the restore still goes ahead (step 1 covers it); no download.
  - The tab shows "Undo the last restore" while `before-restore` exists: it restores from it (through the
    same path, so it gets its own `before-restore`).
  *(Call: the in-database copy replaces "offer a download", because a download can't be confirmed and the
  restore would either block on it or not really be protected by it.)*
- Validate before replacing: `format === 'qldc-backup'`, a known `version`, each resident through the
  existing sanitize/validate in `src/backend/resident.ts`. An invalid file changes nothing and shows why.
- After restore, `queryClient.invalidateQueries()` (as `useRestoreBackup` does today).

### Warnings

- Overdue: automatic backup on and the last backup is older than **2 × N** days, or off and older than
  7 days, or never backed up while residents exist. Shown as a toast with a link to
  `/settings?tab=backup`, **at most once a day** (remember the day it was shown in `db.meta`).
  *(Call: once a day, not every open, so a user without a folder is reminded without being nagged.)*
- Remove `StorageWarning` and its toast string from `entrypoints/app/main.tsx`. Keep `persistStorage()`
  (harmless, and it helps where it is granted).

## Constraints

- Chrome/Edge only (File System Access API). The extension already targets Chrome on Windows.
- UI strings in English through `i18n.__(…, 'quan-li-dan-cu')`, with Vietnamese added to the `.po`
  (see `src/lib/i18n.ts` and README § Translations).
- `id_last4` is part of a resident and goes in the backup (the export rule that drops it is about
  spreadsheets).
- Backend logic lives in `src/backend/` behind `router.ts` like the rest, except the folder writing itself,
  which must run in the page (handles and permission prompts are page APIs).

## Risks the user accepted

- **No encryption.** The file holds names, phone numbers, addresses and years of birth (ID numbers only as
  the last 4 digits). Anyone with access to the folder, or the cloud account syncing it, can read it.
- One profile, one folder: two machines pointing at the same synced folder would interleave files. Not
  handled.

## Left to the builder

- Layout of the two tabs and the wording of messages.
- Whether the hourly check is a `setInterval` or a check on window focus.
- How the router exposes "make backup JSON" and "restore from JSON" (e.g. `POST /backup`,
  `POST /restore/inspect`, `POST /restore/commit`, matching the names `backup.api.ts` already uses).
- Tests: at least round-trip (backup → restore gives the same residents), invalid file changes nothing,
  restore failure halfway changes nothing, retention keeps 30, due-date rule.
