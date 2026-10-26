import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { useSaveSettings, useSettings } from '@/lib/api/settings.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Edit the ward code and name. The server validates; its message is shown under the form. */
export default function WardDialog({ onClose }: { onClose: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [code, setCode] = useState(settings.ward_code);
  const [name, setName] = useState(settings.ward_name);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      { ward_code: code, ward_name: name },
      {
        onSuccess: () => {
          toast.success(i18n.__('Ward name saved', 'quan-li-dan-cu'));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{i18n.__('Ward name', 'quan-li-dan-cu')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ward_code">{i18n.__('Ward code', 'quan-li-dan-cu')}</Label>
            <Input
              id="ward_code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {i18n.__('2–12 characters: letters without accents, digits and hyphens.', 'quan-li-dan-cu')}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ward_name">{i18n.__('Ward name', 'quan-li-dan-cu')}</Label>
            <Input id="ward_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          {save.isError && <p className="text-sm text-destructive">{save.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {i18n.__('Cancel', 'quan-li-dan-cu')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? i18n.__('Saving…', 'quan-li-dan-cu') : i18n.__('Save', 'quan-li-dan-cu')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
