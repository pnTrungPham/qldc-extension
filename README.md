# Resident Management (Chrome extension)

The Quản lí dân cư admin app, running in its own Chrome tab with no server and no WordPress.
Residents, trash, overview, import and export are stored in the browser (IndexedDB).

> **Data lives only in this Chrome profile on this computer.** Uninstalling the extension, removing the
> profile or clearing site data deletes it. Choose a backup folder in Settings (ideally one synced by iCloud
> or Google Drive) so copies exist outside the browser.

## Backup and restore

Gear button → **Settings** → **Backup & restore**.

- Pick a folder once. The app writes `sao-luu-YYYY-MM-DD-HHmmss.qldc.json` there every N days (1–30) while the
  app is open, and after each import. It keeps the 30 newest.
- **Back up now** writes a file at once (a download when no folder is chosen).
- After a browser restart the folder permission is dropped: a toast asks you to click to continue.
- **Restore** from a file in the folder or any `.json` backup. Everything is replaced; the data before is kept
  (`truoc-khoi-phuc-…` file and **Undo the last restore**).
- Backup files are plain JSON, **not encrypted**: they hold names, phones and addresses. Keep the folder private.
- Needs Chrome or Edge (File System Access API). Without it, only download and restore from a file work.

## Develop

Needs Node 22 and pnpm 10.

```sh
pnpm i            # install, then `wxt prepare` runs
pnpm wxt          # dev build with reload, opens Chrome
pnpm wxt build    # production build → .output/chrome-mv3
pnpm test         # vitest
pnpm check        # typecheck
```

### Website (GitHub Pages)

The same app also runs as a plain website, without the extension: `pnpm build:web` → `.output/web`.
Each push to `main` deploys it via `.github/workflows/pages.yml` (Settings → Pages → Source: **GitHub Actions**).
Data still lives only in the visitor's browser, and separately from the extension's: move it with a backup and restore.

### Load unpacked

1. `pnpm wxt build`
2. Open `chrome://extensions` and turn on **Developer mode**.
3. **Load unpacked** → choose `.output/chrome-mv3`.
4. Click the toolbar icon: the app opens in a tab (or focuses the tab already open).

## Translations

UI text is English, translated with `@wordpress/i18n` from `locales/quan-li-dan-cu-vi.po`. The app
always shows Vietnamese. Needs PHP and wp-cli.

```sh
./scripts/i18n.sh makepot   # build, then extract strings → locales/quan-li-dan-cu.pot
./scripts/i18n.sh json      # sync the .po with the .pot, compile → locales/vi.json
```

Translate new strings in the `.po` between the two commands. `locales/vi.json` is bundled into the app at build time, so after `./scripts/i18n.sh json` run `pnpm build` again.

## Layout

- `entrypoints/` — the background (toolbar click) and the app page.
- `src/` — the plugin's `apps/admin/src`, copied; keep file names so fixes port between the repos.
- `src/backend/` — the plugin's PHP models, repositories, import service and controllers, ported to
  TypeScript over Dexie. `api()` in `src/lib/api/client.ts` calls `backend/router.ts` instead of REST.
