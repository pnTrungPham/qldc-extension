import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/** Router errorElement (render crash) and the catch-all 404 route. */
export default function ErrorPage() {
  const error = useRouteError();
  const isNotFound = !error || (isRouteErrorResponse(error) && error.status === 404);

  return (
    <div className="grid justify-items-start gap-3 p-6">
      <h1 className="text-xl font-semibold">{isNotFound ? i18n.__('Page not found', 'quan-li-dan-cu') : i18n.__('Something went wrong', 'quan-li-dan-cu')}</h1>
      {!isNotFound && <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>}
      <Button asChild variant="outline">
        <Link to="/">{i18n.__('Back to overview', 'quan-li-dan-cu')}</Link>
      </Button>
    </div>
  );
}
