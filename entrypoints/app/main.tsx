import '@/main.css';

import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { DEFAULT_SETTINGS, setBootSettings } from '@/lib/boot';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ui/theme-provider';

setBootSettings(DEFAULT_SETTINGS);

createRoot(document.getElementById('qldc-root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="qldc-ui-theme">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
