import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useSaveSettings, useSettings } from '@/lib/api/settings.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { SettingRow, SettingsCard, SettingsSection } from './layout';

/** Edit the ward code and name. The server validates; its message is shown under the rows. */
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
    <SettingsSection title={i18n.__('General', 'quan-li-dan-cu')} description={i18n.__('The ward this data belongs to, shown at the top of every page.', 'quan-li-dan-cu')}>
      <form onSubmit={onSubmit}>
        <SettingsCard>
          <SettingRow title={i18n.__('Ward code', 'quan-li-dan-cu')} description={i18n.__('2–12 characters: letters without accents, digits and hyphens.', 'quan-li-dan-cu')}>
            <Input id="ward_code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} className="max-w-48 font-mono" aria-label={i18n.__('Ward code', 'quan-li-dan-cu')} />
          </SettingRow>
          <SettingRow title={i18n.__('Ward name', 'quan-li-dan-cu')}>
            <Input id="ward_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={i18n.__('Ward name', 'quan-li-dan-cu')} />
          </SettingRow>
          <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3">
            {save.isError && <p className="m-0 me-auto text-sm text-destructive">{save.error.message}</p>}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Save', 'quan-li-dan-cu')}
            </Button>
          </div>
        </SettingsCard>
      </form>
    </SettingsSection>
  );
}
