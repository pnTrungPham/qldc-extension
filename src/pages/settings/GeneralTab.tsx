import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useSaveSettings, useSettings } from '@/lib/api/settings.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Edit the ward code and name. The server validates; its message is shown under the form. */
export default function GeneralTab() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [code, setCode] = useState(settings.ward_code);
  const [name, setName] = useState(settings.ward_name);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ ward_code: code, ward_name: name }, { onSuccess: () => toast.success(i18n.__('Ward name saved', 'quan-li-dan-cu')) });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ward_code">{i18n.__('Ward code', 'quan-li-dan-cu')}</Label>
        <Input id="ward_code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} className="font-mono" />
        <p className="text-xs text-muted-foreground">{i18n.__('2–12 characters: letters without accents, digits and hyphens.', 'quan-li-dan-cu')}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ward_name">{i18n.__('Ward name', 'quan-li-dan-cu')}</Label>
        <Input id="ward_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}
      <div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Save', 'quan-li-dan-cu')}
        </Button>
      </div>
    </form>
  );
}
