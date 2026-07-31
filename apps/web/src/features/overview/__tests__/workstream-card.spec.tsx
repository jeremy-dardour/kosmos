import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkstreamCard } from '@/features/overview/workstream-card';

import type { Step, StepStatus, Workstream } from '@/api/hooks/use-overview';

function step(name: string, status: StepStatus, isBlocked = false): Step {
  return {
    id: name,
    name,
    position: 1,
    status,
    blocked: isBlocked,
    deadline: null,
    outcome: null,
    outcomeAt: null,
    explicitOwnerId: null,
    effectiveOwnerId: null,
    checklistItems: [],
    noteCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function workstream(overrides: Partial<Workstream> = {}): Workstream {
  return {
    id: 'w1',
    position: 0,
    name: 'Catering',
    icon: '🍽️',
    groupId: null,
    lifecycle: 'active',
    ownerId: null,
    currentStepId: null,
    startedAt: null,
    completedAt: null,
    steps: [step('Request quotes', 'in_progress')],
    nearestDeadlineStepId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('workstreamCard', () => {
  it('renders the name, icon and pipeline', () => {
    render(<WorkstreamCard workstream={workstream()} />);

    expect(screen.getByText('Catering')).toBeInTheDocument();
    expect(screen.getByText('🍽️')).toBeInTheDocument();
    expect(screen.getByText('Request quotes')).toBeInTheDocument();
  });

  it("shows the owner's initials", () => {
    render(
      <WorkstreamCard
        workstream={workstream({ ownerId: 'u1' })}
        owner={{ id: 'u1', name: 'Alex Doe', avatarUrl: null }}
      />,
    );

    expect(screen.getByLabelText('Alex Doe')).toHaveTextContent('AD');
  });

  it('marks an unassigned workstream', () => {
    render(<WorkstreamCard workstream={workstream()} />);

    expect(
      screen.getByLabelText('overview.card.unassigned'),
    ).toBeInTheDocument();
  });

  it('labels a not-started workstream without hiding it', () => {
    render(
      <WorkstreamCard
        workstream={workstream({
          lifecycle: 'not_started',
          steps: [step('Decide on palette', 'not_started')],
        })}
      />,
    );

    expect(screen.getByText('overview.card.notStarted')).toBeInTheDocument();
    expect(screen.getByText('Decide on palette')).toBeInTheDocument();
  });

  it('labels a complete workstream', () => {
    render(
      <WorkstreamCard
        workstream={workstream({
          lifecycle: 'complete',
          steps: [step('Sign contract', 'done')],
        })}
      />,
    );

    expect(screen.getByText('overview.card.complete')).toBeInTheDocument();
  });

  it('flags a workstream whose current step is blocked', () => {
    render(
      <WorkstreamCard
        workstream={workstream({
          steps: [step('Collect addresses', 'in_progress', true)],
        })}
      />,
    );

    const badges = screen
      .getAllByText('overview.stepStatus.blocked')
      .filter((element) => !element.classList.contains('sr-only'));

    expect(badges).toHaveLength(1);
  });

  it('does not flag a blocked step that has already been passed', () => {
    render(
      <WorkstreamCard
        workstream={workstream({
          steps: [step('Collect addresses', 'done', true)],
        })}
      />,
    );

    expect(
      screen.queryByText('overview.stepStatus.blocked'),
    ).not.toBeInTheDocument();
  });

  it('applies selected styling when isSelected is true', () => {
    render(
      <WorkstreamCard
        workstream={workstream()}
        isSelected
        onSelect={vi.fn()}
      />,
    );

    const card = screen.getByRole('button');
    expect(card).toHaveClass('border-step-in-progress');
    expect(card).toHaveClass('bg-step-in-progress/8');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<WorkstreamCard workstream={workstream()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('calls onSelect on Enter key', async () => {
    const onSelect = vi.fn();
    const agent = userEvent.setup();
    render(<WorkstreamCard workstream={workstream()} onSelect={onSelect} />);

    screen.getByRole('button').focus();
    await agent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledOnce();
  });
});
