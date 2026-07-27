import { Outlet } from 'react-router';

import { LayoutHeader } from './layout-header';

export const AppLayout = () => {
  return (
    // h-screen, not min-h-screen: the card list scrolls inside its own panel,
    // which needs a definite height here.
    <div className="flex h-screen flex-col">
      <LayoutHeader />
      <main className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-4">
        <Outlet />
      </main>
    </div>
  );
};
