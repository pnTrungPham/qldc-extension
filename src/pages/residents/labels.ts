import type { Gender, Relation, VerifyStatus } from '@/lib/api/residents.api';
import { i18n } from '@/lib/i18n';

// Keys mirror the allowed values in Models\Resident (PHP owns them).
export const GENDER_LABELS: Record<Gender, string> = {
  '': '',
  male: i18n.__('Male', 'quan-li-dan-cu'),
  female: i18n.__('Female', 'quan-li-dan-cu'),
  other: i18n.__('Other', 'quan-li-dan-cu'),
};

export const RELATION_LABELS: Record<Relation, string> = {
  head: i18n.__('Head of household', 'quan-li-dan-cu'),
  spouse: i18n.__('Spouse', 'quan-li-dan-cu'),
  child: i18n.__('Child', 'quan-li-dan-cu'),
  parent: i18n.__('Parent', 'quan-li-dan-cu'),
  grandparent: i18n.__('Grandparent', 'quan-li-dan-cu'),
  grandchild: i18n.__('Grandchild', 'quan-li-dan-cu'),
  sibling: i18n.__('Sibling', 'quan-li-dan-cu'),
  other: i18n.__('Other', 'quan-li-dan-cu'),
};

export const VERIFY_LABELS: Record<VerifyStatus, string> = {
  unverified: i18n.__('Unverified', 'quan-li-dan-cu'),
  verified: i18n.__('Verified', 'quan-li-dan-cu'),
  expired: i18n.__('Expired', 'quan-li-dan-cu'),
  not_required: i18n.__('Not required', 'quan-li-dan-cu'),
};

export const POLICY_LABELS: Record<string, string> = {
  poor_household: i18n.__('Poor household', 'quan-li-dan-cu'),
  near_poor_household: i18n.__('Near-poor household', 'quan-li-dan-cu'),
  elderly: i18n.__('Elderly', 'quan-li-dan-cu'),
  child: i18n.__('Child', 'quan-li-dan-cu'),
  disabled: i18n.__('Person with disability', 'quan-li-dan-cu'),
  policy_family: i18n.__('Policy family', 'quan-li-dan-cu'),
};

export const SUPPORT_LABELS: Record<string, string> = {
  mobility: i18n.__('Limited mobility', 'quan-li-dan-cu'),
  evacuation: i18n.__('Needs evacuation support', 'quan-li-dan-cu'),
  basic_medical: i18n.__('Needs basic medical support', 'quan-li-dan-cu'),
};

/** 0903412885 → 0903 412 885 */
export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
}

/** 2026-03-05 → 05/03/2026 (the format the form shows and the API accepts). */
export function toDisplayDate(date: string | null): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
