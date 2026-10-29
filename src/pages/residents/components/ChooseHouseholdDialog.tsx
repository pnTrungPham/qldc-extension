import { useState } from 'react';

import { i18n } from '@/lib/i18n';
import type { HouseholdSummary } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import HouseholdPicker from './HouseholdPicker';

/** Pick an existing household and hand it back; nothing is saved here. */
export default function ChooseHouseholdDialog({ onPick, onClose }: { onPick: (household: HouseholdSummary) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState<HouseholdSummary | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{i18n.__('Choose an existing household', 'quan-li-dan-cu')}</DialogTitle>
        </DialogHeader>
        <HouseholdPicker autoFocus value={chosen} onChange={setChosen} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {i18n.__('Cancel', 'quan-li-dan-cu')}
          </Button>
          <Button disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            {i18n.__('Choose', 'quan-li-dan-cu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
