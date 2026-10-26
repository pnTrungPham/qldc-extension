# QLDC Extension — Plan 1: Foundation (app runs offline on Dexie) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome extension that opens the existing Resident Management app in its own tab and works with no server: residents, trash, overview, import and export, all stored in the browser.

**Architecture:** Copy the plugin's React app (`apps/admin/src`) unchanged into the extension. Replace the 4 WordPress touch points (`wp.apiFetch`, `wp.i18n`, `qldcAdmin.caps`, `qldcAdmin.settings`). `api(path, method, data)` keeps its signature but dispatches to an in-browser router (`src/backend/router.ts`) whose handlers port the plugin's PHP (models, repositories, import service) to TypeScript over Dexie (IndexedDB). Pages and hooks do not change.

**Tech Stack:** WXT 0.20.x (Manifest V3, Vite), React 19, Tailwind v4, TanStack Query 5, Dexie 4, `@wordpress/i18n`, SheetJS 0.20.3, Vitest + fake-indexeddb.

**Spec:** Decisions agreed in the 2026-10-26 conversation (no separate doc):
- Install on any Windows PC that has only Chrome. No server, no WordPress.
- Data lives on that machine, in that Chrome profile. One user, so no roles.
- Develop with "Load unpacked". Ship later through the Chrome Web Store as an Unlisted item (Plan 4).
- Backups must be encrypted and must open on another machine (Plan 2).
- Source app: `/Users/mac/Sites/wpsource/wp-content/plugins/quan-li-dan-cu` (called **PLUGIN** below). Its PHP is the behaviour reference.

**Roadmap (separate plans, written after this one ships):**
- **Plan 2 — Backup:** `.kpb` files encrypted with a user passphrase (PBKDF2 + AES-GCM via Web Crypto), so they open on any machine; a reminder when the last backup is old.
- **Plan 3 — Side Panel:** search residents and paste chat messages next to Zalo Web.
- **Plan 4 — Release:** icons, privacy text, version bump script, Web Store zip.

## Global Constraints

- Repo: `/Users/mac/Sites/qldc-extension`, package manager pnpm 10, Node 22 (the local `node -v` is v22.23.3).
- WXT `^0.20.27` with `@wxt-dev/module-react`; Tailwind through `@tailwindcss/vite` added in `wxt.config.ts` → `vite: () => ({ plugins: [tailwindcss()] })`.
- SheetJS stays `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` (the npm `xlsx` is stale).
- UI text stays English and translatable: `i18n.__('Text', 'quan-li-dan-cu')`, called through the object, domain as a string literal (PLUGIN `docs/code-standards.md` § Translation).
- Production bundle keeps PLUGIN's terser options `compress: { conditionals: false }` and `format: { comments: /translators:/i }`, so `wp i18n make-pot` can still read strings from it.
- A full ID number is never stored: `id_last4` holds at most 4 digits, and export never includes it.
- Every write that touches more than one row runs inside `db.transaction('rw', ...)`: all or nothing.
- Keep PLUGIN's file names and copy under `src/` so later fixes can be diffed and ported between the two repos.

## Review Focus

1. **Chrome evicts the data.** IndexedDB is "best effort" unless persisted. Expected: the manifest has `unlimitedStorage`, and boot calls `navigator.storage.persist()`. Test in Task 7.
2. **An import fails halfway.** Expected: nothing is written. Test in Task 6 (a throw on the 3rd row leaves the resident count unchanged).
3. **Searching without accents.** "nguyen" must find "Nguyễn Văn An" by name and "tran hung" by address (MySQL collation did this for free in PLUGIN). Test in Task 4.
4. **A full ID number arrives.** Sanitize keeps only the last 4 digits of a 9/12-digit value, and export drops `id_last4` even if asked. Tests in Tasks 3 and 5.
5. **The app is open in two tabs.** Expected: after a change in tab A, tab B shows it when focused. PLUGIN's `lib/query-client.ts` turns this off (`refetchOnWindowFocus: false`); Task 5 removes that line so TanStack's default (refetch on focus) applies. Task 7's manual QA checks it.

---

## File Structure

```
qldc-extension/
  package.json, tsconfig.json, wxt.config.ts, vitest.config.ts, .gitignore
  entrypoints/
    background.ts          # toolbar click → open/focus app.html tab
    app/index.html         # <body class="qldc-ui"><div id="qldc-root">
    app/main.tsx           # boot: persist storage, load settings, render (from PLUGIN main.tsx); locale loads in lib/i18n.ts
  src/                     # = PLUGIN apps/admin/src, copied, then edited as below
    lib/fold.ts            # NEW: fold() moved here from pages/import/lib/parse.ts
    lib/i18n.ts            # EDIT: @wordpress/i18n + loadLocale()
    lib/caps.ts            # EDIT: all true
    lib/boot.ts            # NEW: bootSettings set before first render
    lib/api/client.ts      # EDIT: api() → route()
    backend/db.ts          # Dexie schema + types
    backend/resident.ts    # port of Models/Resident.php
    backend/settings.ts    # port of Models/Settings.php
    backend/audit.ts       # port of Repositories/AuditRepository.php
    backend/residents.ts   # port of Repositories/ResidentRepository.php
    backend/import.ts      # port of Services/ImportService.php
    backend/router.ts      # port of Controllers/*.php
  locales/                 # quan-li-dan-cu.pot, quan-li-dan-cu-vi.po, vi.json (compiled)
  scripts/i18n.sh          # makepot + make-json
  tests/                   # *.test.ts, setup.ts, fixtures/ (PLUGIN docs/import-samples)
```

---

### Task 1: Scaffold WXT and get the copied app to build

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `.gitignore` (`node_modules`, `.output`, `.wxt`), `entrypoints/background.ts`, `entrypoints/app/index.html`, `entrypoints/app/main.tsx`
- Copy: PLUGIN `apps/admin/src/**` → `src/`; PLUGIN `apps/admin/components.json` → `components.json`
- Modify: `src/lib/caps.ts`, `src/lib/boot.ts` (new), `src/lib/api/settings.api.ts`, `src/lib/api/client.ts`, `src/types/global.d.ts`, `src/main.tsx` (delete; replaced by `entrypoints/app/main.tsx`)

**Interfaces:**
- Produces: `bootSettings: Settings` and `setBootSettings(s: Settings): void` in `src/lib/boot.ts`. `api<T>(path: string, method?: string, data?: unknown): Promise<T>` keeps its signature; in this task it throws `{ code: 'rest_no_route', message: path }` until Task 5.

- [ ] **Step 0:** Delete the empty nested repo `/Users/mac/Sites/qldc-extension/qldc-extension` (it holds only an empty `.git`). The outer repo is the only one.
- [ ] **Step 1:** In `/Users/mac/Sites/qldc-extension` run `pnpm dlx wxt@0.20.27 init . -t react --pm pnpm`. Delete the template's `entrypoints/popup` and `assets` folders.
- [ ] **Step 2:** Copy PLUGIN `apps/admin/src` to `src/`, and PLUGIN `apps/admin/package.json` dependencies into `package.json`. Add `dexie@^4`, `@wordpress/i18n@^6`, `@tailwindcss/vite@^4.3.3`, `tailwindcss@^4.3.3`, `terser`. Run `pnpm install`.
- [ ] **Step 3:** In `wxt.config.ts`:
  - set `modules: ['@wxt-dev/module-react']`;
  - set `manifest: { name: 'Resident Management', permissions: ['unlimitedStorage'], action: {} }`. There is no popup, so a toolbar click reaches the background;
  - set `alias: { '@': resolve('src') }`. WXT already maps `@` and `~` to `srcDir` (the project root by default), so after `pnpm wxt prepare` check `.wxt/tsconfig.json`: `@/*` must point at `src/*`. `tsconfig.json` extends `./.wxt/tsconfig.json`;
  - set `vite: () => ({ plugins: [tailwindcss()], build: { minify: 'terser', terserOptions: <PLUGIN values> } })`.
- [ ] **Step 4:** `entrypoints/background.ts`: on `browser.action.onClicked`, find an existing app tab with `browser.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [browser.runtime.getURL('/app.html')] })` (no `tabs` permission needed), and focus its tab and window. Otherwise create one.
- [ ] **Step 5:** `entrypoints/app/index.html`: `<body class="qldc-ui"><div id="qldc-root"></div><script type="module" src="./main.tsx"></script></body>`, with `<title>Resident Management</title>`. `entrypoints/app/main.tsx`: PLUGIN `src/main.tsx` with these changes:
  - imports `@/main.css`;
  - `<Toaster />` has no wp-admin `offset`;
  - render only after `setBootSettings(DEFAULT_SETTINGS)`. Task 4 replaces this with the stored settings.
- [ ] **Step 6:** Remove the WordPress globals:
  - `caps.ts` → `export const caps = { view: true, edit: true, manage: true };`.
  - `settings.api.ts` → `initialData: () => bootSettings`.
  - `client.ts` → the stub described under Interfaces.
  - `global.d.ts` → delete the `qldcAdmin` and `wp` declarations.
  - Delete `src/components/ui/image-picker` (it needs `wp.media`, and nothing in `pages/` uses it).
  - Leave `lib/i18n.ts` pointing at a temporary `{ __: (t) => t, _n: (s, p, n) => (n === 1 ? s : p), sprintf }` from `@wordpress/i18n` until Task 2.
- [ ] **Step 7:** Hide the Backup tab until Plan 2: in `src/tabs.tsx`, set `visible: () => false` on `/backup`.
- [ ] **Step 8:** Add the script `"check": "wxt prepare && tsc --noEmit"` (PLUGIN typechecks before building; `wxt build` does not). Run `pnpm check && pnpm wxt build`. Expected: both exit 0. Run `grep -rn "window.wp\|qldcAdmin" src entrypoints`. Expected: no output.
- [ ] **Step 9:** Manual check. Open `chrome://extensions`, turn on Developer mode, choose Load unpacked → `.output/chrome-mv3`, then click the toolbar icon. Expected: a tab opens with the header and tabs. Pages show the API error state; that is expected until Task 5.
- [ ] **Step 10:** Commit: `git add -A && git commit -m "chore: scaffold WXT extension with the copied admin app"`.

### Task 2: Translations without WordPress

**Files:**
- Modify: `src/lib/i18n.ts`
- Create: `scripts/i18n.sh`, `locales/` (copy PLUGIN `languages/quan-li-dan-cu.pot`, `languages/quan-li-dan-cu-vi.po`), `vitest.config.ts`, `tests/setup.ts`, `tests/i18n.test.ts`

**Interfaces:**
- Produces: `i18n` (an object with `__`, `_n`, `sprintf`); `loadLocale(locale: string): void`. It uses Vietnamese when `locale` starts with `vi` and English otherwise.
- `tabs.tsx` and `pages/residents/labels.ts` call `i18n.__()` at module load, which runs before any code in `main.tsx`'s body. So the locale must be loaded inside `lib/i18n.ts` itself, not in `main.tsx`.

- [ ] **Step 1:** Add `vitest` and `fake-indexeddb` as dev dependencies. In `vitest.config.ts`, reuse the `@` alias and use `setupFiles: ['tests/setup.ts']`. `tests/setup.ts` imports `fake-indexeddb/auto`.
- [ ] **Step 2:** Failing test `tests/i18n.test.ts`:
  ```ts
  test('Vietnamese strings load', () => { loadLocale('vi-VN'); expect(i18n.__('Residents', 'quan-li-dan-cu')).toBe('Cư dân'); });
  test('English stays as written', () => { loadLocale('en-US'); expect(i18n.__('Residents', 'quan-li-dan-cu')).toBe('Residents'); });
  test('sprintf is on the object', () => { expect(i18n.sprintf('%1$s added %2$s', 'A', 'B')).toBe('A added B'); });
  ```
- [ ] **Step 3:** Run `pnpm vitest run tests/i18n.test.ts`. Expected: FAIL (`loadLocale` is not exported).
- [ ] **Step 4:** `scripts/i18n.sh`:
  - `makepot`: `pnpm wxt build && php -d memory_limit=1G $(command -v wp) i18n make-pot .output/chrome-mv3 locales/quan-li-dan-cu.pot --domain=quan-li-dan-cu`. The memory flag is needed; at 128M wp-cli runs out of memory on this bundle.
  - `json`: `wp i18n make-json locales --no-purge`, then rename the output to `locales/vi.json`.

  For now, copy PLUGIN `languages/quan-li-dan-cu-vi-qldc-admin.json` to `locales/vi.json`; it is already compiled. The script is needed only when strings change (Task 7).
- [ ] **Step 5:** `src/lib/i18n.ts`:
  - `import { createI18n, sprintf } from '@wordpress/i18n'`, `export const i18n = Object.assign(createI18n(), { sprintf })`. `createI18n()` has no `sprintf`, and the pages call `i18n.sprintf`;
  - `loadLocale` calls `i18n.setLocaleData(vi.locale_data.messages, 'quan-li-dan-cu')` for `vi`, and `i18n.resetLocaleData(undefined, 'quan-li-dan-cu')` otherwise;
  - the module ends with `loadLocale(navigator.language)`, so translations are ready before any module-level `i18n.__()` runs;
  - keep PLUGIN's docblock about calling through the object.
- [ ] **Step 6:** Run `pnpm vitest run tests/i18n.test.ts`. Expected: PASS.
- [ ] **Step 7:** Commit `feat: translations from the plugin's .po without WordPress`.

### Task 3: Resident model (port of `Models/Resident.php`)

**Files:**
- Create: `src/lib/fold.ts`, `src/backend/resident.ts`, `tests/resident.test.ts`
- Modify: `src/pages/import/lib/parse.ts` (import `fold` from `@/lib/fold`, re-export it)

**Interfaces:**
- Produces:
  - `fold(text: string): string`;
  - constants `GENDERS, RELATIONS, RESIDENCE_STATUSES, VERIFY_STATUSES, POLICY_TAGS, SUPPORT_FLAGS, EXPORT_COLUMNS` (values copied from PHP);
  - `type Invalid = { error: string }` and `isInvalid(x: unknown): x is Invalid`;
  - `sanitize(input: Record<string, unknown>): ResidentInput | Invalid`. `ResidentInput` is from `@/lib/api/residents.api`.

- [ ] **Step 1:** Failing tests in `tests/resident.test.ts`, one `test` per line:
  ```ts
  const ok = (extra = {}) => sanitize({ full_name: 'Nguyễn Văn An', ...extra }) as ResidentInput;
  expect(isInvalid(sanitize({ full_name: 'X' }))).toBe(true);
  expect(ok({ phone: '0903.412.885' }).phone).toBe('0903412885');
  expect(ok({ phone: '+84912000111' }).phone).toBe('0912000111');
  expect(isInvalid(sanitize({ full_name: 'Ab', phone: '912345678' }))).toBe(true);
  expect(ok({ birth_year: '15/03/1985' }).birth_year).toBe(1985);
  expect(ok({ birth_year: '1987-06-20' }).birth_year).toBe(1987);
  expect(ok({ birth_year: '' }).birth_year).toBeNull();
  for (const bad of ['78', '5/1/12', '1850', String(new Date().getFullYear() + 1)]) expect(isInvalid(sanitize({ full_name: 'Ab', birth_year: bad }))).toBe(true);
  expect(ok({ id_last4: '079085001234' }).id_last4).toBe('1234');
  expect(ok({ id_last4: '123456789' }).id_last4).toBe('6789');
  expect(isInvalid(sanitize({ full_name: 'Ab', id_last4: '12345' }))).toBe(true);
  expect(ok({ relation: 'head' })).toMatchObject({ relation: 'head', is_head: true });
  expect(ok({ relation: 'nonsense' }).relation).toBe('other');
  expect(ok({ exam_date: '05/03/2026' })).toMatchObject({ exam_date: '2026-03-05', health_exam: true });
  expect(isInvalid(sanitize({ full_name: 'Ab', exam_date: '31/02/2026' }))).toBe(true);
  expect(ok({ household_code: 'kp21-001' }).household_code).toBe('KP21-001');
  expect(ok({ policy_tags: ['elderly', 'bogus'] }).policy_tags).toEqual(['elderly']);
  expect(ok({ full_name: '  <b>Lê</b>   Văn  ' }).full_name).toBe('Lê Văn');
  expect(fold('Đặng Thị Hoa')).toBe('dang thi hoa');
  ```
- [ ] **Step 2:** Run `pnpm vitest run tests/resident.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Move `fold` from `pages/import/lib/parse.ts` to `src/lib/fold.ts` and re-export it from `parse.ts`. Implement `src/backend/resident.ts` by porting `sanitize` and its private helpers line for line:
  - `sanitize_text_field` → strip tags, collapse runs of whitespace to one space, trim;
  - the textarea variant keeps newlines;
  - `mb_substr` → `[...s].slice(0, max).join('')`;
  - dates are strict: `dd/mm/yyyy` with 2-digit day and month, or `yyyy-mm-dd`, and must round-trip through `Date`;
  - error messages are the PHP strings wrapped in `i18n.__(…, 'quan-li-dan-cu')`.
- [ ] **Step 4:** Run `pnpm vitest run tests/resident.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: resident validation ported from the plugin`.

### Task 4: Database, settings, audit and the residents repository

**Files:**
- Create: `src/backend/db.ts`, `src/backend/settings.ts`, `src/backend/audit.ts`, `src/backend/residents.ts`, `tests/residents.test.ts`, `tests/settings.test.ts`
- Modify: `entrypoints/app/main.tsx` (`setBootSettings(await getSettings())`), `src/components/layout/WardDialog.tsx` (remove the "Delete all residents and settings when the plugin is deleted" checkbox)

**Interfaces:**
- Consumes: `sanitize`, `fold`, the constants (Task 3).
- Produces:
  - `db.ts`:
    - `db` with tables `residents: Table<ResidentRow, number>`, `audit: Table<AuditRow, number>`, `meta: Table<{ key: string; value: unknown }, string>`;
    - `type ResidentRow = Resident & { full_name_search: string }`;
    - `type AuditRow = { id?: number; action: string; resident_id: number; changed_fields: string[]; created_at: string }`;
    - `now(): string` (UTC `YYYY-MM-DD HH:MM:SS`, as PLUGIN stores it);
    - `transaction<T>(work: () => Promise<T>): Promise<T>`, which is `db.transaction('rw', db.residents, db.audit, db.meta, work)`. All 3 tables are needed: writes log to `audit`, and import reads settings from `meta`. Inside `work`, await only Dexie calls; any other await commits the transaction early.
  - `settings.ts`: `DEFAULT_SETTINGS`, `getSettings(): Promise<Settings>`, `saveSettings(input: Partial<Settings>): Promise<Settings | Invalid>`.
  - `audit.ts`: `log(action: string, residentId: number, changed?: string[]): Promise<void>`, `recent(limit: number): Promise<Stats['recent']>` (`user` is always `''`).
  - `residents.ts`:
    - `type Filters = { trash?: boolean; search?: string; status?: string; exam?: string; phone?: string; policy?: string }`;
    - `paginate(page, perPage, filters): Promise<ResidentPage>` and `all(filters): Promise<Resident[]>`;
    - `stats(): Promise<Omit<Stats, 'recent'>>`;
    - `find(id)` and `findTrashed(id)`: `Promise<Resident | null>`;
    - `create(data: ResidentInput): Promise<Resident>` and `update(id, data): Promise<Resident | null>`;
    - `trash(id)`, `restore(id)`, `purge(id)`: `Promise<boolean>`;
    - `purgeAll(): Promise<number>`;
    - `findMatch(name, birthYear: number | null, idLast4: string): Promise<Resident | null>`;
    - `maxHouseholdNumber(prefix): Promise<number>` and `householdExists(code): Promise<boolean>`.

- [ ] **Step 1:** Failing tests in `tests/residents.test.ts`. `beforeEach` clears the 3 tables and creates An (1978, `0903412885`, `12 Đường Trần Hưng`, `KP21-001`, `head`) and Bình (1980, same address and code, `spouse`).
  - `paginate(1, 20, { search: 'nguyen' })` returns only An.
  - `paginate(1, 20, { search: 'tran hung' })` returns both.
  - `paginate(1, 20, { search: '0903' })` returns An.
  - `paginate(1, 20, { search: '...' })` returns both, not an empty list and not an error.
  - The list's `households` is 1, and each item's `household_size` is 2.
  - After `trash(an.id)`:
    - `paginate(1,20,{})` gives `total` 1 and `trashed` 1;
    - `paginate(1,20,{ trash: true })` returns An;
    - `find(an.id)` is `null`;
    - `restore(an.id)` makes `find` work again.
  - `purge(bình.id)` on a live resident returns `false` and keeps the row.
  - `findMatch('nguyen van an', 1978, '')` returns An.
  - `findMatch('Người Khác', null, '1234')` returns null even when An has `id_last4` `1234`.
  - `maxHouseholdNumber('KP21')` is 1. `householdExists('KP21-001')` is true.
  - `stats()` gives `people` 2, `gender.unknown` 2, `age.adult` 2.
  - After `update(an.id, sanitize({...an, phone: '0909999888'}))`, `recent(8)[0]` equals `{ action: 'update', resident: 'Nguyễn Văn An', changed_fields: ['phone'], user: '' }` (ignoring `created_at`).

  In `tests/settings.test.ts`:
  - `saveSettings({ ward_code: 'kp 21' })` is invalid;
  - `saveSettings({ ward_code: 'kp21', ward_name: 'Khu phố 21' })` returns `ward_code: 'KP21'`.
- [ ] **Step 2:** Run `pnpm vitest run tests/residents.test.ts tests/settings.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the four modules, porting PHP behaviour:
  - Schema: `db.version(1).stores({ residents: '++id', audit: '++id', meta: 'key' })`. Filtering runs in memory over `toArray()`. Add the comment `// ponytail: full scans; add indexes if a ward passes ~20k residents`.
  - Search folds both sides, so address search ignores accents too. The phone term is the search with spaces, `.` and `-` removed, and is skipped when that leaves nothing (PHP `build_where`).
  - Sort order: the list by `id` desc; the trash by `deleted_at` desc, then `id` desc; `all()` by `household_code`, then `is_head` desc, then `id`.
  - `update` logs only the fields that changed. `maxHouseholdNumber` counts trashed rows too, so a code is never reused.
  - Settings live in `meta` under the key `'settings'`. Keep PHP's validation messages.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: IndexedDB storage for residents, settings and the activity log`.

### Task 5: Router, so every page works

**Files:**
- Create: `src/backend/router.ts`, `tests/router.test.ts`
- Modify: `src/lib/api/client.ts` (`return route<T>(path, method, data)`), `src/lib/query-client.ts` (remove `refetchOnWindowFocus: false`, so a tab refetches when focused; see Review Focus 5)

**Interfaces:**
- Consumes: Task 4 modules.
- Produces: `route<T>(path: string, method?: string, data?: unknown): Promise<T>`. It throws `ApiError` (`{ code, message }`, from `client.ts`): `invalid_arguments` for validation errors, `not_found` for a missing id, and `rest_no_route` for an unknown route.

Routes. Behaviour, limits and response shapes follow the PLUGIN controllers:

| Method | Path | Port of |
|---|---|---|
| GET / POST | `/residents` | `ResidentRestController::index` / `create` (`per_page` ≤ 200) |
| GET / PATCH / DELETE | `/residents/:id` | `show` / `update` (with the `is_head` follows `relation` rule) / `destroy` |
| DELETE | `/residents/trash` | `empty_trash` |
| POST | `/residents/bulk` | `bulk` (≤ 200 ids, one transaction) |
| GET / POST | `/settings` | `SettingsRestController` |
| GET | `/stats` | `StatsRestController` (`recent` limit 8) |
| GET | `/export` | `ExportRestController` (`columns[]` limited to `EXPORT_COLUMNS`) |

- [ ] **Step 1:** Failing tests in `tests/router.test.ts`:
  - `POST /residents { full_name: 'X' }` rejects with `{ code: 'invalid_arguments' }`.
  - `POST` then `GET /residents/1` returns the resident.
  - `PATCH /residents/1 { relation: 'child' }` on a head gives `is_head` false.
  - `GET /residents/999` rejects with `not_found`.
  - `POST /residents/bulk { ids: [1,2], action: 'set_health_exam', value: 'no' }` returns `{ affected: 2 }`, and both have `exam_date` null.
  - `POST /residents/bulk` with 201 ids rejects with `invalid_arguments`.
  - `GET /export?columns[]=full_name&columns[]=id_last4` returns rows with only `full_name`.
  - `GET /nope` rejects with `rest_no_route`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `route`: parse with `new URL(path, 'http://local')`, and match routes in the table's order. `/residents/trash` comes before `/residents/:id`; `:id` is `\d+`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Run `pnpm wxt build` and reload the extension. Manual check:
  - the WardDialog asks for the ward;
  - add a resident, edit, trash, restore, empty trash;
  - Overview shows the counts and recent activity;
  - Export downloads an `.xlsx`.
- [ ] **Step 6:** Commit `feat: in-browser API so every page runs without a server`.

### Task 6: Import

**Files:**
- Create: `src/backend/import.ts`, `tests/import.test.ts`, `tests/fixtures/` (copy PLUGIN `docs/import-samples/*`)
- Modify: `src/backend/router.ts` (add `POST /import/preview` and `/import/commit`, rows ≤ 5000)

**Interfaces:**
- Consumes: `sanitize`, `findMatch`, `maxHouseholdNumber`, `householdExists`, `create`, `update`, `transaction`, `log`, `getSettings`.
- Produces: `preview(rows: unknown[], autoUpdate: boolean): Promise<ImportPreview>` and `commit(rows: unknown[], autoUpdate: boolean): Promise<ImportResult>`. Both types come from `@/lib/api/import.api`.

- [ ] **Step 1:** Failing tests in `tests/import.test.ts`. Seed An and Bình as in Task 4, with ward `KP21`. Build `rows` the way the page does: `readTable(new File([readFileSync('tests/fixtures/demo-to-1.xlsx')], 'demo-to-1.xlsx'))` → `toTable` → `buildPending(tables, [], {}).rows`.
  ```ts
  expect(await preview(rows, true)).toMatchObject({ will_add: 12, will_update: 2, invalid: 6 });
  expect(await commit(rows, true)).toEqual({ added_people: 11, added_households: 7, updated: 1, skipped: 8 });
  expect((await all({ search: 'le van cuong' }))[0].household_code).toBe('KP21-002');
  expect((await all({ search: 'trinh thi oanh' }))[0].household_code).toBe('KP21-900');
  ```
  Atomicity test: `vi.spyOn(residents, 'create')` throws on its 3rd call. Then `commit(rows, true)` rejects with `{ code: 'import_failed' }`, and `(await paginate(1, 200, {})).total` is still 2.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Port `ImportService.php`: `FIELDS`, `TEMP_CODE`, `gender()`, `relation()`, `prepare()`, and `write()` inside `transaction()`. On error, throw `{ code: 'import_failed', message: i18n.__('Nothing was written. Please try again.', 'quan-li-dan-cu') }`. Afterwards log `import` with `added:N` and `updated:N`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Manual check. Import all three fixture files in the extension; the success banner shows the same counts as the commit test.
- [ ] **Step 6:** Commit `feat: import from Excel, CSV, chat text and paper forms`.

### Task 7: Keep the data, then ship to the repo

**Files:**
- Create: `src/lib/persist.ts`, `tests/persist.test.ts`, `README.md`
- Modify: `entrypoints/app/main.tsx`

**Interfaces:**
- Produces: `persistStorage(): Promise<boolean>`. It calls `navigator.storage.persist()` when `navigator.storage.persisted()` is false, and returns the final state.

- [ ] **Step 1:** Failing test `tests/persist.test.ts`: stub `navigator.storage` with `persisted: async () => false` and `persist: vi.fn(async () => true)`. Expect `await persistStorage()` to be true and `persist` to have been called once. A second test, with `persisted: async () => true`, expects `persist` not to be called.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it, and call it in `main.tsx` before rendering. First load the unpacked build and log what `persistStorage()` returns. If Chrome returns `false` even with `unlimitedStorage`, the warning would show on every launch: show it once (remember that in `meta`) or drop it, and note the result here. Otherwise, if it returns false, show a `toast.warning`, translatable: `'Chrome may clear this data when the disk is full. Make backups often.'`. Add the Vietnamese translation to `locales/quan-li-dan-cu-vi.po`, then run `./scripts/i18n.sh makepot && ./scripts/i18n.sh json`.
- [ ] **Step 4:** Run `pnpm vitest run && pnpm check && pnpm wxt build`. Expected: all tests pass and the build exits 0. Check that `.output/chrome-mv3/manifest.json` contains `"unlimitedStorage"`.
- [ ] **Step 5:** Manual QA on a Windows PC (or Chrome on the Mac):
  1. Load unpacked, import `demo-to-1.xlsx`, then close and reopen Chrome. The data is still there.
  2. Open the app in two tabs and add a resident in tab A. When tab B is focused it shows the new resident.
  3. Switch Chrome to Vietnamese. The UI is in Vietnamese.
- [ ] **Step 6:** `README.md` covers: what the extension is, `pnpm i`, `pnpm wxt` (dev), `pnpm wxt build`, how to Load unpacked, `./scripts/i18n.sh`, and the warning that data lives only in this Chrome profile.
- [ ] **Step 7:** Commit `feat: ask Chrome to keep the data; README`, then `git push -u origin main`.
