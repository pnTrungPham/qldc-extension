import { i18n } from '@/lib/i18n';
import PageLayout from '@/components/layout/PageLayout';

/** Shown instead of a page the current user may not use. The server enforces this too. */
export default function NoAccess({ title, message }: { title: string; message?: string }) {
  return (
    <PageLayout title={title}>
      <p className="m-0 text-sm text-muted-foreground">{message ?? i18n.__('You do not have permission to use this page.', 'quan-li-dan-cu')}</p>
    </PageLayout>
  );
}
