import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { server } from '@/testing/mock-api';
import {
  checklistItem,
  group,
  note,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

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
            stepId: 's2',
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
    await agent.click(
      await screen.findByRole('button', {
        name: 'Show notes for Request quotes',
      }),
    );

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

describe('with frozen date', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('deadline badges and date ticks', () => {
    it('shows countdown badge on cards with deadlines', async () => {
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            workstreams: [
              workstream({
                id: 'w1',
                name: 'Catering',
                icon: '🍽️',
                nearestDeadlineStepId: 's2',
                steps: [
                  step('Research', 'done', { id: 's1', position: 1 }),
                  step('Book caterer', 'in_progress', {
                    id: 's2',
                    position: 2,
                    deadline: '2026-08-10',
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      renderWithApp(<OverviewPage />);

      expect(await screen.findByText('Book caterer in 9d')).toBeVisible();
    });

    it('hides badge when no deadlines', async () => {
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            workstreams: [
              workstream({
                id: 'w1',
                name: 'Catering',
                icon: '🍽️',
                nearestDeadlineStepId: null,
                steps: [
                  step('Research', 'in_progress', { id: 's1', position: 1 }),
                ],
              }),
            ],
          }),
        ),
      );
      renderWithApp(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.queryByText(/\dd$/)).not.toBeInTheDocument();
    });

    it('applies overdue card treatment', async () => {
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            workstreams: [
              workstream({
                id: 'w1',
                name: 'Catering',
                icon: '🍽️',
                nearestDeadlineStepId: 's2',
                steps: [
                  step('Book caterer', 'in_progress', {
                    id: 's2',
                    position: 1,
                    deadline: '2026-07-28',
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      renderWithApp(<OverviewPage />);

      const card = await screen.findByRole('button', { name: 'View Catering' });
      expect(card).toHaveClass('border-step-blocked/40');
      expect(screen.getByText('Book caterer 4d overdue')).toBeVisible();
    });

    it('shows date ticks under pipeline dots with deadlines', async () => {
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            workstreams: [
              workstream({
                id: 'w1',
                name: 'Catering',
                icon: '🍽️',
                steps: [
                  step('Research', 'done', {
                    id: 's1',
                    position: 1,
                    deadline: '2026-07-15',
                  }),
                  step('Book', 'in_progress', {
                    id: 's2',
                    position: 2,
                    deadline: '2026-08-20',
                  }),
                  step('Finalize', 'not_started', {
                    id: 's3',
                    position: 3,
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      renderWithApp(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.getByText('7/15')).toBeVisible();
      expect(screen.getByText('8/20')).toBeVisible();
    });
  });

  describe('owner filter', () => {
    it('shows current user option and filters by owner', async () => {
      const me = user({ id: STUB_USER.id, name: STUB_USER.name });
      const other = user({ id: 'u-other', name: 'Bob Smith' });
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            users: [me, other],
            workstreams: [
              workstream({
                id: 'w-mine',
                name: 'Catering',
                icon: '🍽️',
                steps: [
                  step('Book', 'in_progress', {
                    id: 's1',
                    position: 1,
                    effectiveOwnerId: STUB_USER.id,
                  }),
                ],
              }),
              workstream({
                id: 'w-other',
                name: 'Flowers',
                icon: '💐',
                steps: [
                  step('Find florist', 'in_progress', {
                    id: 's2',
                    position: 1,
                    effectiveOwnerId: 'u-other',
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      const agent = userEvent.setup();
      renderWithApp(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.getByText('Flowers')).toBeVisible();

      await agent.click(
        screen.getByRole('button', { name: 'Filter by current-step owner' }),
      );
      await agent.click(
        await screen.findByRole('menuitemradio', { name: 'My tasks' }),
      );

      expect(screen.getByText('Catering')).toBeVisible();
      expect(screen.queryByText('Flowers')).not.toBeInTheDocument();
    });

    it('excludes not-started and complete workstreams from owner filter', async () => {
      const me = user({ id: STUB_USER.id, name: STUB_USER.name });
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            groups: [],
            users: [me],
            workstreams: [
              workstream({
                id: 'w-active',
                name: 'Catering',
                icon: '🍽️',
                lifecycle: 'active',
                steps: [
                  step('Book', 'in_progress', {
                    id: 's1',
                    position: 1,
                    effectiveOwnerId: STUB_USER.id,
                  }),
                ],
              }),
              workstream({
                id: 'w-ns',
                name: 'Flowers',
                icon: '💐',
                lifecycle: 'not_started',
                steps: [
                  step('Find florist', 'not_started', {
                    id: 's2',
                    position: 1,
                  }),
                ],
              }),
              workstream({
                id: 'w-done',
                name: 'Venue',
                icon: '🏰',
                lifecycle: 'complete',
                steps: [step('Sign', 'done', { id: 's3', position: 1 })],
              }),
            ],
          }),
        ),
      );
      const agent = userEvent.setup();
      renderWithApp(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.getByText('Flowers')).toBeVisible();
      expect(screen.getByText('Venue')).toBeVisible();

      await agent.click(
        screen.getByRole('button', { name: 'Filter by current-step owner' }),
      );
      await agent.click(
        await screen.findByRole('menuitemradio', { name: 'My tasks' }),
      );

      expect(screen.getByText('Catering')).toBeVisible();
      expect(screen.queryByText('Flowers')).not.toBeInTheDocument();
      expect(screen.queryByText('Venue')).not.toBeInTheDocument();
    });
  });

  describe('group filter', () => {
    it('toggles group visibility', async () => {
      const g1 = group({ id: 'g1', name: 'Venue & Catering' });
      const g2 = group({ id: 'g2', name: 'Decor' });
      server.use(
        http.get(`${BASE}/api/projects`, () => HttpResponse.json([project()])),
        http.get(`${BASE}/api/projects/:id/overview`, () =>
          HttpResponse.json({
            ...defaultOverview,
            groups: [g1, g2],
            workstreams: [
              workstream({
                id: 'w1',
                name: 'Catering',
                icon: '🍽️',
                groupId: 'g1',
                steps: [step('Book', 'in_progress', { id: 's1', position: 1 })],
              }),
              workstream({
                id: 'w2',
                name: 'Flowers',
                icon: '💐',
                groupId: 'g2',
                steps: [
                  step('Find florist', 'in_progress', {
                    id: 's2',
                    position: 1,
                  }),
                ],
              }),
              workstream({
                id: 'w3',
                name: 'Music',
                icon: '🎵',
                groupId: null,
                steps: [
                  step('Book band', 'in_progress', {
                    id: 's3',
                    position: 1,
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      const agent = userEvent.setup();
      renderWithApp(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.getByText('Flowers')).toBeVisible();
      expect(screen.getByText('Music')).toBeVisible();

      await agent.click(
        screen.getByRole('button', { name: 'Show or hide groups' }),
      );
      await agent.click(
        await screen.findByRole('menuitemcheckbox', {
          name: 'Venue & Catering',
        }),
      );

      expect(screen.queryByText('Catering')).not.toBeInTheDocument();
      expect(screen.getByText('Flowers')).toBeVisible();
      expect(screen.getByText('Music')).toBeVisible();
    });
  });
});
