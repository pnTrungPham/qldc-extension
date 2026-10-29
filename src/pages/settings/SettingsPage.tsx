import type { ComponentType } from 'react';
import { Eye, HardDrive, Settings } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { i18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import PageLayout from '@/components/layout/PageLayout';

import BackupTab from './BackupTab';
import DisplayTab from './DisplayTab';
import GeneralTab from './GeneralTab';

const PAGES: Array<{ id: string; label: string; icon: ComponentType<{ className?: string }>; page: ComponentType }> = [
  { id: 'general', label: i18n.__('General', 'quan-li-dan-cu'), icon: Settings, page: GeneralTab },
  { id: 'display', label: i18n.__('Display', 'quan-li-dan-cu'), icon: Eye, page: DisplayTab },
  { id: 'backup', label: i18n.__('Backup & restore', 'quan-li-dan-cu'), icon: HardDrive, page: BackupTab },
];

/** Settings: a menu of pages on the left, the chosen one on the right. The page is in the URL (?tab=), so a link can open it. */
export default function SettingsPage({ title }: { title: string }) {
  const [params, setParams] = useSearchParams();
  const current = PAGES.find((p) => p.id === params.get('tab')) ?? PAGES[0];
  const Page = current.page;

  return (
    <PageLayout title={title}>
      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={title} className="self-start rounded-lg bg-muted/40 p-2">
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 md:flex-col">
            {PAGES.map(({ id, label, icon: Icon }) => {
              const active = id === current.id;
              return (
                <li key={id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setParams({ tab: id }, { replace: true })}
                    className={cn(
                      'flex h-11 w-full cursor-pointer items-center gap-3 rounded-md border-0 border-l-2 border-solid px-3 text-left text-sm whitespace-nowrap transition-colors',
                      active ? 'border-l-foreground bg-background font-medium text-foreground' : 'border-l-transparent bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <Page />
      </div>
    </PageLayout>
  );
}
