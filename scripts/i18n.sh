#!/usr/bin/env bash
# makepot: strings from the built bundle → locales/quan-li-dan-cu.pot
# json:     sync the .po with the .pot, then locales/quan-li-dan-cu-vi.po → locales/vi.json (what lib/i18n.ts loads)
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  makepot)
    pnpm wxt build
    # At the default 128M wp-cli runs out of memory on this bundle.
    php -d memory_limit=1G "$(command -v wp)" i18n make-pot .output/chrome-mv3 locales/quan-li-dan-cu.pot --domain=quan-li-dan-cu
    ;;
  json)
    # Points the .po references at the current bundle, so make-json knows which file each string is in.
    wp i18n update-po locales/quan-li-dan-cu.pot locales/quan-li-dan-cu-vi.po
    rm -f locales/quan-li-dan-cu-vi-*.json
    wp i18n make-json locales --no-purge
    # make-json names the file after an md5 of the source path; one source bundle, so one file.
    mv locales/quan-li-dan-cu-vi-*.json locales/vi.json
    ;;
  *)
    echo "usage: $0 makepot|json" >&2
    exit 1
    ;;
esac
