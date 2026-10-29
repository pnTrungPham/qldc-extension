import { useState } from 'react';
import { Plus } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import type { HouseholdSummary } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EnumSelect from '@/components/shared/EnumSelect';

import HouseholdPicker from '../../residents/components/HouseholdPicker';
import { GENDER_LABELS, RELATION_LABELS } from '../../residents/labels';
import { emptyRow, type PendingRow } from '../lib/targets';

type Person = { full_name: string; birth_year: string; gender: string; phone: string; relation: string; health_exam: boolean };

const blank = (relation = 'head'): Person => ({ full_name: '', birth_year: '', gender: '', phone: '', relation, health_exam: false });

/** Type a household from a paper form: one address, then one block per person. The household is new, or one already in the data. */
export default function PaperSource({ onRows, nextGroup }: { onRows: (rows: PendingRow[]) => void; nextGroup: () => string }) {
  const [address, setAddress] = useState('');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [target, setTarget] = useState<HouseholdSummary | null>(null);
  const [people, setPeople] = useState<Person[]>([blank()]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (index: number, patch: Partial<Person>) => setPeople(people.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  function chooseMode(next: 'new' | 'existing') {
    setMode(next);
    if (next === 'new') setTarget(null);
  }

  function pickHousehold(household: HouseholdSummary) {
    setTarget(household);
    if (household.address) setAddress(household.address);
    // The household already has its head: nobody on this form starts out as one.
    setPeople(people.map((p) => (p.relation === 'head' ? { ...p, relation: 'other' } : p)));
  }

  const joining = mode === 'existing' && target;
  const headClash = !!joining && target.has_head && people.some((p) => p.relation === 'head');

  function submit() {
    if (mode === 'existing' && !target) {
      return setMessage({ ok: false, text: i18n.__('Choose the household to add them to.', 'quan-li-dan-cu') });
    }
    const named = people.filter((p) => p.full_name.trim());
    if (!named.length) {
      return setMessage({ ok: false, text: i18n.__('Enter at least one full name before adding the household.', 'quan-li-dan-cu') });
    }

    const group = nextGroup();
    // A real code puts them in that household; without one the list gives the group a placeholder and a new household is made.
    onRows(named.map((p) => ({ ...emptyRow('paper', group), ...p, address: address.trim(), household_code: target?.code ?? '' })));
    setAddress('');
    setMode('new');
    setTarget(null);
    setPeople([blank()]);
    setMessage({
      ok: true,
      text: i18n.sprintf(
        /* translators: %d: number of people */
        i18n._n('Added %d person to the waiting list. You can type the next household.', 'Added %d people to the waiting list. You can type the next household.', named.length, 'quan-li-dan-cu'),
        named.length,
      ),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={mode === 'new' ? 'primary' : 'outline'} aria-pressed={mode === 'new'} onClick={() => chooseMode('new')}>
          {i18n.__('New household', 'quan-li-dan-cu')}
        </Button>
        <Button type="button" variant={mode === 'existing' ? 'primary' : 'outline'} aria-pressed={mode === 'existing'} onClick={() => chooseMode('existing')}>
          {i18n.__('Add to an existing household', 'quan-li-dan-cu')}
        </Button>
      </div>
      {mode === 'existing' && <HouseholdPicker value={target} onChange={pickHousehold} />}

      <div className="grid gap-1.5">
        <Label htmlFor="paper-address">{i18n.__('Address of the house', 'quan-li-dan-cu')}</Label>
        <Input id="paper-address" value={address} disabled={!!joining && !!target.address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      {headClash && <p className="m-0 rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">{i18n.__('This household already has a head of household.', 'quan-li-dan-cu')}</p>}

      {people.map((person, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-6">
          <Cell label={i18n.__('Full name', 'quan-li-dan-cu')} className="sm:col-span-2">
            <Input value={person.full_name} onChange={(e) => update(index, { full_name: e.target.value })} />
          </Cell>
          <Cell label={i18n.__('Year of birth', 'quan-li-dan-cu')}>
            <Input value={person.birth_year} inputMode="numeric" onChange={(e) => update(index, { birth_year: e.target.value })} />
          </Cell>
          <Cell label={i18n.__('Gender', 'quan-li-dan-cu')}>
            <EnumSelect value={person.gender} options={GENDER_LABELS} onChange={(v) => update(index, { gender: v })} allowEmpty />
          </Cell>
          <Cell label={i18n.__('Phone', 'quan-li-dan-cu')}>
            <Input value={person.phone} type="tel" onChange={(e) => update(index, { phone: e.target.value })} />
          </Cell>
          <Cell label={i18n.__('Relationship to head', 'quan-li-dan-cu')}>
            <EnumSelect value={person.relation} options={RELATION_LABELS} onChange={(v) => update(index, { relation: v })} />
          </Cell>
          <div className="flex items-center gap-4 sm:col-span-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={person.health_exam} onCheckedChange={(checked) => update(index, { health_exam: !!checked })} />
              {i18n.__('Health exam 2026 done', 'quan-li-dan-cu')}
            </label>
            {people.length > 1 && (
              <Button variant="link" className="ms-auto h-auto p-0 text-destructive" onClick={() => setPeople(people.filter((_, i) => i !== index))}>
                {i18n.__('Remove this person', 'quan-li-dan-cu')}
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setPeople([...people, blank('child')])}>
          <Plus /> {i18n.__('Add a household member', 'quan-li-dan-cu')}
        </Button>
        <Button onClick={submit}>{i18n.__('Put this household on the waiting list', 'quan-li-dan-cu')}</Button>
        {message && <span className={message.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{message.text}</span>}
      </div>
    </div>
  );
}

function Cell({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`grid content-start gap-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
