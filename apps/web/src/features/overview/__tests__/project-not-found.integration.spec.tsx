import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { OverviewPage } from '@/features/overview/overview-page';
import { server } from '@/testing/mock-api';
import { renderAtProjectRoute } from '@/testing/render-with-app';

const BASE = 'http://localhost:3000';

describe('overview page — project not found', () => {
  it('renders the not-found state with a link home on a non-member deep link', async () => {
    server.use(
      http.get(`${BASE}/api/projects/:id/overview`, () =>
        HttpResponse.json(
          {
            type: 'http://localhost:3000/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'Project p1 not found',
          },
          { status: 404 },
        ),
      ),
    );

    renderAtProjectRoute(<OverviewPage />);

    expect(await screen.findByText('Project not found')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Back to projects' }),
    ).toHaveAttribute('href', '/');
    // The page owns this 404 — the global error dialog must stay quiet.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
