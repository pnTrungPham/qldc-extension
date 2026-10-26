import '@/main.css';

import { StrictMode, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { toast } from 'sonner';

import { getSettings } from '@/backend/settings';
import { setBootSettings } from '@/lib/boot';
import { i18n } from '@/lib/i18n';
import { persistStorage } from '@/lib/persist';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ui/theme-provider';

/** Rendered after <Toaster />, so its effect runs once the Toaster listens (earlier toasts are dropped). */
function StorageWarning() {
  useEffect(() => {
    toast.warning(i18n.__('Chrome may clear this data when the disk is full. Make backups often.', 'quan-li-dan-cu'));
  }, []);
  return null;
}

async function boot() {
  const [settings, kept] = await Promise.all([getSettings(), persistStorage()]);
  setBootSettings(settings);

  createRoot(document.getElementById('qldc-root')!).render(
    <StrictMode>
      <ThemeProvider storageKey="qldc-ui-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
          {!kept && <StorageWarning />}
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void boot();
