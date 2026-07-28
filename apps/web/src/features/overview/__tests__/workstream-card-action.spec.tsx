import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkstreamCardAction } from '@/features/overview/workstream-card-action';
import { step, workstream } from '@/testing/mock-overview-data';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));

describe('workstreamCardAction', () => {
  it('shows Start only for a not-started workstream', async () => {
    const onAdvance = vi.fn();
    const agent = userEvent.setup();
    render(
      <WorkstreamCardAction
        workstream={workstream({
          name: 'Flowers',
          lifecycle: 'not_started',
        })}
        isPending={false}
        onAdvance={onAdvance}
      />,
    );

    await agent.click(
      screen.getByRole('button', {
        name: 'overview.action.startLabel:Flowers',
      }),
    );

    expect(onAdvance).toHaveBeenCalledWith();
  });

  it('offers one-click done and a secondary skipped outcome when active', async () => {
    const onAdvance = vi.fn();
    const agent = userEvent.setup();
    render(
      <WorkstreamCardAction
        workstream={workstream()}
        isPending={false}
        onAdvance={onAdvance}
      />,
    );

    await agent.click(
      screen.getByRole('button', {
        name: 'overview.action.advanceLabel:Catering',
      }),
    );
    expect(onAdvance).toHaveBeenLastCalledWith();

    await agent.click(
      screen.getByRole('button', {
        name: 'overview.action.moreOptionsLabel:Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitem', {
        name: 'overview.action.markSkipped',
      }),
    );
    expect(onAdvance).toHaveBeenLastCalledWith('skipped');
  });

  it('requires an explicit outcome when the current step is blocked', async () => {
    const onAdvance = vi.fn();
    const agent = userEvent.setup();
    render(
      <WorkstreamCardAction
        workstream={workstream({
          steps: [step('Request quotes', 'in_progress', { blocked: true })],
        })}
        isPending={false}
        onAdvance={onAdvance}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: 'overview.action.advanceLabel:Catering',
      }),
    ).not.toBeInTheDocument();
    await agent.click(
      screen.getByRole('button', {
        name: 'overview.action.resolveLabel:Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitem', {
        name: 'overview.action.markDone',
      }),
    );

    expect(onAdvance).toHaveBeenCalledWith('done');
  });

  it('hides complete actions and disables pending active actions', () => {
    const { rerender } = render(
      <WorkstreamCardAction
        workstream={workstream({ lifecycle: 'complete' })}
        isPending={false}
        onAdvance={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <WorkstreamCardAction
        workstream={workstream()}
        isPending
        onAdvance={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'overview.action.advanceLabel:Catering',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'overview.action.moreOptionsLabel:Catering',
      }),
    ).toBeDisabled();
  });
});
