import { createBrowserRouter } from 'react-router';

import { AppLayout } from '@/app/components/layout/app-layout';
import { ProtectedRoute } from '@/app/components/protected-route';
import { ItemsPage } from '@/features/items/items-page';

import type { RouteObject } from 'react-router';

const routes: RouteObject[] = [
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <ItemsPage />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
