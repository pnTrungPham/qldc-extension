import type { Settings } from '@/lib/api/settings.api';
import { i18n } from '@/lib/i18n';

import { db } from './db';
import { textField, type Invalid } from './resident';

/** Port of PLUGIN Models/Settings.php. DEFAULT_SETTINGS is the single source of keys. */
export const DEFAULT_SETTINGS: Settings = { ward_code: 'KP21', ward_name: '' };

export async function getSettings(): Promise<Settings> {
  const stored = (await db.meta.get('settings'))?.value;
  return normalize(stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {});
}

/** The saved settings, or the first validation error. */
export async function saveSettings(input: Partial<Settings>): Promise<Settings | Invalid> {
  const clean = normalize({ ...(await getSettings()), ...input });

  if (!/^[A-Z0-9-]{2,12}$/.test(clean.ward_code)) {
    return {
      error: i18n.__(
        'The code can only use letters without accents, digits and hyphens, with no spaces, 2–12 characters.',
        'quan-li-dan-cu',
      ),
    };
  }

  const length = [...clean.ward_name].length;
  if (length < 2 || length > 80) {
    return { error: i18n.__('The ward name needs 2 to 80 characters.', 'quan-li-dan-cu') };
  }

  await db.meta.put({ key: 'settings', value: clean });
  return clean;
}

function normalize(input: Record<string, unknown>): Settings {
  const text = (key: keyof Settings) => textField(String(input[key] ?? DEFAULT_SETTINGS[key]));
  return { ward_code: text('ward_code').toUpperCase(), ward_name: text('ward_name') };
}
