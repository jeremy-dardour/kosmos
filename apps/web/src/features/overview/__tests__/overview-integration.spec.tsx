import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { OverviewPage } from '@/features/overview/overview-page';
import { server, setupOverviewApi } from '@/testing/mock-api';
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

import type { Overview } from '@/api/hooks/use-overview';

const BASE = 'http://localhost:3000';

const defaultOverview = {
  project: project(),
  groups: [group()],
  workstreams: [
    workstream({
      id: 'w-catering',
      name: 'Catering',
      icon: '🍽️',
      groupId: 'g1',
      ownerId: 'u1',
      steps: [
        step('Research options', 'done', { id: 's1', position: 1 }),
        step('Request quotes', 'in_progress', { id: 's2', position: 2 }),
        step('Book caterer', 'not_started', { id: 's3', position: 3 }),
      ],
    }),
    workstream({
      id: 'w-flowers',
      name: 'Flowers',
      icon: '💐',
      groupId: 'g1',
      lifecycle: 'not_started',
      steps: [step('Find florist', 'not_started', { id: 's4', position: 1 })],
    }),
    workstream({
      id: 'w-venue',
      name: 'Venue',
      icon: '🏰',
      groupId: null,
      lifecycle: 'complete',
      steps: [
        step('Visit venues', 'done', { id: 's5', position: 1 }),
        step('Sign contract', 'done', { id: 's6', position: 2 }),
      ],
    }),
  ],
  users: [user()],
} satisfies Overview;

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

describe('pipeline actions', () => {
  it('starts a not-started workstream and refreshes its card', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(defaultOverview);
    api.mockAdvance('w-flowers', ({ body }) => {
      submittedBody = body;
      api.updateWorkstream('w-flowers', (item) => ({
        ...item,
        lifecycle: 'active',
        steps: [
          step('Find florist', 'in_progress', {
            id: 's4',
            position: 1,
          }),
        ],
      }));

      return { id: 'w-flowers', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'Start Flowers' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Advance Flowers' }),
    ).toBeVisible();
    expect(await screen.findByTitle('Find florist — In progress')).toHaveClass(
      'bg-step-in-progress',
    );
    expect(submittedBody).toEqual({});
    expect(
      screen.getByRole('complementary', {
        name: 'Select a workstream',
      }),
    ).toBeVisible();
  });

  it('marks the current step done and advances to the next step', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(defaultOverview);
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      api.updateWorkstream('w-catering', (item) => ({
        ...item,
        steps: [
          step('Research options', 'done', { id: 's1', position: 1 }),
          step('Request quotes', 'done', {
            id: 's2',
            position: 2,
            outcome: 'done',
          }),
          step('Book caterer', 'in_progress', {
            id: 's3',
            position: 3,
          }),
        ],
      }));
      return { id: 'w-catering', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    );

    expect(
      await screen.findByTitle('Book caterer — In progress'),
    ).toBeVisible();
    expect(submittedBody).toEqual({});
  });

  it('can skip the current step from the secondary advance action', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(defaultOverview);
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      api.updateWorkstream('w-catering', (item) => ({
        ...item,
        steps: [
          step('Research options', 'done', { id: 's1', position: 1 }),
          step('Request quotes', 'skipped', {
            id: 's2',
            position: 2,
            outcome: 'skipped',
          }),
          step('Book caterer', 'in_progress', {
            id: 's3',
            position: 3,
          }),
        ],
      }));
      return { id: 'w-catering', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', {
        name: 'More options for Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitem', { name: 'Mark skipped' }),
    );

    expect(await screen.findByTitle('Request quotes — Skipped')).toHaveClass(
      'border-dashed',
      'border-step-skipped',
    );
    expect(submittedBody).toEqual({ outcome: 'skipped' });
  });

  it('completes a workstream after advancing its final step', async () => {
    const overview = {
      ...defaultOverview,
      workstreams: defaultOverview.workstreams.map((item) =>
        item.id === 'w-venue'
          ? {
              ...item,
              lifecycle: 'active' as const,
              steps: [
                step('Sign contract', 'in_progress', {
                  id: 's6',
                  position: 1,
                }),
              ],
            }
          : item,
      ),
    };
    const api = setupOverviewApi(overview);
    api.mockAdvance('w-venue', () => {
      api.updateWorkstream('w-venue', (item) => ({
        ...item,
        lifecycle: 'complete',
        steps: [
          step('Sign contract', 'done', {
            id: 's6',
            position: 1,
            outcome: 'done',
          }),
        ],
      }));
      return { id: 'w-venue', lifecycle: 'complete' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Venue' }),
    );

    expect(
      await within(
        screen.getByRole('button', { name: 'View Venue' }),
      ).findByText('Complete'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Advance Venue' }),
    ).not.toBeInTheDocument();
  });

  it('keeps stale active state and shows the server detail when already complete', async () => {
    const api = setupOverviewApi(defaultOverview);
    api.mockAdvanceError('w-catering', 409, {
      type: 'https://wedding-planner.dev/problems/workstream-not-advanceable',
      title: 'Workstream cannot be advanced',
      status: 409,
      detail: 'This workstream is already complete.',
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    );

    expect(
      await screen.findByText('This workstream is already complete.'),
    ).toBeVisible();
    await agent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(
      screen.getByRole('button', { name: 'Advance Catering' }),
    ).toBeVisible();
  });

  it('keeps an empty workstream not started and shows the server detail', async () => {
    const overview = {
      ...defaultOverview,
      workstreams: defaultOverview.workstreams.map((item) =>
        item.id === 'w-flowers' ? { ...item, steps: [] } : item,
      ),
    };
    const api = setupOverviewApi(overview);
    api.mockAdvanceError('w-flowers', 409, {
      type: 'https://wedding-planner.dev/problems/workstream-empty',
      title: 'Workstream has no steps',
      status: 409,
      detail: 'Add a step before starting this workstream.',
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'Start Flowers' }),
    );

    expect(
      await screen.findByText('Add a step before starting this workstream.'),
    ).toBeVisible();
    await agent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(screen.getByRole('button', { name: 'Start Flowers' })).toBeVisible();
  });

  it('offers explicit done and skipped outcomes for a blocked current step', async () => {
    const overview = {
      ...defaultOverview,
      workstreams: defaultOverview.workstreams.map((item) =>
        item.id === 'w-catering'
          ? {
              ...item,
              steps: item.steps.map((currentStep) =>
                currentStep.id === 's2'
                  ? { ...currentStep, blocked: true }
                  : currentStep,
              ),
            }
          : item,
      ),
    };
    const api = setupOverviewApi(overview);
    let submittedBody: unknown;
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      return { id: 'w-catering', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    expect(
      await screen.findByRole('button', { name: 'Resolve Catering' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Advance Catering' }),
    ).not.toBeInTheDocument();

    await agent.click(screen.getByRole('button', { name: 'Resolve Catering' }));
    expect(
      await screen.findByRole('menuitem', { name: 'Mark done' }),
    ).toBeVisible();
    await agent.click(screen.getByRole('menuitem', { name: 'Mark skipped' }));

    expect(submittedBody).toEqual({ outcome: 'skipped' });
  });

  it('locks only the workstream action controls while advancing', async () => {
    const { promise: advanceGate, resolve: resolveAdvance } =
      Promise.withResolvers<void>();
    const api = setupOverviewApi(defaultOverview);
    api.mockAdvance('w-catering', async () => {
      await advanceGate;
      return { id: 'w-catering', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    const advanceButton = await screen.findByRole('button', {
      name: 'Advance Catering',
    });
    const optionsButton = screen.getByRole('button', {
      name: 'More options for Catering',
    });
    await agent.click(advanceButton);

    expect(advanceButton).toBeDisabled();
    expect(optionsButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start Flowers' })).toBeEnabled();

    resolveAdvance();
    await waitFor(() => expect(advanceButton).toBeEnabled());
  });
});
