import { screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/router';
import { setupProjectsApi } from '@/testing/mock-api';
import { project } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { AuthState } from '@/auth';

function renderRouterAt(path: string, authState?: AuthState) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return {
    ...renderWithApp(<RouterProvider router={router} />, authState),
    router,
  };
}

describe('router', () => {
  it('sends an unknown URL to the project list', async () => {
    setupProjectsApi([project({ id: 'p1', name: 'Our Wedding' })]);
    const { router } = renderRouterAt('/nope');

    expect(
      await screen.findByRole('link', { name: /Our Wedding/ }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    // Replaced rather than pushed, so Back does not return to the unknown URL.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('leaves the URL alone while the visitor is signed out', () => {
    const { router } = renderRouterAt('/nope', { status: 'anonymous' });

    expect(
      screen.getByRole('heading', { name: /Projects, ordered and in motion/ }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/nope');
  });
});
