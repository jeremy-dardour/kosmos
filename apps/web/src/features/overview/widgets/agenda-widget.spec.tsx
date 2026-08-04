import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AgendaWidget } from '@/features/overview/widgets/agenda-widget';
import { bucketDeadlineEntries } from '@/features/overview/widgets/deadline-buckets';
import { deadlineEntry } from '@/testing/deadline-entries';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

/** Local midnight, so the spec never depends on the runner's timezone. */
const NOW = new Date(2026, 7, 1); // 2026-08-01
const PREFIX = 'agenda';

/** Ids and names key off the deadline, so a row names the day it belongs to. */
function makeEntry(deadline: string): DeadlineEntry {
  return deadlineEntry(deadline, {
    stepId: deadline,
    stepName: `Step ${deadline}`,
  });
}

interface WidgetOverrides {
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

function renderWidget(deadlines: string[], overrides: WidgetOverrides = {}) {
  const entries = deadlines.map((deadline) => makeEntry(deadline));
  render(
    <AgendaWidget
      buckets={bucketDeadlineEntries(entries, NOW)}
      now={NOW}
      anchorPrefix={PREFIX}
      {...overrides}
    />,
  );
  return entries;
}

/** The anchored container of a section, addressed the way the grid jumps to it. */
function sectionOf(key: string): HTMLElement {
  const section = document.querySelector<HTMLElement>(
    `#${CSS.escape(`${PREFIX}-${key}`)}`,
  );
  if (!section) throw new Error(`no agenda section anchored at ${key}`);
  return section;
}

/** The header leading a section — its label and, for a month, its count. */
function headerOf(key: string): HTMLElement {
  const header = sectionOf(key).firstElementChild;
  if (!header) throw new Error(`agenda section ${key} has no header`);
  return header as HTMLElement;
}

function countOf(key: string): string | undefined {
  return headerOf(key).lastElementChild?.textContent ?? undefined;
}

/** Every id the widget renders is a section anchor, in document order. */
function anchoredIds(): string[] {
  return [...document.querySelectorAll('[id]')].map((element) => element.id);
}

describe('agendaWidget', () => {
  describe('overdue block', () => {
    it('anchors the late entries under their own header', () => {
      renderWidget(['2026-07-20', '2026-07-28']);

      expect(
        screen.getByText('overview.widgets.agenda.overdue'),
      ).toBeInTheDocument();
      expect(sectionOf('overdue')).toHaveTextContent('Step 2026-07-20');
      expect(sectionOf('overdue')).toHaveTextContent('Step 2026-07-28');
    });

    it('colours the header in the overdue tone', () => {
      renderWidget(['2026-07-20']);

      expect(screen.getByText('overview.widgets.agenda.overdue')).toHaveClass(
        'text-urgency-passed',
      );
    });

    it('carries no count and opens no month section on its own', () => {
      renderWidget(['2026-07-20', '2026-07-28']);

      expect(anchoredIds()).toEqual(['agenda-overdue']);
      expect(headerOf('overdue')).toHaveTextContent(
        /^overview\.widgets\.agenda\.overdue$/,
      );
    });
  });

  describe('month sections', () => {
    it('follows the overdue block with the months in order', () => {
      renderWidget([
        '2026-07-28',
        '2026-08-05',
        '2026-08-20',
        '2026-09-01',
        '2026-11-30',
      ]);

      expect(anchoredIds()).toEqual([
        'agenda-overdue',
        'agenda-2026-08',
        'agenda-2026-09',
        'agenda-2026-11',
      ]);
    });

    it('counts the entries of each month', () => {
      renderWidget(['2026-08-05', '2026-08-20', '2026-09-01']);

      expect(countOf('2026-08')).toBe('2');
      expect(countOf('2026-09')).toBe('1');
    });

    it('lists the entries of the month it anchors', () => {
      renderWidget(['2026-08-05', '2026-09-01']);

      expect(sectionOf('2026-08')).toHaveTextContent('Step 2026-08-05');
      expect(sectionOf('2026-08')).not.toHaveTextContent('Step 2026-09-01');
    });

    it('names the year only when it is not the current one', () => {
      renderWidget(['2026-12-10', '2027-01-15']);

      expect(headerOf('2026-12')).not.toHaveTextContent('2026');
      expect(headerOf('2027-01')).toHaveTextContent('2027');
    });

    it('renders without an overdue block when nothing is late', () => {
      renderWidget(['2026-08-05']);

      expect(
        screen.queryByText('overview.widgets.agenda.overdue'),
      ).not.toBeInTheDocument();
      expect(anchoredIds()).toEqual(['agenda-2026-08']);
    });
  });

  describe('empty state', () => {
    it('says there is nothing pending and anchors nothing', () => {
      renderWidget([]);

      expect(
        screen.getByText('overview.widgets.agenda.empty'),
      ).toBeInTheDocument();
      expect(anchoredIds()).toEqual([]);
      expect(
        screen.queryByText('overview.widgets.agenda.overdue'),
      ).not.toBeInTheDocument();
    });
  });

  describe('cross-link callbacks', () => {
    it('reports a clicked row with its entry', async () => {
      const onEntryClick = vi.fn();
      const [entry] = renderWidget(['2026-08-05'], { onEntryClick });

      await userEvent.click(screen.getByRole('button'));

      expect(onEntryClick).toHaveBeenCalledWith(entry);
    });

    it('renders inert without a click callback', () => {
      renderWidget(['2026-07-28', '2026-08-05']);

      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });
});
