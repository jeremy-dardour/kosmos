import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatsWidget } from '@/features/overview/widgets/stats-widget';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';
import type { PulseStats } from '@/features/overview/widgets/project-pulse-stats';

const NOW = new Date(2026, 7, 1); // 2026-08-01

const EMPTY_STATS: PulseStats = {
  total: 0,
  active: 0,
  queued: 0,
  done: 0,
  settledSteps: 0,
  totalSteps: 0,
  progressPct: 0,
  blockedWorkstreams: 0,
  overdueCount: 0,
  nextEntry: null,
};

const NEXT_ENTRY: DeadlineEntry = {
  workstreamId: 'ws-1',
  workstreamName: 'Venue',
  workstreamIcon: '🏰',
  stepId: 'step-1',
  stepName: 'Visit venues',
  deadline: '2026-08-05',
  blocked: false,
};

function renderWidget(overrides: Partial<PulseStats> = {}) {
  render(<StatsWidget stats={{ ...EMPTY_STATS, ...overrides }} now={NOW} />);
}

/** The tile or chip wrapping a label — where the colour and the count live. */
function blockOf(labelKey: string): HTMLElement {
  const label = screen.getByText(labelKey);
  if (!label.parentElement) throw new Error(`${labelKey} has no wrapper`);
  return label.parentElement;
}

describe('statsWidget', () => {
  describe('progress', () => {
    it('reports the settled share', () => {
      renderWidget({ progressPct: 42 });

      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '42',
      );
    });

    it('reports no progress for a project without steps', () => {
      renderWidget();

      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '0',
      );
    });
  });

  describe('tiles', () => {
    it('shows the lifecycle split', () => {
      renderWidget({ total: 7, active: 4, queued: 2, done: 1 });

      expect(blockOf('overview.widgets.pulse.total')).toHaveTextContent('7');
      expect(blockOf('overview.widgets.pulse.active')).toHaveTextContent('4');
      expect(blockOf('overview.widgets.pulse.queued')).toHaveTextContent('2');
      expect(blockOf('overview.widgets.pulse.done')).toHaveTextContent('1');
    });

    it('shows zeroes when there are no workstreams', () => {
      renderWidget();

      expect(blockOf('overview.widgets.pulse.total')).toHaveTextContent('0');
      expect(blockOf('overview.widgets.pulse.active')).toHaveTextContent('0');
    });
  });

  describe('attention chips', () => {
    it('stays muted while nothing needs attention', () => {
      renderWidget();

      expect(blockOf('overview.widgets.pulse.blocked')).toHaveClass(
        'text-muted-foreground',
      );
      expect(blockOf('overview.widgets.pulse.overdue')).toHaveClass(
        'text-muted-foreground',
      );
    });

    it('colours a chip that counts something', () => {
      renderWidget({ blockedWorkstreams: 2, overdueCount: 3 });

      expect(blockOf('overview.widgets.pulse.blocked')).toHaveClass(
        'text-urgency-passed',
      );
      expect(blockOf('overview.widgets.pulse.overdue')).toHaveClass(
        'text-urgency-passed',
      );
    });

    it('colours only the chip that counts something', () => {
      renderWidget({ overdueCount: 3 });

      expect(blockOf('overview.widgets.pulse.blocked')).toHaveClass(
        'text-muted-foreground',
      );
      expect(blockOf('overview.widgets.pulse.overdue')).toHaveClass(
        'text-urgency-passed',
      );
    });
  });

  describe('next deadline', () => {
    it('shows the entry that comes next', () => {
      renderWidget({ nextEntry: NEXT_ENTRY });

      expect(
        screen.getByText('overview.widgets.pulse.nextDeadline'),
      ).toBeInTheDocument();
      expect(screen.getByText('Visit venues')).toBeInTheDocument();
    });

    it('omits the block when nothing is due', () => {
      renderWidget();

      expect(
        screen.queryByText('overview.widgets.pulse.nextDeadline'),
      ).not.toBeInTheDocument();
    });
  });
});
