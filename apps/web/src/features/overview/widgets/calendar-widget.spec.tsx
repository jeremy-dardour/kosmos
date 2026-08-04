import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { monthNameOf } from '@/features/overview/widgets/calendar-locale';
import { CalendarWidget } from '@/features/overview/widgets/calendar-widget';
import { deadlineEntry } from '@/testing/deadline-entries';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

const NOW = new Date(2026, 7, 1); // Saturday 2026-08-01, so the grid opens on July 27

const NAV_LABELS = new Set([
  'overview.widgets.calendar.previousMonth',
  'overview.widgets.calendar.nextMonth',
]);

/** Several steps can share a day, so the id carries the step name too. */
function entry(deadline: string, stepName = 'Visit venues'): DeadlineEntry {
  return deadlineEntry(deadline, {
    stepId: `${deadline}-${stepName}`,
    stepName,
    workstreamIcon: '🏰',
  });
}

function byDate(
  entries: DeadlineEntry[],
): ReadonlyMap<string, DeadlineEntry[]> {
  const buckets = new Map<string, DeadlineEntry[]>();
  for (const item of entries) {
    buckets.set(item.deadline, [...(buckets.get(item.deadline) ?? []), item]);
  }
  return buckets;
}

interface WidgetOverrides {
  entries?: DeadlineEntry[];
  onSelectDay?: (iso: string) => void;
}

function renderWidget({ entries = [], onSelectDay }: WidgetOverrides = {}) {
  render(
    <CalendarWidget
      entriesByDate={byDate(entries)}
      now={NOW}
      onSelectDay={onSelectDay}
    />,
  );
}

/** Every button the grid itself owns — the month nav is not part of it. */
function dayButtons(): HTMLElement[] {
  return screen
    .queryAllByRole('button')
    .filter(
      (button) => !NAV_LABELS.has(button.getAttribute('aria-label') ?? ''),
    );
}

function markedDay(index = 0): HTMLElement {
  const button = dayButtons()[index];
  if (!button) throw new Error(`no marked day at index ${index}`);
  return button;
}

function dotsIn(cell: HTMLElement): Element[] {
  const row = cell.querySelector('[aria-hidden]');
  return row ? [...row.children] : [];
}

async function clickNav(labelKey: string) {
  await userEvent.click(screen.getByRole('button', { name: labelKey }));
}

describe('calendarWidget', () => {
  describe('marked days', () => {
    it('opens a marked day by its ISO date', async () => {
      const onSelectDay = vi.fn();
      renderWidget({ entries: [entry('2026-08-05')], onSelectDay });

      await userEvent.click(markedDay());

      expect(onSelectDay).toHaveBeenCalledWith('2026-08-05');
    });

    it('names a marked day by its date and its deadline count', () => {
      renderWidget({
        entries: [entry('2026-08-05')],
        onSelectDay: vi.fn(),
      });

      expect(markedDay()).toHaveAccessibleName(
        /, overview\.widgets\.calendar\.dayDeadlines$/,
      );
    });

    it('leaves unmarked and out-of-month days non-interactive', () => {
      renderWidget({
        entries: [entry('2026-08-05'), entry('2026-07-31')],
        onSelectDay: vi.fn(),
      });

      expect(dayButtons()).toHaveLength(1);
    });

    it('renders no day buttons at all without a select callback', () => {
      renderWidget({ entries: [entry('2026-08-05'), entry('2026-08-20')] });

      expect(dayButtons()).toHaveLength(0);
    });

    it('caps the dots at three but tooltips the whole day', () => {
      const entries = ['Chateau A', 'Chateau B', 'Chateau C', 'Chateau D'].map(
        (stepName) => entry('2026-08-05', stepName),
      );
      renderWidget({ entries, onSelectDay: vi.fn() });

      const day = markedDay();
      expect(dotsIn(day)).toHaveLength(3);
      expect(day).toHaveAttribute(
        'title',
        '🏰 Chateau A\n🏰 Chateau B\n🏰 Chateau C\n🏰 Chateau D',
      );
    });

    it('colours the dots by the urgency of their day', () => {
      renderWidget({
        entries: [entry('2026-08-02'), entry('2026-08-28')],
        onSelectDay: vi.fn(),
      });

      expect(dotsIn(markedDay(0))[0]).toHaveClass('bg-urgency-week-foreground');
      expect(dotsIn(markedDay(1))[0]).toHaveClass(
        'bg-urgency-month-foreground',
      );
    });
  });

  describe('today', () => {
    it('fills the day number and keeps its dots', () => {
      renderWidget({ entries: [entry('2026-08-01')], onSelectDay: vi.fn() });

      const today = markedDay();
      expect(within(today).getByText('1')).toHaveClass('bg-step-in-progress');
      expect(dotsIn(today)).toHaveLength(1);
    });

    it('leaves today unfilled while it sits outside the viewed month', async () => {
      renderWidget();

      await clickNav('overview.widgets.calendar.previousMonth');

      const trailingToday = screen
        .getAllByText('1')
        .find((day) => day.classList.contains('bg-step-in-progress'));
      expect(trailingToday).toBeUndefined();
    });
  });

  describe('month navigation', () => {
    it('opens on the month of the given date', () => {
      renderWidget();

      expect(screen.getByText(`${monthNameOf(7)} 2026`)).toBeInTheDocument();
    });

    it('moves forward a month and re-derives the marks', async () => {
      renderWidget({ entries: [entry('2026-09-10')], onSelectDay: vi.fn() });

      expect(dayButtons()).toHaveLength(0);

      await clickNav('overview.widgets.calendar.nextMonth');

      expect(screen.getByText(`${monthNameOf(8)} 2026`)).toBeInTheDocument();
      expect(dayButtons()).toHaveLength(1);
    });

    it('moves back across a year boundary', async () => {
      renderWidget();

      for (let step = 0; step < 8; step++) {
        await clickNav('overview.widgets.calendar.previousMonth');
      }

      expect(screen.getByText(`${monthNameOf(11)} 2025`)).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('counts the marked days of the viewed month only', () => {
      renderWidget({
        entries: [
          entry('2026-08-05'),
          entry('2026-08-20'),
          entry('2026-07-31'),
        ],
        onSelectDay: vi.fn(),
      });

      expect(
        screen.getByText('overview.widgets.calendar.markedDays'),
      ).toBeInTheDocument();
      expect(dayButtons()).toHaveLength(2);
    });

    it('still reports a month with nothing marked', () => {
      renderWidget({ onSelectDay: vi.fn() });

      expect(
        screen.getByText('overview.widgets.calendar.markedDays'),
      ).toBeInTheDocument();
      expect(dayButtons()).toHaveLength(0);
    });
  });
});
