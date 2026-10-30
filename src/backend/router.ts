import type { ApiError } from '@/lib/api/client';
import type { Resident, ResidentInput } from '@/lib/api/residents.api';
import { i18n } from '@/lib/i18n';

import { recent } from './audit';
import { getBackupStatus, inspect, markBackedUp, markWarned, restore, saveBackupOptions, snapshot, undoRestore } from './backup';
import { transaction } from './db';
import { commit, MAX_ROWS, preview } from './import';
import { EXPORT_COLUMNS, isInvalid, POLICY_TAGS, RESIDENCE_STATUSES, sanitize, SUPPORT_FLAGS, VERIFY_STATUSES, type Invalid } from './resident';
import * as residents from './residents';
import { getSettings, saveSettings } from './settings';

/** Port of PLUGIN Controllers/*.php: what wp.apiFetch reached over REST, called in the page instead. */

type Json = Record<string, unknown>;
type Handler = (match: string[], query: URLSearchParams, body: Json) => Promise<unknown>;

// Everything is in this browser, so the limit only guards against a runaway request.
const BULK_LIMIT = 10000;
const RECENT = 8;

const fail = (code: string, message: string): never => {
  throw { code, message } satisfies ApiError;
};
const invalid = (message = 'Invalid Arguments.') => fail('invalid_arguments', message);
const notFound = () => fail('not_found', 'Not Found.');
const valid = <T>(result: T | Invalid): T => (isInvalid(result) ? invalid(result.error) : result);

/** WP REST arg validation for an optional enum query parameter. */
function oneOf(query: URLSearchParams, key: string, allowed: readonly string[]): string | undefined {
  const value = query.get(key);
  if (value === null || value === '') return undefined;
  return allowed.includes(value) ? value : invalid();
}

function int(query: URLSearchParams, key: string, fallback: number, min: number, max = Infinity): number {
  const raw = query.get(key);
  const value = raw === null ? fallback : Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : invalid();
}

const YES_NO = ['yes', 'no'];

/** The filters the list and the export share. Unknown values are rejected, not ignored. */
const listFilters = (query: URLSearchParams) => ({
  search: query.get('search') ?? '',
  status: oneOf(query, 'status', RESIDENCE_STATUSES),
  exam: oneOf(query, 'exam', YES_NO),
  head: oneOf(query, 'head', YES_NO),
  verify: oneOf(query, 'verify', VERIFY_STATUSES),
  policy: oneOf(query, 'policy', POLICY_TAGS),
  support: oneOf(query, 'support', SUPPORT_FLAGS),
});

const pageFilters = (query: URLSearchParams) => ({
  ...listFilters(query),
  trash: ['true', '1'].includes(query.get('trash') ?? ''),
  phone: oneOf(query, 'phone', YES_NO),
  household: query.get('household') ?? undefined,
  sort: oneOf(query, 'sort', residents.SORTS),
  order: oneOf(query, 'order', ['asc', 'desc']),
});

const routes: Array<[method: string, path: RegExp, handler: Handler]> = [
  ['GET', /^\/residents$/, async (_, query) => residents.paginate(int(query, 'page', 1, 1), int(query, 'per_page', 20, 1, 200), pageFilters(query))],
  // Everyone the list's filters match, not just the page on screen.
  ['GET', /^\/residents\/ids$/, async (_, query) => ({ ids: await residents.ids(pageFilters(query)) })],
  // No household given: the person starts a new one and heads it.
  ['POST', /^\/residents$/, async (_, __, body) =>
    transaction(async () => {
      const data = valid(sanitize(body));
      if (data.household_code !== '') return residents.create(data);
      const code = await residents.nextHouseholdCode((await getSettings()).ward_code);
      return residents.create({ ...data, household_code: code, relation: 'head', is_head: true });
    })],
  ['DELETE', /^\/residents\/trash$/, async () => ({ affected: await transaction(() => residents.purgeAll()) })],
  ['POST', /^\/residents\/bulk$/, async (_, __, body) => ({ affected: await bulk(body) })],
  // Is this person already recorded? The add form asks before saving; bad input is the save's job to report.
  ['POST', /^\/residents\/match$/, async (_, __, body) => {
    const data = sanitize(body);
    return isInvalid(data) ? null : residents.findMatch(data.full_name, data.birth_year, data.id_last4);
  }],
  ['GET', /^\/residents\/(\d+)$/, async ([id]) => (await residents.find(Number(id))) ?? notFound()],
  ['PATCH', /^\/residents\/(\d+)$/, async ([id], _, body) => {
    const existing = (await residents.find(Number(id))) ?? notFound();
    const input = { ...body };
    // is_head follows relation: a stored head flag must not undo an explicit relation change.
    if ('relation' in input && !('is_head' in input)) input.is_head = input.relation === 'head';
    return residents.update(Number(id), valid(sanitize({ ...existing, ...input }, existing.phone)));
  }],
  ['DELETE', /^\/residents\/(\d+)$/, async ([id]) => (await residents.trash(Number(id))) || notFound()],
  // One person leaves their household to head a new one. The others stay as they are.
  ['POST', /^\/residents\/(\d+)\/split$/, async ([id]) =>
    transaction(async () => {
      const existing = (await residents.find(Number(id))) ?? notFound();
      if ((await residents.householdSize(existing.household_code)) < 2) {
        invalid(i18n.__('This person is not in a household with other people, so there is nothing to split.', 'quan-li-dan-cu'));
      }
      const code = await residents.nextHouseholdCode((await getSettings()).ward_code);
      return (await residents.update(existing.id, valid(sanitize({ ...existing, household_code: code, relation: 'head' }, existing.phone)))) ?? notFound();
    })],
  ['GET', /^\/households$/, async (_, query) => residents.households(query.get('search') ?? '', query.get('exclude') ?? '')],
  ['GET', /^\/settings$/, async () => getSettings()],
  ['POST', /^\/settings$/, async (_, __, body) => valid(await saveSettings(body))],
  ['GET', /^\/stats$/, async () => ({ ...(await residents.stats()), recent: await recent(RECENT) })],
  ['POST', /^\/import\/preview$/, async (_, __, body) => preview(...importArgs(body))],
  ['POST', /^\/import\/commit$/, async (_, __, body) => commit(...importArgs(body))],
  ['POST', /^\/backup$/, async () => snapshot()],
  ['GET', /^\/backup\/status$/, async () => getBackupStatus()],
  ['POST', /^\/backup\/options$/, async (_, __, body) => valid(await saveBackupOptions(body))],
  ['POST', /^\/backup\/done$/, async () => markBackedUp()],
  ['POST', /^\/backup\/warned$/, async () => markWarned()],
  ['POST', /^\/restore\/inspect$/, async (_, __, { file }) => valid(inspect(file))],
  ['POST', /^\/restore\/commit$/, async (_, __, { file }) => restore(file)],
  ['POST', /^\/restore\/undo$/, async () => undoRestore()],
  ['GET', /^\/export$/, async (_, query) => {
    // Unknown columns are dropped, so ID digits never leave the database even when asked for.
    const asked = query.getAll('columns[]');
    const keep = asked.length ? EXPORT_COLUMNS.filter((column) => asked.includes(column)) : EXPORT_COLUMNS;
    const ids = query.getAll('ids[]').map(Number);
    if (!ids.every(Number.isInteger)) invalid();
    const rows = await residents.all({ ...listFilters(query), ids: ids.length ? ids : undefined });
    const picked = rows.map((row) => Object.fromEntries(keep.map((column) => [column, row[column as keyof typeof row]])));
    return { total: picked.length, rows: picked };
  }],
];

/** Dispatches what api() used to send to the REST API. Throws ApiError like apiFetch did. */
export async function route<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const url = new URL(path, 'http://local');
  for (const [routeMethod, pattern, handler] of routes) {
    const match = routeMethod === method.toUpperCase() && url.pathname.match(pattern);
    if (match) return (await handler(match.slice(1), url.searchParams, (data ?? {}) as Json)) as T;
  }
  return fail('rest_no_route', 'No route was found matching the URL and request method.');
}

function importArgs({ rows, auto_update = true }: Json): [unknown[], boolean] {
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) invalid();
  return [rows as unknown[], auto_update !== false];
}

/** One change for many residents, all or nothing. Returns how many rows changed. */
async function bulk(body: Json): Promise<number> {
  const { ids, action, value = '' } = body;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > BULK_LIMIT || !ids.every(Number.isInteger)) invalid();
  if (!['delete', 'restore', 'purge', 'set_residence_status', 'set_health_exam', 'set_verify_status', 'add_policy_tag', 'remove_policy_tag'].includes(action as string)) invalid();

  // What to change on one resident: it can depend on the resident (adding a tag keeps the others).
  let patch: (existing: Resident) => Partial<ResidentInput> = () => ({});
  if (action === 'set_residence_status') {
    if (!RESIDENCE_STATUSES.includes(value as never)) invalid();
    patch = () => ({ residence_status: value as ResidentInput['residence_status'] });
  } else if (action === 'set_health_exam') {
    if (!YES_NO.includes(value as string)) invalid();
    // Unticking also clears the date, or the date would keep the flag on.
    patch = () => (value === 'yes' ? { health_exam: true } : { health_exam: false, exam_date: null });
  } else if (action === 'set_verify_status') {
    if (!VERIFY_STATUSES.includes(value as never)) invalid();
    patch = () => ({ verify_status: value as ResidentInput['verify_status'] });
  } else if (action === 'add_policy_tag' || action === 'remove_policy_tag') {
    if (!POLICY_TAGS.includes(value as string)) invalid();
    patch = (existing) => ({
      policy_tags: action === 'add_policy_tag' ? [...new Set([...existing.policy_tags, value as string])] : existing.policy_tags.filter((tag) => tag !== value),
    });
  }

  try {
    return await transaction(async () => {
      let count = 0;
      for (const id of new Set(ids as number[])) {
        // restore/purge act on the trash, everything else on live residents.
        const inTrash = action === 'restore' || action === 'purge';
        const existing = inTrash ? await residents.findTrashed(id) : await residents.find(id);
        if (!existing) continue;
        if (action === 'delete') await residents.trash(id);
        else if (action === 'restore') await residents.restore(id);
        else if (action === 'purge') await residents.purge(id);
        else await residents.update(id, valid(sanitize({ ...existing, ...patch(existing) }, existing.phone)));
        count++;
      }
      return count;
    });
  } catch {
    return fail('bulk_failed', i18n.__('Nothing was changed. Please try again.', 'quan-li-dan-cu'));
  }
}
