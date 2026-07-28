import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { server } from '@/testing/mock-api';
import {
  checklistItem,
  note,
  project,
  step,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

const BASE = 'http://localhost:3000';

function setupDefaultMocks(onOverviewRequest?: (request: Request) => void) {
  server.use(
    http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
    http.get(`${BASE}/api/projects/:id/overview`, ({ request }) => {
      onOverviewRequest?.(request);
      return HttpResponse.json(defaultOverview);
    }),
  );
}

describe('overview page — golden path', () => {
  it('renders authenticated, grouped workstream data', async () => {
    let authorization: string | null = null;
    setupDefaultMocks((request) => {
      authorization = request.headers.get('Authorization');
    });
    renderWithApp(<OverviewPage />);

    expect(await screen.findByText('Our Wedding')).toBeVisible();
    expect(authorization).toBe('Bearer mockAccessToken');

    const groupedSection = screen.getByRole('region', {
      name: 'Venue & Catering',
    });
    const cateringCard = within(groupedSection).getByRole('button', {
      name: 'View Catering',
    });
    expect(cateringCard).toBeVisible();
    expect(within(cateringCard).getByLabelText('Alice Doe')).toBeVisible();
    expect(within(groupedSection).getByText('Flowers')).toBeVisible();
    expect(within(groupedSection).queryByText('Venue')).not.toBeInTheDocument();

    const ungroupedSection = screen.getByRole('region', {
      name: 'Ungrouped',
    });
    expect(within(ungroupedSection).getByText('Venue')).toBeVisible();
    expect(
      within(ungroupedSection).queryByText('Catering'),
    ).not.toBeInTheDocument();
  });
});

describe('overview page — empty states', () => {
  it('shows empty state when no workstreams', async () => {
    server.use(
      http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
      http.get(`${BASE}/api/projects/:id/overview`, () =>
        HttpResponse.json({ ...defaultOverview, workstreams: [] }),
      ),
    );
    renderWithApp(<OverviewPage />);

    expect(await screen.findByText('No workstreams yet')).toBeVisible();
  });

  it('shows no-project state when projects list is empty', async () => {
    server.use(http.get(`${BASE}/api/projects`, () => HttpResponse.json([])));
    renderWithApp(<OverviewPage />);

    expect(await screen.findByText('No project yet')).toBeVisible();
  });
});

describe('overview page — loading and error states', () => {
  it('shows loading skeleton while data is pending', async () => {
    const { promise: overviewGate, resolve: resolveOverview } =
      Promise.withResolvers<void>();
    server.use(
      http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
      http.get(`${BASE}/api/projects/:id/overview`, async () => {
        await overviewGate;
        return HttpResponse.json(defaultOverview);
      }),
    );
    renderWithApp(<OverviewPage />);

    expect(
      await screen.findByRole('status', { name: 'Loading overview' }),
    ).toBeVisible();

    resolveOverview();
    expect(await screen.findByText('Catering')).toBeVisible();
    expect(
      screen.queryByRole('status', { name: 'Loading overview' }),
    ).not.toBeInTheDocument();
  });

  it('surfaces API error through the global error dialog', async () => {
    server.use(
      http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
      http.get(`${BASE}/api/projects/:id/overview`, () =>
        HttpResponse.json(
          {
            type: 'error',
            title: 'Internal Server Error',
            status: 500,
            statusText: 'Internal Server Error',
          },
          { status: 500 },
        ),
      ),
    );
    renderWithApp(<OverviewPage />);

    expect(await screen.findByText('An error occurred')).toBeVisible();
  });
});

describe('detail panel', () => {
  it('shows empty state before selection', async () => {
    setupDefaultMocks();
    renderWithApp(<OverviewPage />);

    await screen.findByText('Catering');

    const panel = screen.getByRole('complementary', {
      name: 'Select a workstream',
    });
    expect(within(panel).getByText('Select a workstream')).toBeVisible();
  });

  it('opens with vertical pipeline on card click', async () => {
    setupDefaultMocks();
    server.use(
      http.get(`${BASE}/api/workstreams/:id/notes`, () =>
        HttpResponse.json([]),
      ),
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    const cateringCard = await screen.findByRole('button', {
      name: 'View Catering',
    });
    await agent.click(cateringCard);

    const panel = screen.getByRole('complementary', { name: 'Catering' });
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Catering' }),
    ).toBeVisible();

    expect(within(panel).getByText('Research options')).toBeVisible();
    expect(within(panel).getByText('Request quotes')).toBeVisible();
    expect(within(panel).getByText('Book caterer')).toBeVisible();
  });

  it('shows checklist for current step', async () => {
    const items = [
      checklistItem('Bakery A', true, { id: 'ci-1', position: 1 }),
      checklistItem('Bakery B', false, { id: 'ci-2', position: 2 }),
    ];
    const tastingStep = step('Visit bakeries', 'in_progress', {
      id: 's-bake',
      position: 1,
      checklistItems: items,
    });

    server.use(
      http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
      http.get(`${BASE}/api/projects/:id/overview`, () =>
        HttpResponse.json({
          ...defaultOverview,
          workstreams: [
            workstream({
              id: 'w-checklist',
              name: 'Tasting',
              icon: '🧁',
              steps: [tastingStep],
            }),
          ],
        }),
      ),
      http.get(`${BASE}/api/workstreams/:id/notes`, () =>
        HttpResponse.json([]),
      ),
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    const card = await screen.findByRole('button', {
      name: 'View Tasting',
    });
    await agent.click(card);

    expect(screen.getByText('Checklist')).toBeVisible();
    expect(screen.getByText('Bakery A')).toBeVisible();
    expect(screen.getByText('Bakery B')).toBeVisible();
    expect(screen.getByText('1/2')).toBeVisible();
  });

  it('loads notes lazily — no request before selection, one after', async () => {
    let noteFetchCount = 0;
    setupDefaultMocks();
    server.use(
      http.get(`${BASE}/api/workstreams/w-catering/notes`, () => {
        noteFetchCount++;
        return HttpResponse.json([
          note({
            id: 'n-1',
            content: 'Called the caterer, they can do June.',
            author: { id: 'u1', name: 'Alice Doe', avatarUrl: null },
          }),
        ]);
      }),
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await screen.findByText('Catering');
    expect(noteFetchCount).toBe(0);

    const card = screen.getByRole('button', { name: 'View Catering' });
    await agent.click(card);

    expect(
      await screen.findByText('Called the caterer, they can do June.'),
    ).toBeVisible();
    const panel = screen.getByRole('complementary', { name: 'Catering' });
    expect(within(panel).getByText('AD')).toBeVisible();
    expect(noteFetchCount).toBe(1);
  });

  it('closes panel and clears selection on close button click', async () => {
    setupDefaultMocks();
    server.use(
      http.get(`${BASE}/api/workstreams/:id/notes`, () =>
        HttpResponse.json([]),
      ),
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    const card = await screen.findByRole('button', {
      name: 'View Catering',
    });
    await agent.click(card);

    expect(
      screen.getByRole('complementary', { name: 'Catering' }),
    ).toBeInTheDocument();
    expect(card).toHaveAttribute('aria-pressed', 'true');

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await agent.click(closeButton);

    expect(
      screen.getByRole('complementary', { name: 'Select a workstream' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Catering' }),
    ).not.toBeInTheDocument();
    expect(card).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches content and moves aria-pressed when clicking a different card', async () => {
    setupDefaultMocks();
    server.use(
      http.get(`${BASE}/api/workstreams/:id/notes`, () =>
        HttpResponse.json([]),
      ),
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    const cateringCard = await screen.findByRole('button', {
      name: 'View Catering',
    });
    await agent.click(cateringCard);

    expect(
      screen.getByRole('complementary', { name: 'Catering' }),
    ).toBeInTheDocument();
    expect(cateringCard).toHaveAttribute('aria-pressed', 'true');

    const venueCard = screen.getByRole('button', { name: 'View Venue' });
    await agent.click(venueCard);

    expect(
      screen.getByRole('complementary', { name: 'Venue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Catering' }),
    ).not.toBeInTheDocument();
    expect(cateringCard).toHaveAttribute('aria-pressed', 'false');
    expect(venueCard).toHaveAttribute('aria-pressed', 'true');
  });
});
