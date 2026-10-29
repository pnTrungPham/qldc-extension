import type { Resident, ResidentInput, ResidentPage } from '@/lib/api/residents.api';
import type { Stats } from '@/lib/api/stats.api';
import { fold } from '@/lib/fold';

import { log } from './audit';
import { db, now, type ResidentRow } from './db';
import { POLICY_TAGS, RESIDENCE_STATUSES, SUPPORT_FLAGS } from './resident';

/**
 * Port of PLUGIN Repositories/ResidentRepository.php. Trashed rows (deleted_at set) are invisible
 * except through the trash filter, findTrashed, restore and purge.
 */

export type Filters = { trash?: boolean; search?: string; status?: string; exam?: string; phone?: string; policy?: string; household?: string };

const toResident = ({ full_name_search: _, ...row }: ResidentRow): Resident => row;

/** PHP build_where, in memory. */
function matches(filters: Filters): (row: ResidentRow) => boolean {
  const search = (filters.search ?? '').trim();
  const term = fold(search);
  const phone = search.replace(/[\s.-]/g, '');

  return (row) => {
    if (!filters.trash !== (row.deleted_at === null)) return false;
    // Address folds too: PLUGIN relied on the MySQL collation to ignore accents there.
    // A search of only punctuation must not match every phone (PHP: "phone LIKE '%%'").
    if (search && !(row.full_name_search.includes(term) || fold(row.address).includes(term) || (phone !== '' && row.phone.includes(phone)))) return false;
    if (filters.status && row.residence_status !== filters.status) return false;
    if (filters.exam && row.health_exam !== (filters.exam === 'yes')) return false;
    if (filters.household && row.household_code !== filters.household) return false;
    if (filters.policy && !row.policy_tags.includes(filters.policy)) return false;
    if (filters.phone && (row.phone !== '') !== (filters.phone === 'yes')) return false;
    return true;
  };
}

const live = () => db.residents.filter((row) => row.deleted_at === null);

/** One page of residents, newest first (or most recently trashed first with the trash filter). */
export async function paginate(page: number, perPage: number, filters: Filters): Promise<ResidentPage> {
  const rows = await db.residents.toArray();
  const found = rows.filter(matches(filters));
  found.sort(filters.trash ? (a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '') || b.id - a.id : (a, b) => b.id - a.id);

  const sizes = new Map<string, number>();
  for (const row of rows) {
    if (row.deleted_at === null && row.household_code !== '') sizes.set(row.household_code, (sizes.get(row.household_code) ?? 0) + 1);
  }

  return {
    items: found.slice((page - 1) * perPage, page * perPage).map((row) => ({ ...toResident(row), household_size: sizes.get(row.household_code) ?? 0 })),
    total: found.length,
    total_pages: Math.ceil(found.length / perPage),
    households: new Set(found.map((row) => row.household_code).filter(Boolean)).size,
    trashed: rows.filter((row) => row.deleted_at !== null).length,
  };
}

/** Every resident matching the filters, by household with the head first. For exports. */
export async function all(filters: Filters): Promise<Resident[]> {
  const found = (await db.residents.toArray()).filter(matches(filters));
  found.sort((a, b) => a.household_code.localeCompare(b.household_code) || Number(b.is_head) - Number(a.is_head) || a.id - b.id);
  return found.map(toResident);
}

export type HouseholdSummary = { code: string; head_name: string; address: string; size: number; has_head: boolean };

/**
 * Households with someone alive in them, for picking one to move a person into. `search` matches the code,
 * a member's name or an address (accents ignored); an exact code comes first, then by code.
 */
export async function households(search: string, exclude = '', limit = 20): Promise<HouseholdSummary[]> {
  const groups = new Map<string, ResidentRow[]>();
  for (const row of await live().toArray()) {
    if (row.household_code !== '' && row.household_code !== exclude) groups.set(row.household_code, [...(groups.get(row.household_code) ?? []), row]);
  }
  const term = fold(search);
  return [...groups]
    .filter(([code, rows]) => term === '' || fold(code).includes(term) || rows.some((row) => row.full_name_search.includes(term) || fold(row.address).includes(term)))
    .map(([code, rows]) => {
      const head = rows.find((row) => row.is_head) ?? rows[0];
      return { code, head_name: head.full_name, address: head.address, size: rows.length, has_head: rows.some((row) => row.is_head) };
    })
    .sort((a, b) => Number(fold(b.code) === term) - Number(fold(a.code) === term) || a.code.localeCompare(b.code))
    .slice(0, limit);
}

/** Counts for the overview page, over residents that are not in the trash. */
export async function stats(): Promise<Omit<Stats, 'recent'>> {
  const rows = await live().toArray();
  const year = new Date().getFullYear();
  const count = (test: (row: ResidentRow) => boolean) => rows.filter(test).length;
  const group = (keys: string[], test: (row: ResidentRow, key: string) => boolean) =>
    Object.fromEntries(keys.map((key) => [key, count((row) => test(row, key))]));
  const age = (test: (age: number) => boolean) => count((row) => row.birth_year !== null && test(year - row.birth_year));
  const male = count((row) => row.gender === 'male');
  const female = count((row) => row.gender === 'female');

  return {
    people: rows.length,
    households: new Set(rows.map((row) => row.household_code).filter(Boolean)).size,
    health_exam: count((row) => row.health_exam),
    residence: group(RESIDENCE_STATUSES, (row, key) => row.residence_status === key),
    age: { child: age((a) => a < 16), adult: age((a) => a >= 16 && a <= 59), senior: age((a) => a >= 60), unknown: count((row) => row.birth_year === null) },
    gender: { male, female, unknown: rows.length - male - female },
    policy: group(POLICY_TAGS, (row, key) => row.policy_tags.includes(key)),
    support: group(SUPPORT_FLAGS, (row, key) => row.support_flags.includes(key)),
    quality: {
      no_phone: count((row) => row.phone === ''),
      no_birth_year: count((row) => row.birth_year === null),
      unverified: count((row) => row.verify_status === 'unverified'),
      expired: count((row) => row.verify_status === 'expired'),
    },
  };
}

export async function find(id: number): Promise<Resident | null> {
  const row = await db.residents.get(id);
  return row && row.deleted_at === null ? toResident(row) : null;
}

/** A resident that is in the trash (find() never returns those). */
export async function findTrashed(id: number): Promise<Resident | null> {
  const row = await db.residents.get(id);
  return row && row.deleted_at !== null ? toResident(row) : null;
}

export async function create(data: ResidentInput): Promise<Resident> {
  const stamp = now();
  const id = await db.residents.add({
    ...data,
    full_name_search: fold(data.full_name),
    created_at: stamp,
    updated_at: stamp,
    created_by: 0,
    updated_by: 0,
    deleted_at: null,
  } as ResidentRow);
  await log('create', id);
  return (await find(id))!;
}

export async function update(id: number, data: ResidentInput): Promise<Resident | null> {
  const before = await find(id);
  if (!before) return null;

  const changed = (Object.keys(data) as Array<keyof ResidentInput>).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(data[key]));
  await db.residents.update(id, { ...data, full_name_search: fold(data.full_name), updated_at: now() });
  if (changed.length) await log('update', id, changed);
  return find(id);
}

/** Moves a resident to the trash. False when it does not exist or is already there. */
export async function trash(id: number): Promise<boolean> {
  if (!(await find(id))) return false;
  const stamp = now();
  await db.residents.update(id, { deleted_at: stamp, updated_at: stamp });
  await log('delete', id);
  return true;
}

/** Takes a resident out of the trash. False when it is not there. */
export async function restore(id: number): Promise<boolean> {
  if (!(await findTrashed(id))) return false;
  await db.residents.update(id, { deleted_at: null, updated_at: now() });
  await log('untrash', id);
  return true;
}

/** Deletes a trashed resident for good. Live residents are never touched. */
export async function purge(id: number): Promise<boolean> {
  if (!(await findTrashed(id))) return false;
  await db.residents.delete(id);
  await log('purge', id);
  return true;
}

/** Deletes everything in the trash for good. Returns the rows removed. */
export async function purgeAll(): Promise<number> {
  const removed = await db.residents.filter((row) => row.deleted_at !== null).delete();
  if (removed) await log('purge', 0, [`count:${removed}`]);
  return removed;
}

/**
 * The existing resident an imported row refers to: same name + last-4 ID digits, or same name + birth year.
 * Neither a name nor 4 ID digits match alone: both are shared by many people.
 */
export async function findMatch(name: string, birthYear: number | null, idLast4: string): Promise<Resident | null> {
  if (idLast4 === '' && birthYear === null) return null;
  const folded = fold(name);
  const rows = await live()
    .filter((row) => row.full_name_search === folded && ((idLast4 !== '' && row.id_last4 === idLast4) || (birthYear !== null && row.birth_year === birthYear)))
    .sortBy('id');
  return rows[0] ? toResident(rows[0]) : null;
}

/** Highest N among codes shaped "{prefix}-N", trashed rows included so a code is never reused. */
export async function maxHouseholdNumber(prefix: string): Promise<number> {
  const start = `${prefix}-`.toUpperCase();
  let max = 0;
  await db.residents.each((row) => {
    if (row.household_code.toUpperCase().startsWith(start)) max = Math.max(max, parseInt(row.household_code.slice(start.length), 10) || 0);
  });
  return max;
}

/** How many people are alive in a household. */
export async function householdSize(code: string): Promise<number> {
  return code === '' ? 0 : live().filter((row) => row.household_code === code).count();
}

/** The next free "{ward}-NNN": above every code ever used under the ward (the trash counts), and not taken. */
export async function nextHouseholdCode(ward: string): Promise<string> {
  let n = await maxHouseholdNumber(ward);
  let code: string;
  do {
    code = `${ward}-${String(++n).padStart(3, '0')}`;
  } while (await householdExists(code));
  return code;
}

export async function householdExists(code: string): Promise<boolean> {
  return (await live().filter((row) => row.household_code === code).count()) > 0;
}
