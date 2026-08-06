import { createBrowserRouter, Navigate } from 'react-router';

import { AppLayout } from '@/app/components/layout/app-layout';
import { ProtectedRoute } from '@/app/components/protected-route';
import { OverviewPage } from '@/features/overview/overview-page';
import { ProjectListPage } from '@/features/projects/project-list-page';

import type { RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <ProjectListPage />,
      },
      {
        path: 'projects/:projectId',
        element: <OverviewPage />,
      },
      // Nested under the protected layout so an unknown URL only redirects once
      // the visitor is signed in — a top-level sibling would rewrite it first.
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
