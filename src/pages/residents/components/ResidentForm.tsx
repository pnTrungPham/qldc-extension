import { useEffect, useState, type ReactNode } from 'react';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { cn } from '@/lib/utils';
import { useDetailFields, type DetailFieldId } from '@/lib/detail-fields';
import {
  useFindMatch,
  useHousehold,
  useHouseholds,
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
import { Textarea } from '@/components/ui/textarea';
import EnumSelect from '@/components/shared/EnumSelect';

import { GENDER_LABELS, POLICY_LABELS, RELATION_LABELS, SUPPORT_LABELS, VERIFY_LABELS, toDisplayDate } from '../labels';
import ChooseHouseholdDialog from './ChooseHouseholdDialog';
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

/** Starting values of a new person: the household being added to, or a whole waiting-list row being edited. */
export type AddDefaults = Partial<ResidentInput>;

function initialValues(r: Resident | null, defaults?: AddDefaults): Values {
  const src: Partial<ResidentInput> = r ?? defaults ?? {};
  return {
    household_code: src.household_code ?? '',
    full_name: src.full_name ?? '',
    birth_year: src.birth_year ? String(src.birth_year) : '',
    gender: src.gender ?? '',
    phone: src.phone ?? '',
    address: src.address ?? '',
    relation: src.relation ?? 'other',
    residence_status: src.residence_status ?? 'unknown',
    verify_status: src.verify_status ?? 'unverified',
    occupation: src.occupation ?? '',
    policy_tags: src.policy_tags ?? [],
    support_flags: src.support_flags ?? [],
    bhyt_number: src.bhyt_number ?? '',
    health_exam: src.health_exam ?? false,
    exam_date: toDisplayDate(src.exam_date ?? null),
    exam_place: src.exam_place ?? '',
    note: src.note ?? '',
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
  defaults,
  onOpenExisting,
  onDraft,
  household,
  footerStart,
  onDirtyChange,
  onSaved,
  onCancel,
}: {
  resident: Resident | null;
  /** Starting values for a new resident (the household being added to). */
  defaults?: AddDefaults;
  /** Show a person the add form found to be a duplicate. */
  onOpenExisting?: (match: Resident) => void;
  /** A saved resident's household: its menu next to the Household section title, and the list of its members at the top of the form. */
  household?: { actions?: ReactNode; list?: ReactNode };
  /** Editing a draft (a waiting-list row): Save hands the values back here and nothing is written. */
  onDraft?: (input: Partial<ResidentInput>) => void;
  /** Rendered at the left of the footer (the drawer's Delete button). */
  footerStart?: ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: (saved: Resident) => void;
  onCancel: () => void;
}) {
  const save = useSaveResident();
  const find = useFindMatch();
  const [choosing, setChoosing] = useState(false);
  // Fields the user hid in Settings: not drawn, but they keep whatever value they have.
  const [shownFields] = useDetailFields();
  const shown = (...ids: DetailFieldId[]) => ids.some((id) => shownFields.includes(id));
  // The person the last save attempt found already recorded, for the name and year it was asked about.
  const [duplicate, setDuplicate] = useState<{ key: string; match: Resident } | null>(null);
  const [initial, setInitial] = useState(() => initialValues(resident, defaults));
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

  // A code typed here that no household has yet would start a new household: say so, so a typo is noticed.
  const typedCode = values.household_code.trim().toUpperCase();
  const lookup = useHouseholds(typedCode, '');
  // While the answer for the code just typed is loading, the previous one is on screen: do not judge by it.
  const known = lookup.isPlaceholderData ? undefined : lookup.data;
  const newCode = typedCode !== '' && typedCode !== initial.household_code.toUpperCase() && known !== undefined && !known.some((h) => h.code === typedCode);

  const personKey = `${values.full_name.trim()}|${values.birth_year}`;

  function write() {
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

  /** Adding someone: first ask whether they are already recorded, and let the user decide. */
  /** The person is already recorded elsewhere: bring them into this household instead of adding a copy. */
  function move(match: Resident) {
    save.mutate(
      { id: match.id, data: { household_code: values.household_code, address: values.address, relation: values.relation } },
      { onSuccess: onSaved },
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onDraft) return onDraft(toInput(values));
    if (resident) return write();
    find.mutate(toInput(values), { onSuccess: (match) => (match ? setDuplicate({ key: personKey, match }) : write()) });
  }

  return (
    // flex-1 + mt-auto on the footer: a short form still puts Save at the bottom of the drawer, not under the last field.
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5">
      {/* First thing in the drawer: who else is in the household, and the way to jump to them. */}
      {household?.list}
      <Section title={i18n.__('Personal information', 'quan-li-dan-cu')}>
        <Field label={i18n.__('Full name', 'quan-li-dan-cu')} htmlFor="full_name" className="sm:col-span-2">
          <Input {...text('full_name')} required minLength={2} maxLength={120} />
        </Field>
        <Field label={i18n.__('Year of birth', 'quan-li-dan-cu')} htmlFor="birth_year">
          <Input {...text('birth_year')} type="number" min={1900} max={new Date().getFullYear()} />
        </Field>
        {shown('gender') && (
          <Field label={i18n.__('Gender', 'quan-li-dan-cu')}>
            <EnumSelect value={values.gender} options={GENDER_LABELS} disabled={readOnly} onChange={(v) => set('gender', v as Gender)} allowEmpty />
          </Field>
        )}
        {shown('phone') && (
          <Field label={i18n.__('Phone', 'quan-li-dan-cu')} htmlFor="phone">
            <Input {...text('phone')} type="tel" inputMode="tel" />
          </Field>
        )}
        {shown('occupation') && (
          <Field label={i18n.__('Occupation', 'quan-li-dan-cu')} htmlFor="occupation">
            <Input {...text('occupation')} maxLength={120} />
          </Field>
        )}
      </Section>

      <Section
        title={i18n.__('Household', 'quan-li-dan-cu')}
        actions={
          household?.actions ??
          (onDraft && !readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => setChoosing(true)}>
              {i18n.__('Choose an existing household', 'quan-li-dan-cu')}
            </Button>
          ))
        }
      >
        <Field label={i18n.__('Household code', 'quan-li-dan-cu')} htmlFor="household_code">
          <Input {...text('household_code')} maxLength={32} />
          {newCode && !onDraft && <p className="m-0 text-xs text-muted-foreground">{i18n.__('New household code: no household has it yet.', 'quan-li-dan-cu')}</p>}
        </Field>
        <Field label={i18n.__('Relationship to head', 'quan-li-dan-cu')}>
          <EnumSelect value={values.relation} options={RELATION_LABELS} disabled={readOnly} onChange={(v) => set('relation', v as Relation)} />
        </Field>
        <Field label={i18n.__('Address', 'quan-li-dan-cu')} htmlFor="address" className="sm:col-span-2">
          <Input {...text('address')} maxLength={255} />
        </Field>
      </Section>

      <Section title={i18n.__('Residence and documents', 'quan-li-dan-cu')} hidden={!shown('residence_status', 'verify_status')}>
        {shown('residence_status') && (
          <Field label={i18n.__('Residence status', 'quan-li-dan-cu')}>
            <EnumSelect value={values.residence_status} options={RESIDENCE_STATUS_LABELS} disabled={readOnly} onChange={(v) => set('residence_status', v as ResidenceStatus)} />
          </Field>
        )}
        {shown('verify_status') && (
          <Field label={i18n.__('Document verification', 'quan-li-dan-cu')}>
            <EnumSelect value={values.verify_status} options={VERIFY_LABELS} disabled={readOnly} onChange={(v) => set('verify_status', v as VerifyStatus)} />
          </Field>
        )}
      </Section>

      <Section title={i18n.__('Policy and support', 'quan-li-dan-cu')} single hidden={!shown('policy_tags', 'support_flags')}>
        {shown('policy_tags') && (
          <ChipGroup label={i18n.__('Policy labels', 'quan-li-dan-cu')} options={POLICY_LABELS} value={values.policy_tags} disabled={readOnly} onChange={(v) => set('policy_tags', v)} />
        )}
        {shown('support_flags') && (
          <ChipGroup label={i18n.__('Field support flags', 'quan-li-dan-cu')} options={SUPPORT_LABELS} value={values.support_flags} disabled={readOnly} onChange={(v) => set('support_flags', v)} />
        )}
      </Section>

      <Section title={i18n.__('Health', 'quan-li-dan-cu')} hidden={!shown('bhyt_number', 'health_exam', 'exam_date', 'exam_place')}>
        {shown('bhyt_number') && (
          <Field label={i18n.__('Health insurance (BHYT) number', 'quan-li-dan-cu')} htmlFor="bhyt_number" className="sm:col-span-2">
            <Input {...text('bhyt_number')} maxLength={20} />
          </Field>
        )}
        {shown('health_exam') && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={values.health_exam} disabled={readOnly || !!values.exam_date} onCheckedChange={(checked) => set('health_exam', !!checked)} />
            {i18n.__('Health exam 2026 done', 'quan-li-dan-cu')}
          </label>
        )}
        {shown('exam_date') && (
          <Field label={i18n.__('Examination date', 'quan-li-dan-cu')} htmlFor="exam_date">
            <Input
              {...text('exam_date')}
              placeholder="dd/mm/yyyy"
              pattern="\d{2}/\d{2}/\d{4}"
              onChange={(e) => setValues((prev) => ({ ...prev, exam_date: e.target.value, health_exam: prev.health_exam || !!e.target.value }))}
            />
          </Field>
        )}
        {shown('exam_place') && (
          <Field label={i18n.__('Examination place', 'quan-li-dan-cu')} htmlFor="exam_place">
            <Input {...text('exam_place')} maxLength={255} />
          </Field>
        )}
      </Section>

      <Section title={i18n.__('Situation notes', 'quan-li-dan-cu')} single hidden={!shown('note')}>
        <Textarea {...text('note')} rows={3} aria-label={i18n.__('Situation notes', 'quan-li-dan-cu')} />
      </Section>

      {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}
      {choosing && (
        <ChooseHouseholdDialog
          onClose={() => setChoosing(false)}
          onPick={(household) => {
            // Same household, same house: the address follows unless the household has none on record.
            setValues((prev) => ({ ...prev, household_code: household.code, address: household.address || prev.address }));
            setChoosing(false);
          }}
        />
      )}
      {duplicate?.key === personKey && (
        <DuplicateWarning
          match={duplicate.match}
          sameHousehold={duplicate.match.household_code !== '' && duplicate.match.household_code === values.household_code}
          canMove={values.household_code !== ''}
          busy={save.isPending}
          onView={() => onOpenExisting?.(duplicate.match)}
          onAddAnyway={write}
          onMove={() => move(duplicate.match)}
        />
      )}

      {!readOnly && (
        <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t bg-background py-3">
          {footerStart}
          <div className="ms-auto flex items-center gap-2">
            {save.isSuccess && !dirty && <span className="text-sm text-success">✓ {i18n.__('Saved', 'quan-li-dan-cu')}</span>}
            <Button type="button" variant="outline" onClick={onCancel}>
              {i18n.__('Cancel', 'quan-li-dan-cu')}
            </Button>
            <Button type="submit" disabled={save.isPending || find.isPending}>
              {save.isPending || find.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : onDraft ? i18n.__('Update this row', 'quan-li-dan-cu') : i18n.__('Save', 'quan-li-dan-cu')}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

/** The add form found someone with the same name and birth year: show who, and where they live. */
function DuplicateWarning({
  match,
  sameHousehold,
  canMove,
  busy,
  onView,
  onAddAnyway,
  onMove,
}: {
  match: Resident;
  sameHousehold: boolean;
  /** The form has a household to move the person into. */
  canMove: boolean;
  busy: boolean;
  onView: () => void;
  onAddAnyway: () => void;
  onMove: () => void;
}) {
  const [confirmingMove, setConfirmingMove] = useState(false);
  const oldHousehold = useHousehold(sameHousehold ? '' : match.household_code).data;
  // Moving the head out of a household that still has other people leaves it without a head.
  const leavesNoHead = match.is_head && (oldHousehold?.total ?? 0) > 1;
  const who = [match.birth_year ? `${match.full_name} (${match.birth_year})` : match.full_name, match.address].filter(Boolean).join(' · ');
  return (
    <div className="grid gap-2 rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">
      <div className="font-medium">{i18n.__('This person may already be recorded', 'quan-li-dan-cu')}</div>
      <div>
        {sameHousehold
          ? i18n.sprintf(
              /* translators: %s: the person's name, year of birth and address */
              i18n.__('Already in this household: %s.', 'quan-li-dan-cu'),
              who,
            )
          : i18n.sprintf(
              /* translators: 1: household code, 2: the person's name, year of birth and address */
              i18n.__('Already in household %1$s: %2$s.', 'quan-li-dan-cu'),
              match.household_code || '—',
              who,
            )}
      </div>
      {confirmingMove && (
        <div>
          {i18n.sprintf(
            /* translators: %s: household code */
            i18n.__('Household %s will be left without a head of household.', 'quan-li-dan-cu'),
            match.household_code,
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {confirmingMove ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmingMove(false)}>
              {i18n.__('Cancel', 'quan-li-dan-cu')}
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={onMove}>
              {i18n.__('Move', 'quan-li-dan-cu')}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onView}>
              {i18n.__('View', 'quan-li-dan-cu')}
            </Button>
            {canMove && !sameHousehold && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || (match.is_head && !oldHousehold)} // a head's old household must be known first
                onClick={() => (leavesNoHead ? setConfirmingMove(true) : onMove())}
              >
                {i18n.__('Move to this household', 'quan-li-dan-cu')}
              </Button>
            )}
            <Button type="button" size="sm" disabled={busy} onClick={onAddAnyway}>
              {i18n.__('Add anyway', 'quan-li-dan-cu')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** A titled group of fields: two columns, or one block when `single`. Groups are told apart by a rule above them. `hidden`: every field in it is switched off. */
function Section({ title, actions, single, hidden, children }: { title: string; actions?: ReactNode; single?: boolean; hidden?: boolean; children: ReactNode }) {
  if (hidden) return null;
  return (
    <section className="grid gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        {actions}
      </div>
      <div className={single ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'}>{children}</div>
    </section>
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
