# Resident Management (Chrome extension)

The Quản lí dân cư admin app, running in its own Chrome tab with no server and no WordPress.
Residents, trash, overview, import and export are stored in the browser (IndexedDB).

> **Data lives only in this Chrome profile on this computer.** Uninstalling the extension, removing the
> profile or clearing site data deletes it. Encrypted backups arrive in Plan 2; until then, export often.

## Develop

Needs Node 22 and pnpm 10.

```sh
pnpm i            # install, then `wxt prepare` runs
pnpm wxt          # dev build with reload, opens Chrome
pnpm wxt build    # production build → .output/chrome-mv3
pnpm test         # vitest
pnpm check        # typecheck
```

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

Translate new strings in the `.po` between the two commands.

## Layout

- `entrypoints/` — the background (toolbar click) and the app page.
- `src/` — the plugin's `apps/admin/src`, copied; keep file names so fixes port between the repos.
- `src/backend/` — the plugin's PHP models, repositories, import service and controllers, ported to
  TypeScript over Dexie. `api()` in `src/lib/api/client.ts` calls `backend/router.ts` instead of REST.
