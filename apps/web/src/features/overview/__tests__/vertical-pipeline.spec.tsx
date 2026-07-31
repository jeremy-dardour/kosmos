import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VerticalPipeline } from '@/features/overview/vertical-pipeline';

import type { Step, StepStatus, UserSummary } from '@/api/hooks/use-overview';

function step(
  name: string,
  status: StepStatus,
  overrides: Partial<Step> = {},
): Step {
  return {
    id: name,
    name,
    position: 1,
    status,
    blocked: false,
    deadline: null,
    outcome: null,
    outcomeAt: null,
    explicitOwnerId: null,
    effectiveOwnerId: null,
    checklistItems: [],
    noteCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const EMPTY_USERS = new Map<string, UserSummary>();

describe('verticalPipeline', () => {
  it('renders all steps by name', () => {
    render(
      <VerticalPipeline
        steps={[
          step('Research', 'done'),
          step('Visit', 'in_progress'),
          step('Book', 'not_started'),
        ]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Visit')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('shows a CURRENT badge on the in-progress step', () => {
    render(
      <VerticalPipeline
        steps={[step('Visit', 'in_progress')]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(screen.getByText('overview.detail.current')).toBeInTheDocument();
  });

  it('shows a BLOCKED badge on a blocked current step', () => {
    render(
      <VerticalPipeline
        steps={[step('Visit', 'in_progress', { blocked: true })]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(screen.getByText('overview.stepStatus.blocked')).toBeInTheDocument();
  });

  it('applies strikethrough to done steps', () => {
    render(
      <VerticalPipeline
        steps={[step('Research', 'done')]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(screen.getByText('Research')).toHaveClass('line-through');
  });

  it('shows the outcome date for done steps', () => {
    render(
      <VerticalPipeline
        steps={[
          step('Research', 'done', {
            outcomeAt: '2026-06-15T10:00:00.000Z',
          }),
        ]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(
      screen.getByText(
        new Date('2026-06-15T10:00:00.000Z').toLocaleDateString(),
      ),
    ).toBeInTheDocument();
  });

  it('shows a deadline with urgency for future steps', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Local calendar parts, not toISOString(): UTC rolls back a day between
    // local and UTC midnight, turning "tomorrow" into "today".
    const isoDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');

    render(
      <VerticalPipeline
        steps={[step('Book', 'not_started', { deadline: isoDate })]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(
      screen.getByText(/overview\.detail\.deadline\.tomorrow/),
    ).toBeInTheDocument();
  });

  it('shows a SKIPPED badge on skipped steps', () => {
    render(
      <VerticalPipeline
        steps={[step('Compare', 'skipped')]}
        usersById={EMPTY_USERS}
      />,
    );

    expect(screen.getByText('overview.stepStatus.skipped')).toBeInTheDocument();
  });
});
