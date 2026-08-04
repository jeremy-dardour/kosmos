import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { server } from '@/testing/mock-api';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderAtProjectRoute } from '@/testing/render-with-app';
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

function renderWithDeadline(deadline: string) {
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
            nearestDeadlineStepId: 's1',
            steps: [
              step('Book caterer', 'in_progress', {
                id: 's1',
                position: 1,
                deadline,
              }),
            ],
          }),
        ],
      }),
    ),
  );
  renderAtProjectRoute(<OverviewPage />);
}

describe('overview page — golden path', () => {
  it('renders authenticated, grouped workstream data', async () => {
    let authorization: string | null = null;
    setupDefaultMocks((request) => {
      authorization = request.headers.get('Authorization');
    });
    const agent = userEvent.setup();
    renderAtProjectRoute(<OverviewPage />);

    expect(await screen.findByText('Our Wedding')).toBeVisible();
    expect(authorization).toBe('Bearer mockAccessToken');

    const groupedSection = screen.getByRole('region', {
      name: 'Venue & Catering',
    });
    expect(
      within(groupedSection).getByRole('button', { name: 'Rename Catering' }),
    ).toBeVisible();
    expect(
      within(groupedSection).getByRole('button', { name: 'Rename Flowers' }),
    ).toBeVisible();

    // Complete work leaves its group for the Completed section, collapsed.
    const completed = screen.getByRole('region', { name: 'Completed' });
    expect(
      within(groupedSection).queryByRole('button', { name: 'Rename Venue' }),
    ).not.toBeInTheDocument();
    await agent.click(within(completed).getByRole('button'));
    expect(
      within(completed).getByRole('button', { name: 'Rename Venue' }),
    ).toBeVisible();
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
    renderAtProjectRoute(<OverviewPage />);

    expect(await screen.findByText('No workstreams yet')).toBeVisible();
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
    renderAtProjectRoute(<OverviewPage />);

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
    renderAtProjectRoute(<OverviewPage />);

    expect(await screen.findByText('An error occurred')).toBeVisible();
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
      renderAtProjectRoute(<OverviewPage />);

      const badge = await screen.findByTitle('Book caterer due 2026-08-10');
      expect(badge).toHaveTextContent('Book caterer');
      expect(badge).toHaveTextContent('in 9d');
    });

    describe('deadlines within a day', () => {
      beforeEach(() => {
        vi.setSystemTime(new Date(2026, 7, 1));
      });

      it('reads today for a deadline due today', async () => {
        renderWithDeadline('2026-08-01');

        expect(
          await screen.findByTitle('Book caterer due 2026-08-01'),
        ).toHaveTextContent('today');
      });

      it('reads tomorrow for a deadline due the next day', async () => {
        renderWithDeadline('2026-08-02');

        expect(
          await screen.findByTitle('Book caterer due 2026-08-02'),
        ).toHaveTextContent('tomorrow');
      });
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
      renderAtProjectRoute(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.queryByTitle(/ due /)).not.toBeInTheDocument();
    });

    it('marks an overdue deadline in the late band', async () => {
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
      renderAtProjectRoute(<OverviewPage />);

      const badge = await screen.findByTitle('Book caterer due 2026-07-28');
      expect(badge).toHaveClass('bg-urgency-passed');
      expect(badge).toHaveTextContent('4d late');
    });

    it('shows date ticks under dots, with a year only when it is not the current one', async () => {
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
                    deadline: '2025-10-01',
                  }),
                ],
              }),
            ],
          }),
        ),
      );
      renderAtProjectRoute(<OverviewPage />);

      await screen.findByRole('button', { name: 'Rename Catering' });
      expect(screen.getByText('Jul 15')).toBeVisible();
      expect(screen.getByText('Aug 20')).toBeVisible();
      expect(screen.getByText('Oct 1, 25')).toBeVisible();
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
      renderAtProjectRoute(<OverviewPage />);

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
      renderAtProjectRoute(<OverviewPage />);

      await screen.findByText('Catering');
      expect(screen.getByText('Flowers')).toBeVisible();
      // The complete workstream is behind the collapsed Completed section.
      expect(screen.getByRole('region', { name: 'Completed' })).toBeVisible();

      await agent.click(
        screen.getByRole('button', { name: 'Filter by current-step owner' }),
      );
      await agent.click(
        await screen.findByRole('menuitemradio', { name: 'My tasks' }),
      );

      expect(screen.getByText('Catering')).toBeVisible();
      expect(screen.queryByText('Flowers')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('region', { name: 'Completed' }),
      ).not.toBeInTheDocument();
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
      renderAtProjectRoute(<OverviewPage />);

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
