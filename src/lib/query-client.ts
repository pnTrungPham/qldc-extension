import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { i18n } from '@/lib/i18n';
import type { ApiError } from '@/lib/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
  // Every failed save toasts, so a page never fails silently. Failed reads render in the page.
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error((error as unknown as ApiError).message || i18n.__('Something went wrong.', 'quan-li-dan-cu'));
    },
  }),
});
