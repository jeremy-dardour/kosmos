import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PipelineDots } from '@/features/overview/pipeline-dots';

import type { Step, StepStatus } from '@/api/hooks/use-overview';

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

function dotFor(name: string, statusKey: string): HTMLElement {
  return screen.getByTitle(`${name} — overview.stepStatus.${statusKey}`);
}

describe('pipelineDots', () => {
  it('renders one labelled dot per step', () => {
    render(
      <PipelineDots
        steps={[
          step('Shortlist', 'done'),
          step('Visit', 'in_progress'),
          step('Book', 'not_started'),
        ]}
      />,
    );

    expect(screen.getByText('Shortlist')).toBeInTheDocument();
    expect(screen.getByText('Visit')).toBeInTheDocument();
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('colours each dot by status', () => {
    render(
      <PipelineDots
        steps={[
          step('Shortlist', 'done'),
          step('Compare', 'skipped'),
          step('Visit', 'in_progress'),
          step('Book', 'not_started'),
        ]}
      />,
    );

    expect(dotFor('Shortlist', 'done')).toHaveClass('bg-step-done');
    expect(dotFor('Compare', 'skipped')).toHaveClass('border-step-skipped');
    expect(dotFor('Visit', 'inProgress')).toHaveClass('bg-step-in-progress');
    expect(dotFor('Book', 'notStarted')).toHaveClass('border-step-not-started');
  });

  it('gives the current step the larger glowing dot', () => {
    render(<PipelineDots steps={[step('Visit', 'in_progress')]} />);

    const dot = dotFor('Visit', 'inProgress');
    expect(dot).toHaveClass('size-dot-current');
    expect(dot).toHaveClass('shadow-step-current');
  });

  it('shows a blocked current step in red', () => {
    render(
      <PipelineDots
        steps={[step('Addresses', 'in_progress', { blocked: true })]}
      />,
    );

    const dot = dotFor('Addresses', 'blocked');
    expect(dot).toHaveClass('bg-step-blocked');
    expect(dot).toHaveClass('shadow-step-blocked');
  });

  it('ignores a stale blocked flag on a step that has been passed', () => {
    render(
      <PipelineDots steps={[step('Addresses', 'done', { blocked: true })]} />,
    );

    expect(dotFor('Addresses', 'done')).toHaveClass('bg-step-done');
  });

  it('announces each status as text for screen readers', () => {
    render(
      <PipelineDots
        steps={[step('Shortlist', 'done'), step('Visit', 'in_progress')]}
      />,
    );

    expect(screen.getByText('overview.stepStatus.done')).toHaveClass('sr-only');
    expect(screen.getByText('overview.stepStatus.inProgress')).toHaveClass(
      'sr-only',
    );
  });

  it('falls back to a message when the pipeline is empty', () => {
    render(<PipelineDots steps={[]} />);

    expect(screen.getByText('overview.card.noSteps')).toBeInTheDocument();
  });

  describe('date ticks', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 7, 1));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('drops the year for a deadline in the current year', () => {
      render(
        <PipelineDots
          steps={[step('Visit', 'in_progress', { deadline: '2026-09-12' })]}
        />,
      );

      expect(screen.getByText(/12/)).toBeInTheDocument();
      expect(screen.queryByText(/\b26\b/)).not.toBeInTheDocument();
    });

    it('keeps a 2-digit year for a deadline in another year', () => {
      render(
        <PipelineDots
          steps={[step('Visit', 'in_progress', { deadline: '2025-10-01' })]}
        />,
      );

      expect(screen.getByText(/\b25\b/)).toBeInTheDocument();
    });
  });
});
