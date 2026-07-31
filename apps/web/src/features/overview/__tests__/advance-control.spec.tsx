import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useOverview } from '@/api/hooks/use-overview';
import { AdvanceControl } from '@/features/overview/advance-control';
import { setupOverviewApi } from '@/testing/mock-api';
import { project, step, user, workstream } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Overview, Workstream } from '@/api/hooks/use-overview';

const PROJECT_ID = 'p1';

const catering = workstream({
  id: 'w-catering',
  name: 'Catering',
  currentStepId: 's2',
  steps: [
    step('Research options', 'done', {
      id: 's1',
      position: 1,
      outcome: 'done',
    }),
    step('Request quotes', 'in_progress', { id: 's2', position: 2 }),
    step('Book caterer', 'not_started', { id: 's3', position: 3 }),
  ],
});

const flowers = workstream({
  id: 'w-flowers',
  name: 'Flowers',
  lifecycle: 'not_started',
  steps: [step('Find florist', 'not_started', { id: 's4', position: 1 })],
});

const venue = workstream({
  id: 'w-venue',
  name: 'Venue',
  lifecycle: 'complete',
  steps: [step('Sign contract', 'done', { id: 's5', position: 1 })],
});

function overviewOf(...workstreams: Workstream[]): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [],
    workstreams,
    users: [user()],
  };
}

/**
 * The control reads its workstream out of the cached aggregate, so the readout
 * below shows whether a mutation response was merged in — no refetch involved.
 */
function ControlHarness({ workstreamId }: { workstreamId: string }) {
  const overview = useOverview(PROJECT_ID);
  const found = overview.data?.workstreams.find((w) => w.id === workstreamId);

  if (!found) return null;

  return (
    <div>
      <p>{`${found.name} is ${found.lifecycle}`}</p>
      <AdvanceControl workstream={found} projectId={PROJECT_ID} />
    </div>
  );
}

describe('advanceControl', () => {
  it('starts a not-started workstream', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(overviewOf(flowers));
    const started: Workstream = {
      ...flowers,
      lifecycle: 'active',
      currentStepId: 's4',
      steps: [step('Find florist', 'in_progress', { id: 's4', position: 1 })],
    };
    api.mockAdvance('w-flowers', ({ body }) => {
      submittedBody = body;
      api.updateWorkstream('w-flowers', () => started);
      return started;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-flowers" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Start Flowers' }),
    );

    expect(await screen.findByText('Flowers is active')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Advance Flowers' }),
    ).toBeVisible();
    expect(submittedBody).toEqual({});
  });

  it('renders no action for a not-started workstream with no steps', async () => {
    setupOverviewApi(overviewOf({ ...flowers, steps: [] }));
    renderWithApp(<ControlHarness workstreamId="w-flowers" />);

    expect(await screen.findByText('Flowers is not_started')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no action for a complete workstream', async () => {
    setupOverviewApi(overviewOf(venue));
    renderWithApp(<ControlHarness workstreamId="w-venue" />);

    expect(await screen.findByText('Venue is complete')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('advances the current step in one click and merges the response', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(overviewOf(catering));
    const advanced: Workstream = {
      ...catering,
      currentStepId: 's3',
      steps: [
        catering.steps[0]!,
        step('Request quotes', 'done', {
          id: 's2',
          position: 2,
          outcome: 'done',
        }),
        step('Book caterer', 'in_progress', { id: 's3', position: 3 }),
      ],
    };
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      api.updateWorkstream('w-catering', () => advanced);
      return advanced;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    );

    await agent.click(
      screen.getByRole('button', { name: 'More options for Catering' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Skip Book caterer' }),
    ).toBeVisible();
    expect(submittedBody).toEqual({});
  });

  it('skips the current step from the split-button menu', async () => {
    let submittedBody: unknown;
    const api = setupOverviewApi(overviewOf(catering));
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      return catering;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'More options for Catering' }),
    );
    await agent.click(
      await screen.findByRole('menuitem', { name: 'Skip Request quotes' }),
    );

    await waitFor(() => expect(submittedBody).toEqual({ outcome: 'skipped' }));
  });

  it('drops the action once the last step completes the workstream', async () => {
    const lastStep: Workstream = {
      ...catering,
      currentStepId: 's3',
      steps: [step('Book caterer', 'in_progress', { id: 's3', position: 1 })],
    };
    const api = setupOverviewApi(overviewOf(lastStep));
    const completed: Workstream = {
      ...lastStep,
      lifecycle: 'complete',
      currentStepId: null,
      steps: [
        step('Book caterer', 'done', {
          id: 's3',
          position: 1,
          outcome: 'done',
        }),
      ],
    };
    api.mockAdvance('w-catering', () => {
      api.updateWorkstream('w-catering', () => completed);
      return completed;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    );

    expect(await screen.findByText('Catering is complete')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('requires an explicit outcome when the current step is blocked', async () => {
    let submittedBody: unknown;
    const blocked: Workstream = {
      ...catering,
      steps: catering.steps.map((item) =>
        item.id === 's2' ? { ...item, blocked: true } : item,
      ),
    };
    const api = setupOverviewApi(overviewOf(blocked));
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      return blocked;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    expect(
      await screen.findByRole('button', { name: 'Resolve Catering' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Advance Catering' }),
    ).not.toBeInTheDocument();

    await agent.click(screen.getByRole('button', { name: 'Resolve Catering' }));
    await agent.click(
      await screen.findByRole('menuitem', { name: 'Mark done' }),
    );

    await waitFor(() => expect(submittedBody).toEqual({ outcome: 'done' }));
  });

  it('skips a blocked step from the resolve menu', async () => {
    let submittedBody: unknown;
    const blocked: Workstream = {
      ...catering,
      steps: catering.steps.map((item) =>
        item.id === 's2' ? { ...item, blocked: true } : item,
      ),
    };
    const api = setupOverviewApi(overviewOf(blocked));
    api.mockAdvance('w-catering', ({ body }) => {
      submittedBody = body;
      return blocked;
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Resolve Catering' }),
    );
    await agent.click(
      await screen.findByRole('menuitem', { name: 'Mark skipped' }),
    );

    await waitFor(() => expect(submittedBody).toEqual({ outcome: 'skipped' }));
  });

  it('unblocks the current step without advancing the pointer', async () => {
    const blocked: Workstream = {
      ...catering,
      steps: catering.steps.map((item) =>
        item.id === 's2' ? { ...item, blocked: true } : item,
      ),
    };
    setupOverviewApi(overviewOf(blocked));
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Resolve Catering' }),
    );
    await agent.click(
      await screen.findByRole('menuitem', {
        name: 'Unblock — keep working on it',
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Resolve Catering' }),
    ).not.toBeInTheDocument();
  });

  it('locks only the advancing workstream while its command is in flight', async () => {
    const { promise: advanceGate, resolve: resolveAdvance } =
      Promise.withResolvers<void>();
    const api = setupOverviewApi(overviewOf(catering, flowers));
    api.mockAdvance('w-catering', async () => {
      await advanceGate;
      return catering;
    });
    const agent = userEvent.setup();
    renderWithApp(
      <>
        <ControlHarness workstreamId="w-catering" />
        <ControlHarness workstreamId="w-flowers" />
      </>,
    );

    const advanceButton = await screen.findByRole('button', {
      name: 'Advance Catering',
    });
    await agent.click(advanceButton);

    expect(advanceButton).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'More options for Catering' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start Flowers' })).toBeEnabled();

    resolveAdvance();
    await waitFor(() => expect(advanceButton).toBeEnabled());
  });

  it('surfaces the server detail and keeps the action after a rejected advance', async () => {
    const api = setupOverviewApi(overviewOf(catering));
    api.mockAdvanceError('w-catering', 409, {
      type: 'https://wedding-planner.dev/errors/workstream-not-advanceable',
      title: 'Workstream cannot be advanced',
      status: 409,
      detail: 'This workstream is already complete.',
    });
    const agent = userEvent.setup();
    renderWithApp(<ControlHarness workstreamId="w-catering" />);

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
});
