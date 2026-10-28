import '@/main.css';

import { StrictMode, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { getSettings } from '@/backend/settings';
import { startAutoBackup } from '@/lib/auto-backup';
import { setBootSettings } from '@/lib/boot';
import { persistStorage } from '@/lib/persist';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ui/theme-provider';

/** Rendered after <Toaster />, so its effect runs once the Toaster listens (earlier toasts are dropped). */
function AutoBackup() {
  useEffect(() => startAutoBackup(), []);
  return null;
}

async function boot() {
  const [settings] = await Promise.all([getSettings(), persistStorage()]);
  setBootSettings(settings);

  createRoot(document.getElementById('qldc-root')!).render(
    <StrictMode>
      <ThemeProvider storageKey="qldc-ui-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
          <AutoBackup />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void boot();
