import { useEffect, useState, type ReactNode } from 'react';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { cn } from '@/lib/utils';
import {
  useSaveResident,
  type Gender,
  type Relation,
  type Resident,
  type ResidentInput,
  type ResidenceStatus,
  type VerifyStatus,
} from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import EnumSelect from '@/components/shared/EnumSelect';

import { GENDER_LABELS, POLICY_LABELS, RELATION_LABELS, SUPPORT_LABELS, VERIFY_LABELS, toDisplayDate } from '../labels';
import { RESIDENCE_STATUS_LABELS } from './ResidenceStatusBadge';

type Values = {
  household_code: string;
  full_name: string;
  birth_year: string;
  gender: Gender;
  phone: string;
  address: string;
  relation: Relation;
  residence_status: ResidenceStatus;
  verify_status: VerifyStatus;
  occupation: string;
  policy_tags: string[];
  support_flags: string[];
  bhyt_number: string;
  health_exam: boolean;
  exam_date: string;
  exam_place: string;
  note: string;
};

function initialValues(r: Resident | null): Values {
  return {
    household_code: r?.household_code ?? '',
    full_name: r?.full_name ?? '',
    birth_year: r?.birth_year ? String(r.birth_year) : '',
    gender: r?.gender ?? '',
    phone: r?.phone ?? '',
    address: r?.address ?? '',
    relation: r?.relation ?? 'other',
    residence_status: r?.residence_status ?? 'unknown',
    verify_status: r?.verify_status ?? 'unverified',
    occupation: r?.occupation ?? '',
    policy_tags: r?.policy_tags ?? [],
    support_flags: r?.support_flags ?? [],
    bhyt_number: r?.bhyt_number ?? '',
    health_exam: r?.health_exam ?? false,
    exam_date: toDisplayDate(r?.exam_date ?? null),
    exam_place: r?.exam_place ?? '',
    note: r?.note ?? '',
  };
}

function toInput(v: Values): Partial<ResidentInput> {
  return {
    ...v,
    birth_year: v.birth_year ? Number(v.birth_year) : null,
    exam_date: v.exam_date || null,
  };
}

/**
 * Add (resident = null) or edit form. Read-only without the edit capability.
 * Mounted per resident (key it), so state resets when the target changes.
 */
export default function ResidentForm({
  resident,
  footerStart,
  onDirtyChange,
  onSaved,
  onCancel,
  warning,
}: {
  resident: Resident | null;
  /** Rendered at the left of the footer (the drawer's Delete button). */
  footerStart?: ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: (saved: Resident) => void;
  onCancel: () => void;
  /** Banner above the footer, e.g. the unsaved-changes confirmation. */
  warning?: ReactNode;
}) {
  const save = useSaveResident();
  const [initial, setInitial] = useState(() => initialValues(resident));
  const [values, setValues] = useState(initial);
  const readOnly = !caps.edit;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const text = (key: keyof Values & string) => ({
    id: key,
    value: values[key] as string,
    disabled: readOnly,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate(
      { id: resident?.id, data: toInput(values) },
      {
        onSuccess: (saved) => {
          const next = initialValues(saved);
          setInitial(next);
          setValues(next);
          onSaved(saved);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={i18n.__('Full name', 'quan-li-dan-cu')} htmlFor="full_name" className="sm:col-span-2">
          <Input {...text('full_name')} required minLength={2} maxLength={120} />
        </Field>
        <Field label={i18n.__('Year of birth', 'quan-li-dan-cu')} htmlFor="birth_year">
          <Input {...text('birth_year')} type="number" min={1900} max={new Date().getFullYear()} />
        </Field>
        <Field label={i18n.__('Gender', 'quan-li-dan-cu')}>
          <EnumSelect value={values.gender} options={GENDER_LABELS} disabled={readOnly} onChange={(v) => set('gender', v as Gender)} allowEmpty />
        </Field>
        <Field label={i18n.__('Phone', 'quan-li-dan-cu')} htmlFor="phone">
          <Input {...text('phone')} type="tel" inputMode="tel" />
        </Field>
        <Field label={i18n.__('Household code', 'quan-li-dan-cu')} htmlFor="household_code">
          <Input {...text('household_code')} maxLength={32} />
        </Field>
        <Field label={i18n.__('Address', 'quan-li-dan-cu')} htmlFor="address" className="sm:col-span-2">
          <Input {...text('address')} maxLength={255} />
        </Field>
        <Field label={i18n.__('Relationship to head', 'quan-li-dan-cu')}>
          <EnumSelect value={values.relation} options={RELATION_LABELS} disabled={readOnly} onChange={(v) => set('relation', v as Relation)} />
        </Field>
        <Field label={i18n.__('Residence status', 'quan-li-dan-cu')}>
          <EnumSelect value={values.residence_status} options={RESIDENCE_STATUS_LABELS} disabled={readOnly} onChange={(v) => set('residence_status', v as ResidenceStatus)} />
        </Field>
        <Field label={i18n.__('Document verification', 'quan-li-dan-cu')}>
          <EnumSelect value={values.verify_status} options={VERIFY_LABELS} disabled={readOnly} onChange={(v) => set('verify_status', v as VerifyStatus)} />
        </Field>
        <Field label={i18n.__('Occupation', 'quan-li-dan-cu')} htmlFor="occupation">
          <Input {...text('occupation')} maxLength={120} />
        </Field>
      </div>

      <ChipGroup label={i18n.__('Policy labels', 'quan-li-dan-cu')} options={POLICY_LABELS} value={values.policy_tags} disabled={readOnly} onChange={(v) => set('policy_tags', v)} />
      <ChipGroup label={i18n.__('Field support flags', 'quan-li-dan-cu')} options={SUPPORT_LABELS} value={values.support_flags} disabled={readOnly} onChange={(v) => set('support_flags', v)} />

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={i18n.__('Health insurance (BHYT) number', 'quan-li-dan-cu')} htmlFor="bhyt_number">
          <Input {...text('bhyt_number')} maxLength={20} />
        </Field>
        <Field label={i18n.__('Examination date', 'quan-li-dan-cu')} htmlFor="exam_date">
          <Input
            {...text('exam_date')}
            placeholder="dd/mm/yyyy"
            pattern="\d{2}/\d{2}/\d{4}"
            onChange={(e) => setValues((prev) => ({ ...prev, exam_date: e.target.value, health_exam: prev.health_exam || !!e.target.value }))}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox checked={values.health_exam} disabled={readOnly || !!values.exam_date} onCheckedChange={(checked) => set('health_exam', !!checked)} />
          {i18n.__('Health exam 2026 done', 'quan-li-dan-cu')}
        </label>
        <Field label={i18n.__('Examination place', 'quan-li-dan-cu')} htmlFor="exam_place" className="sm:col-span-2">
          <Input {...text('exam_place')} maxLength={255} />
        </Field>
        <Field label={i18n.__('Situation notes', 'quan-li-dan-cu')} htmlFor="note" className="sm:col-span-2">
          <Textarea {...text('note')} rows={3} />
        </Field>
      </div>

      {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}
      {warning}

      {!readOnly && (
        <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background py-3">
          {footerStart}
          <div className="ms-auto flex items-center gap-2">
            {save.isSuccess && !dirty && <span className="text-sm text-success">✓ {i18n.__('Saved', 'quan-li-dan-cu')}</span>}
            <Button type="button" variant="outline" onClick={onCancel}>
              {i18n.__('Cancel', 'quan-li-dan-cu')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Save', 'quan-li-dan-cu')}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Record<string, string>;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([key, text]) => {
          const on = value.includes(key);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== key) : [...value, key])}
              className={cn(
                'h-7 cursor-pointer rounded-full border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                on ? 'border-primary bg-primary/6 text-primary' : 'text-muted-foreground-600 hover:border-primary',
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
