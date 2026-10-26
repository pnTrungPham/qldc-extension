import { createHashRouter } from 'react-router';

import AppLayout from './AppLayout';
import ErrorPage from './pages/ErrorPage';
import { TABS } from './tabs';

// Hash router: wp-admin owns the real URL (admin.php?page=quan-li-dan-cu).
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      ...TABS.map(({ path, label, page: Page }) =>
        path === '/' ? { index: true, element: <Page title={label} /> } : { path, element: <Page title={label} /> },
      ),
      { path: '*', element: <ErrorPage /> },
    ],
  },
]);
