import { Outlet } from 'react-router';

import Header from '@/components/layout/Header';

export default function AppLayout() {
  return (
    <>
      <Header />
      <main className="p-5 lg:p-6">
        <Outlet />
      </main>
    </>
  );
}
