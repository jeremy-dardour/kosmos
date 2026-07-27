import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkstreamCard } from '@/features/overview/workstream-card';

import type { dtos } from '@/types/openapi';

function step(
  name: string,
  status: dtos['StepStatus'],
  isBlocked = false,
): dtos['OverviewStepDto'] {
  return {
    id: name,
    name,
    position: 1,
    status,
    blocked: isBlocked,
    deadline: null,
    explicitOwnerId: null,
    effectiveOwnerId: null,
    checklistItems: [],
  };
}

function workstream(
  overrides: Partial<dtos['OverviewWorkstreamDto']> = {},
): dtos['OverviewWorkstreamDto'] {
  return {
    id: 'w1',
    name: 'Catering',
    icon: '🍽️',
    groupId: null,
    lifecycle: 'active',
    ownerId: null,
    steps: [step('Request quotes', 'in_progress')],
    nearestDeadlineStepId: null,
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

    // The pipeline dot announces the same status; match the visible badge.
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
});
