import { useSearchParams } from 'react-router';

import { i18n } from '@/lib/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageLayout from '@/components/layout/PageLayout';

import BackupTab from './BackupTab';
import GeneralTab from './GeneralTab';

export default function SettingsPage({ title }: { title: string }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'backup' ? 'backup' : 'general';

  return (
    <PageLayout title={title}>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="general">{i18n.__('General', 'quan-li-dan-cu')}</TabsTrigger>
          <TabsTrigger value="backup">{i18n.__('Backup & restore', 'quan-li-dan-cu')}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
