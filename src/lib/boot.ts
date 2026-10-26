import type { Settings } from '@/lib/api/settings.api';

/** Replaced by backend/settings.ts DEFAULT_SETTINGS in Task 4. */
export const DEFAULT_SETTINGS: Settings = { ward_code: '', ward_name: '', delete_on_uninstall: false };

/** Settings read before the first render, so the settings query needs no loading state. */
export let bootSettings: Settings = DEFAULT_SETTINGS;

export function setBootSettings(settings: Settings): void {
  bootSettings = settings;
}
