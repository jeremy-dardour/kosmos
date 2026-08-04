import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeadlineRow } from '@/features/overview/widgets/deadline-row';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

const NOW = new Date(2026, 7, 1); // 2026-08-01

function entry(overrides: Partial<DeadlineEntry> = {}): DeadlineEntry {
  return {
    workstreamId: 'ws-1',
    workstreamName: 'Venue',
    workstreamIcon: '🏰',
    stepId: 'step-1',
    stepName: 'Visit venues',
    deadline: '2026-08-05',
    blocked: false,
    ...overrides,
  };
}

interface RowOverrides {
  entry?: DeadlineEntry;
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

function renderRow({
  entry: rowEntry = entry(),
  onEntryClick,
  onEntryHover,
}: RowOverrides = {}) {
  render(
    <DeadlineRow
      entry={rowEntry}
      now={NOW}
      onEntryClick={onEntryClick}
      onEntryHover={onEntryHover}
    />,
  );
}

describe('deadlineRow', () => {
  describe('content', () => {
    it('shows the day of month, the step and its workstream', () => {
      renderRow();

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Visit venues')).toBeInTheDocument();
      expect(screen.getByText('Venue')).toBeInTheDocument();
    });

    it('names an unnamed step with the placeholder', () => {
      renderRow({ entry: entry({ stepName: '' }) });

      expect(
        screen.getByText('overview.widgets.untitledStep'),
      ).toBeInTheDocument();
    });

    it('marks a blocked step', () => {
      renderRow({ entry: entry({ blocked: true }) });

      expect(
        screen.getByText('overview.widgets.blockedStep'),
      ).toBeInTheDocument();
    });

    it('leaves an unblocked step unmarked', () => {
      renderRow();

      expect(
        screen.queryByText('overview.widgets.blockedStep'),
      ).not.toBeInTheDocument();
    });
  });

  describe('countdown', () => {
    it('words an overdue deadline as late', () => {
      renderRow({ entry: entry({ deadline: '2026-07-28' }) });

      expect(screen.getByText('overview.deadline.late')).toBeInTheDocument();
    });

    it('words a deadline due today', () => {
      renderRow({ entry: entry({ deadline: '2026-08-01' }) });

      expect(screen.getByText('overview.deadline.today')).toBeInTheDocument();
    });

    it('words a deadline due tomorrow', () => {
      renderRow({ entry: entry({ deadline: '2026-08-02' }) });

      expect(
        screen.getByText('overview.deadline.tomorrow'),
      ).toBeInTheDocument();
    });

    it('words the days inside the horizon as upcoming', () => {
      renderRow();

      expect(
        screen.getByText('overview.deadline.upcoming'),
      ).toBeInTheDocument();
    });

    it('says nothing about a deadline beyond the horizon', () => {
      renderRow({ entry: entry({ deadline: '2026-12-20' }) });

      expect(
        screen.queryByText(/overview\.deadline\./),
      ).not.toBeInTheDocument();
    });

    it('colours the day and the countdown by urgency band', () => {
      renderRow({ entry: entry({ deadline: '2026-07-28' }) });

      expect(screen.getByText('28')).toHaveClass('text-urgency-passed');
      expect(screen.getByText('overview.deadline.late')).toHaveClass(
        'text-urgency-passed',
      );
    });
  });

  describe('cross-link callbacks', () => {
    it('reports clicks and hovers with the entry', async () => {
      const onEntryClick = vi.fn();
      const onEntryHover = vi.fn();
      const rowEntry = entry();
      renderRow({ entry: rowEntry, onEntryClick, onEntryHover });

      const row = screen.getByRole('button');
      await userEvent.hover(row);
      expect(onEntryHover).toHaveBeenCalledWith('ws-1');

      await userEvent.click(row);
      expect(onEntryClick).toHaveBeenCalledWith(rowEntry);

      await userEvent.unhover(row);
      expect(onEntryHover).toHaveBeenLastCalledWith(null);
    });

    it('renders inert without a click callback', async () => {
      const onEntryHover = vi.fn();
      renderRow({ onEntryHover });

      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByText('Visit venues'));
      expect(onEntryHover).not.toHaveBeenCalled();
    });
  });
});
