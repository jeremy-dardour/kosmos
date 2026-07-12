import { Outlet } from 'react-router';

import { LayoutHeader } from './layout-header';

export const AppLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <LayoutHeader />
      <main className="flex-1 overflow-hidden bg-muted/40 p-4">
        <Outlet />
      </main>
    </div>
  );
};
