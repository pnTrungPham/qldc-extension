/** Shape of a REST error, as the plugin's apiFetch threw it. */
export type ApiError = { code: string; message: string };

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  void method;
  void data;
  // Replaced by the in-browser router in Task 5.
  throw { code: 'rest_no_route', message: path } satisfies ApiError;
}
