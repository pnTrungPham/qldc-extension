import { useState } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import type { Resident } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { RELATION_LABELS, formatPhone } from '../labels';

// Only these fields can ever be shared: never ID, insurance, health, notes or policy labels.
const FIELDS: Array<{ key: string; label: string; on: boolean; value: (r: Resident) => string }> = [
  { key: 'full_name', label: i18n.__('Full name', 'quan-li-dan-cu'), on: true, value: (r) => r.full_name },
  { key: 'address', label: i18n.__('Address', 'quan-li-dan-cu'), on: true, value: (r) => r.address },
  { key: 'phone', label: i18n.__('Phone', 'quan-li-dan-cu'), on: true, value: (r) => formatPhone(r.phone) },
  { key: 'birth_year', label: i18n.__('Year of birth', 'quan-li-dan-cu'), on: false, value: (r) => (r.birth_year ? String(r.birth_year) : '') },
  { key: 'relation', label: i18n.__('Relationship to head', 'quan-li-dan-cu'), on: false, value: (r) => RELATION_LABELS[r.relation] },
  { key: 'household_code', label: i18n.__('Household code', 'quan-li-dan-cu'), on: false, value: (r) => r.household_code },
];

/** Copies the chosen fields as "Label: value" lines, ready to paste into a chat. */
export default function ShareDialog({ resident, onClose }: { resident: Resident; onClose: () => void }) {
  const [picked, setPicked] = useState(() => FIELDS.filter((f) => f.on).map((f) => f.key));

  const text = FIELDS.filter((f) => picked.includes(f.key))
    .map((f) => `${f.label}: ${f.value(resident) || i18n.__('Not updated', 'quan-li-dan-cu')}`)
    .join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(i18n.__('Copied. Open your chat app, long-press the message box and choose Paste.', 'quan-li-dan-cu'));
      onClose();
    } catch {
      toast.error(i18n.__('Could not copy. Select the text above and copy it by hand.', 'quan-li-dan-cu'));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{i18n.__('Share resident information', 'quan-li-dan-cu')}</DialogTitle>
          <DialogDescription>
            {i18n.__('Only the ticked fields are sent. ID, health and internal notes are never included.', 'quan-li-dan-cu')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={picked.includes(f.key)}
                onCheckedChange={(checked) => setPicked(checked ? [...picked, f.key] : picked.filter((k) => k !== f.key))}
              />
              {f.label}
            </label>
          ))}
        </div>
        <pre className="min-h-16 rounded-md border bg-muted-400 p-3 text-sm whitespace-pre-wrap">{text}</pre>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button onClick={copy} disabled={!picked.length}>
            {i18n.__('Confirm share', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
