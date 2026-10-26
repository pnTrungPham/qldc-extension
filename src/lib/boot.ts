import type { Settings } from '@/lib/api/settings.api';
import { DEFAULT_SETTINGS } from '@/backend/settings';

/** Settings read before the first render, so the settings query needs no loading state. */
export let bootSettings: Settings = DEFAULT_SETTINGS;

export function setBootSettings(settings: Settings): void {
  bootSettings = settings;
}
