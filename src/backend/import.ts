import type { ApiError } from '@/lib/api/client';
import type { ImportPreview, ImportResult } from '@/lib/api/import.api';
import type { ResidentInput } from '@/lib/api/residents.api';
import { fold } from '@/lib/fold';
import { i18n } from '@/lib/i18n';

import { log } from './audit';
import { transaction } from './db';
import { isInvalid, RELATIONS, sanitize } from './resident';
import * as residents from './residents';
import { getSettings } from './settings';

/** Port of PLUGIN Services/ImportService.php: normalizes rows, matches existing people, assigns household codes. */

export const MAX_ROWS = 5000;

/** Keys the browser may send; anything else is dropped. */
const FIELDS = [
  'full_name', 'birth_year', 'gender', 'phone', 'address', 'household_code', 'relation', 'id_last4', 'note', 'health_exam',
  // From the waiting-list drawer. They only matter for a person who is new: an existing one is updated by phone and address.
  'residence_status', 'verify_status', 'occupation', 'bhyt_number', 'exam_date', 'exam_place', 'policy_tags', 'support_flags',
];

/** Placeholder household codes the browser invents (VB = file/paste, PB = paper form). */
const TEMP_CODE = /^(VB|PB)-\d+$/i;

type Prepared = ResidentInput | { error: string; missingName: boolean };

/** Dry run: what each row would become, without writing. */
export async function preview(rows: unknown[], autoUpdate: boolean): Promise<ImportPreview> {
  const out: ImportPreview = { rows: [], will_add: 0, will_update: 0, invalid: 0 };
  for (const [index, raw] of rows.entries()) {
    const data = prepare(raw);
    if ('error' in data) {
      out.invalid++;
      out.rows.push({ index, missing_name: data.missingName, error: data.error, will_update: false, joins_household: false });
      continue;
    }
    const willUpdate = autoUpdate && (await residents.findMatch(data.full_name, data.birth_year, data.id_last4)) !== null;
    out[willUpdate ? 'will_update' : 'will_add']++;
    const code = data.household_code;
    const joins = !willUpdate && code !== '' && !TEMP_CODE.test(code) && (await residents.householdExists(code));
    out.rows.push({ index, missing_name: false, error: null, will_update: willUpdate, joins_household: joins });
  }
  return out;
}

/** Writes the rows in one transaction: all of them, or none. */
export async function commit(rows: unknown[], autoUpdate: boolean): Promise<ImportResult> {
  let result: ImportResult;
  try {
    result = await transaction(() => write(rows, autoUpdate));
  } catch {
    throw { code: 'import_failed', message: i18n.__('Nothing was written. Please try again.', 'quan-li-dan-cu') } satisfies ApiError;
  }
  await log('import', 0, [`added:${result.added_people}`, `updated:${result.updated}`]);
  return result;
}

async function write(rows: unknown[], autoUpdate: boolean): Promise<ImportResult> {
  const counts: ImportResult = { added_people: 0, added_households: 0, updated: 0, skipped: 0 };
  const ward = (await getSettings()).ward_code;
  let next = await residents.maxHouseholdNumber(ward);
  const codes = new Map<string, string>(); // placeholder (or row-unique) key → official code
  const created = new Set<string>(); // real codes already counted as new households

  for (const [index, raw] of rows.entries()) {
    const data = prepare(raw);
    if ('error' in data) {
      counts.skipped++;
      continue;
    }

    const match = autoUpdate ? await residents.findMatch(data.full_name, data.birth_year, data.id_last4) : null;
    if (match) {
      const patch = Object.fromEntries(
        (['phone', 'address'] as const).filter((key) => data[key] !== '' && data[key] !== match[key]).map((key) => [key, data[key]]),
      );
      if (Object.keys(patch).length) {
        await residents.update(match.id, { ...(sanitize(match, match.phone) as ResidentInput), ...patch });
        counts.updated++;
      } else {
        counts.skipped++;
      }
      continue;
    }

    const code = data.household_code;
    if (code === '' || TEMP_CODE.test(code)) {
      const key = code === '' ? `row-${index}` : code.toUpperCase();
      if (!codes.has(key)) {
        // Skip numbers an explicit code in this batch (or an existing household) already took.
        let official: string;
        do {
          official = `${ward}-${String(++next).padStart(3, '0')}`;
        } while (created.has(official) || (await residents.householdExists(official)));
        created.add(official);
        codes.set(key, official);
        counts.added_households++;
      }
      data.household_code = codes.get(key)!;
    } else if (!created.has(code) && !(await residents.householdExists(code))) {
      created.add(code);
      counts.added_households++;
    }
    await residents.create(data);
    counts.added_people++;
  }
  return counts;
}

/** Sanitized resident columns, or why the row cannot be imported. */
function prepare(raw: unknown): Prepared {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // PHP casts scalars to trimmed strings: true → '1', false → ''.
  const input: Record<string, unknown> = Object.fromEntries(
    FIELDS.filter((key) => key in source).map((key) => {
      const value = source[key];
      // The two tag lists stay lists; sanitize keeps only the tags it knows.
      if (Array.isArray(value)) return [key, value.filter((item) => typeof item === 'string')];
      return [key, typeof value === 'boolean' ? (value ? '1' : '') : ['string', 'number'].includes(typeof value) ? String(value).trim() : ''];
    }),
  );
  if (((input.full_name as string) ?? '') === '') {
    return { error: i18n.__('Full name is missing.', 'quan-li-dan-cu'), missingName: true };
  }
  input.gender = gender((input.gender as string) ?? '');
  input.relation = relation((input.relation as string) ?? '');
  const data = sanitize(input);
  return isInvalid(data) ? { error: data.error, missingName: false } : data;
}

/** "Nam" / "Nữ" / "male" … → stored code ('' when blank). The waiting list shows rows through the same rule. */
export function gender(text: string): string {
  const key = fold(text);
  if (key === '') return '';
  if (['nam', 'male', 'm'].includes(key)) return 'male';
  return ['nu', 'female', 'f'].includes(key) ? 'female' : 'other';
}

/** "Chủ hộ" / "Vợ" / "Con" … → stored code. */
export function relation(text: string): string {
  const key = fold(text);
  if ((RELATIONS as string[]).includes(key)) return key;
  const words: Array<[string, RegExp]> = [
    ['head', /^chu ho/],
    ['spouse', /^(vo|chong)/],
    ['child', /^con\b/],
    ['parent', /^(cha|me|bo|ma)\b/],
    ['grandparent', /^(ong|ba)\b/],
    ['grandchild', /^chau/],
    ['sibling', /^(anh|chi|em)\b/],
  ];
  return words.find(([, pattern]) => pattern.test(key))?.[0] ?? 'other';
}
