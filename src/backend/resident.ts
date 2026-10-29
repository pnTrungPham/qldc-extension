import type { Gender, Relation, ResidenceStatus, ResidentInput, VerifyStatus } from '@/lib/api/residents.api';
import { i18n } from '@/lib/i18n';

/** Port of PLUGIN Models/Resident.php: allowed values and input normalizing. */

export const GENDERS: Gender[] = ['', 'male', 'female', 'other'];
export const RELATIONS: Relation[] = ['head', 'spouse', 'child', 'parent', 'grandparent', 'grandchild', 'sibling', 'other'];
export const RESIDENCE_STATUSES: ResidenceStatus[] = ['permanent', 'temporary', 'absent', 'moved', 'unknown'];
export const VERIFY_STATUSES: VerifyStatus[] = ['unverified', 'verified', 'expired', 'not_required'];
export const POLICY_TAGS = ['poor_household', 'near_poor_household', 'elderly', 'child', 'disabled', 'policy_family'];
export const SUPPORT_FLAGS = ['mobility', 'evacuation', 'basic_medical'];

/** Columns an export may include. Deliberately has no id_last4: ID digits never leave the database. */
export const EXPORT_COLUMNS = [
  'full_name', 'birth_year', 'phone', 'bhyt_number', 'health_exam', 'exam_date', 'exam_place', 'residence_status',
  'is_head', 'relation', 'household_code', 'address', 'occupation', 'policy_tags', 'note',
];

export type Invalid = { error: string };

export const isInvalid = (x: unknown): x is Invalid => typeof x === 'object' && x !== null && 'error' in x;

/** A Vietnamese number: a 10-digit mobile (03, 05, 07, 08, 09) or an 11-digit landline (02 + area code). */
const isPhone = (phone: string) => /^0[35789]\d{8}$/.test(phone) || /^02\d{9}$/.test(phone);

/** The rule before mobile prefixes and landlines were told apart. Stored numbers and backups may still follow it. */
export const isOldPhone = (phone: string) => /^0\d{9}$/.test(phone);

/**
 * Cleans user input into column values, or returns the first validation error.
 * `keepPhone` is a number already stored for this person: it passes unchanged, so an old number never blocks
 * moving, bulk-changing or updating them. Only a number that is new or different is checked.
 */
export function sanitize(input: Record<string, unknown>, keepPhone?: string): ResidentInput | Invalid {
  const full_name = textField(String(input.full_name ?? ''));
  const length = [...full_name].length;
  if (length < 2 || length > 120) {
    return { error: i18n.__('Full name must be 2–120 characters.', 'quan-li-dan-cu') };
  }

  const phone = normalizePhone(String(input.phone ?? ''));
  if (phone !== '' && phone !== keepPhone && !isPhone(phone)) {
    return { error: i18n.__('Invalid phone number. Use a 10-digit mobile number (03, 05, 07, 08, 09) or an 11-digit landline starting with 02.', 'quan-li-dan-cu') };
  }

  const birth_year = parseYear(input.birth_year ?? '');
  if (birth_year === false) {
    return { error: i18n.__('Invalid year of birth.', 'quan-li-dan-cu') };
  }

  const exam_date = parseDate(String(input.exam_date ?? ''));
  if (exam_date === false) {
    return { error: i18n.__('Invalid examination date.', 'quan-li-dan-cu') };
  }

  const id_last4 = last4(String(input.id_last4 ?? ''));
  if (id_last4 === false) {
    return { error: i18n.__('ID number must be 4, 9 or 12 digits; only the last 4 are kept.', 'quan-li-dan-cu') };
  }

  const relation = pick(input.relation, RELATIONS, 'other');
  const is_head = !!input.is_head || relation === 'head';

  return {
    household_code: text(input.household_code, 32).toUpperCase(),
    full_name,
    birth_year,
    gender: pick(input.gender, GENDERS, ''),
    phone,
    address: text(input.address, 255),
    relation: is_head ? 'head' : relation,
    is_head,
    residence_status: pick(input.residence_status, RESIDENCE_STATUSES, 'unknown'),
    verify_status: pick(input.verify_status, VERIFY_STATUSES, 'unverified'),
    occupation: text(input.occupation, 120),
    policy_tags: intersect(POLICY_TAGS, input.policy_tags),
    support_flags: intersect(SUPPORT_FLAGS, input.support_flags),
    id_last4,
    bhyt_number: text(input.bhyt_number, 20),
    health_exam: !!input.health_exam || exam_date !== null,
    exam_date,
    exam_place: text(input.exam_place, 255),
    note: textField(String(input.note ?? ''), true),
  };
}

/**
 * WordPress sanitize_text_field / sanitize_textarea_field: strip tags and %-encoded octets; the single-line
 * variant also collapses whitespace. Unlike WP, a stray `<` is kept as is (React escapes it on render).
 */
export function textField(value: string, keepNewlines = false): string {
  let filtered = value
    .replace(/<(script|style)[^>]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/%[a-f0-9]{2}/gi, '');
  if (!keepNewlines) filtered = filtered.replace(/[\r\n\t ]+/g, ' ');
  return filtered.trim();
}

/** Sanitized single-line text, cut to the column length so an oversized import cell cannot fail the insert. */
function text(value: unknown, max: number): string {
  return [...textField(String(value ?? ''))].slice(0, max).join('');
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** array_intersect order: the allowed list's order, only values present in the input. */
function intersect(allowed: string[], value: unknown): string[] {
  const given = Array.isArray(value) ? value : value == null ? [] : [value];
  return allowed.filter((item) => given.includes(item));
}

/** Strips separators and turns a leading +84 / 84 into 0. */
function normalizePhone(phone: string): string {
  phone = phone.replace(/[\s.-]/g, '');
  const m = phone.match(/^\+?84(\d{9,10})$/);
  return m ? '0' + m[1] : phone;
}

/** Year, null when empty, false when invalid. */
function parseYear(raw: unknown): number | null | false {
  let value = String(raw).trim();
  if (value === '') return null;
  const m = value.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/) ?? value.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (m) value = m[1];
  if (!/^\d+$/.test(value)) return false;
  const year = Number(value);
  return year >= 1900 && year <= new Date().getFullYear() ? year : false;
}

/** Accepts dd/mm/yyyy or yyyy-mm-dd, and the date must exist. Y-m-d, null when empty, false when invalid. */
function parseDate(raw: string): string | null | false {
  const value = raw.trim();
  if (value === '') return null;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const [y, mo, d] = m ? [m[3], m[2], m[1]] : (value.match(/^(\d{4})-(\d{2})-(\d{2})$/)?.slice(1) ?? []);
  if (!y) return false;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const iso = `${y}-${mo}-${d}`;
  return date.toISOString().slice(0, 10) === iso ? iso : false;
}

/** Keeps only the last 4 digits of a 9/12-digit ID so the full number is never stored. */
function last4(value: string): string | false {
  const digits = value.replace(/\D/g, '');
  if (digits === '') return '';
  return [4, 9, 12].includes(digits.length) ? digits.slice(-4) : false;
}
