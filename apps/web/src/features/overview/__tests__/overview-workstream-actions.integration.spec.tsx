import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { setupOverviewApi } from '@/testing/mock-api';
import { step } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

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
