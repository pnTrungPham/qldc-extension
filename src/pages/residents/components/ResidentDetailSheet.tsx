import { useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import type { Resident } from '@/lib/api/residents.api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { GENDER_LABELS } from '../labels';
import HouseholdMembers from './HouseholdMembers';
import ResidentForm from './ResidentForm';

/**
 * Detail/edit drawer on the right; with `resident` null it is the add form. Closing with unsaved changes
 * (Cancel, ✕, Esc or a click outside) asks first. Mounted per resident (key it), so the form resets per row.
 */
export default function ResidentDetailSheet({
  resident,
  onClose,
  onShare,
  onDelete,
  onOpenMember,
}: {
  resident: Resident | null;
  onClose: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  /** Show another resident of the same household in place of this one. */
  onOpenMember?: (member: Resident) => void;
}) {
  const dirty = useRef(false);
  // Set while asking about unsaved changes: the member to switch to, or null when closing.
  const [confirming, setConfirming] = useState<{ to: Resident | null } | null>(null);

  function requestClose() {
    if (dirty.current) setConfirming({ to: null });
    else onClose();
  }

  function openMember(member: Resident) {
    if (dirty.current) setConfirming({ to: member });
    else onOpenMember?.(member);
  }

  const subtitle = resident
    ? [
        resident.household_code,
        GENDER_LABELS[resident.gender],
        resident.household_size
          ? i18n.sprintf(
              /* translators: %d: number of people in the household */
              i18n._n('%d person', '%d people', resident.household_size, 'quan-li-dan-cu'),
              resident.household_size,
            )
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent className="sm:max-w-[36rem] md:min-w-[36rem]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="gap-0 pr-16">
          <div className="flex min-h-9 items-center gap-3">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <SheetTitle className="truncate leading-6">{resident ? resident.full_name : i18n.__('Add resident', 'quan-li-dan-cu')}</SheetTitle>
              {subtitle && <SheetDescription className="m-0 leading-5">{subtitle}</SheetDescription>}
            </div>
            {resident && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 /> {i18n.__('Share', 'quan-li-dan-cu')}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pt-5">
          {resident && onOpenMember && <HouseholdMembers resident={resident} onOpen={openMember} />}
          <ResidentForm
            resident={resident}
            onDirtyChange={(value) => (dirty.current = value)}
            onSaved={() => {
              if (resident) return setConfirming(null);
              toast.success(i18n.__('Saved.', 'quan-li-dan-cu'));
              onClose();
            }}
            onCancel={requestClose}
            footerStart={
              resident &&
              caps.edit && (
                <Button type="button" variant="destructive-outline" onClick={onDelete}>
                  {i18n.__('Move to trash', 'quan-li-dan-cu')}
                </Button>
              )
            }
            warning={
              confirming && (
                <div className="flex items-center gap-3 rounded-md border border-warning bg-warning/6 px-3 py-2 text-sm">
                  <span className="flex-1">{confirming.to ? i18n.__('You have unsaved changes. Switch anyway?', 'quan-li-dan-cu') : i18n.__('You have unsaved changes. Close anyway?', 'quan-li-dan-cu')}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(null)}>
                    {i18n.__('Stay', 'quan-li-dan-cu')}
                  </Button>
                  <Button type="button" size="sm" onClick={() => (confirming.to ? onOpenMember?.(confirming.to) : onClose())}>
                    {confirming.to ? i18n.__('Switch', 'quan-li-dan-cu') : i18n.__('Close', 'quan-li-dan-cu')}
                  </Button>
                </div>
              )
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
