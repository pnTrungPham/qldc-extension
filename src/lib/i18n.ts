import { createI18n, sprintf as wpSprintf } from '@wordpress/i18n';

import vi from '../../locales/vi.json';

/** Positional args (`%1$s`) defeat @wordpress/i18n's typed sprintf; keep the plugin's loose signature. */
const sprintf = wpSprintf as (format: string, ...args: Array<string | number>) => string;

/**
 * @wordpress/i18n with translations from locales/vi.json (compiled from the plugin's .po).
 *
 * Call through the object — `i18n.__('Text', 'quan-li-dan-cu')` — never destructure: `wp i18n make-pot`
 * reads the built bundle, and Rollup may rename a bare `__` binding (it renamed `_n` once) but never a
 * property name. Always pass the domain as a string literal.
 */
export const i18n = Object.assign(createI18n(), { sprintf });

/** Vietnamese for any `vi*` locale, English otherwise. */
export function loadLocale(locale: string): void {
  if (locale.toLowerCase().startsWith('vi')) {
    i18n.setLocaleData(vi.locale_data.messages, 'quan-li-dan-cu');
  } else {
    i18n.resetLocaleData(undefined, 'quan-li-dan-cu');
  }
}

// Here, not in main.tsx: tabs.tsx and labels.ts translate at module load, before main.tsx's body runs.
loadLocale(navigator.language);
