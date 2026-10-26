import { route } from '@/backend/router';

/** Shape of a REST error, as the plugin's apiFetch threw it. */
export type ApiError = { code: string; message: string };

/** The plugin's REST calls, served in the page by backend/router.ts over IndexedDB. */
export function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  return route<T>(path, method, data);
}
