import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { OverviewPage } from '@/features/overview/overview-page';
import { collectDeadlineEntries } from '@/features/overview/widgets/collect-deadline-entries';
import { createMemoryStorage } from '@/testing/memory-storage';
import { setupOverviewApi } from '@/testing/mock-api';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderAtProjectRoute } from '@/testing/render-with-app';

import type { Overview, Workstream } from '@/api/hooks/use-overview';

const PROJECT_ID = 'p1';
const NOW = new Date(2026, 7, 1);
const TODAY = '2026-08-01';
const STORAGE_KEY = 'overview.widget-panel';

const alex = user({ id: 'u-alex', name: 'Alex Doe' });
const sam = user({ id: 'u-sam', name: 'Sam Reed' });
const vendors = group({ id: 'g1', name: 'Vendors', position: 0 });

/** Overdue and blocked on its current step, plus a deadline further out. */
const catering = () =>
  workstream({
    id: 'w-catering',
    name: 'Catering',
    icon: '🍽️',
    groupId: 'g1',
    position: 0,
    ownerId: 'u-alex',
    currentStepId: 's2',
    nearestDeadlineStepId: 's2',
    steps: [
      step('Research options', 'done', {
        id: 's1',
        position: 1,
        outcome: 'done',
      }),
      step('Request quotes', 'in_progress', {
        id: 's2',
        position: 2,
        deadline: '2026-07-25',
        blocked: true,
        effectiveOwnerId: 'u-alex',
      }),
      step('Book caterer', 'not_started', {
        id: 's3',
        position: 3,
        deadline: '2026-08-20',
      }),
    ],
  });

/** Carries the nearest upcoming (not overdue) deadline. */
const flowers = () =>
  workstream({
    id: 'w-flowers',
    name: 'Flowers',
    icon: '💐',
    groupId: 'g1',
    position: 1,
    ownerId: 'u-sam',
    currentStepId: 's4',
    nearestDeadlineStepId: 's4',
    steps: [
      step('Choose bouquets', 'in_progress', {
        id: 's4',
        position: 1,
        deadline: '2026-08-05',
        effectiveOwnerId: 'u-sam',
      }),
    ],
  });

const music = () =>
  workstream({
    id: 'w-music',
    name: 'Music',
    icon: '🎵',
    groupId: null,
    position: 0,
    lifecycle: 'not_started',
    steps: [
      step('Shortlist bands', 'not_started', {
        id: 's5',
        position: 1,
        deadline: '2026-09-01',
      }),
    ],
  });

const venue = () =>
  workstream({
    id: 'w-venue',
    name: 'Venue',
    icon: '🏰',
    groupId: null,
    position: 1,
    lifecycle: 'complete',
    steps: [
      step('Visit venues', 'done', { id: 's6', position: 1, outcome: 'done' }),
      step('Sign contract', 'done', { id: 's7', position: 2, outcome: 'done' }),
    ],
  });

/** Sam's only workstream, and the one with no dated step at all. */
const budget = () =>
  workstream({
    id: 'w-budget',
    name: 'Budget',
    icon: '💰',
    groupId: null,
    position: 0,
    ownerId: 'u-sam',
    currentStepId: 's8',
    steps: [
      step('Draft the budget', 'in_progress', {
        id: 's8',
        position: 1,
        effectiveOwnerId: 'u-sam',
      }),
    ],
  });

/** Four steps sharing one day — one past the calendar's three-dot cap. */
const stationery = () =>
  workstream({
    id: 'w-stationery',
    name: 'Stationery',
    icon: '✉️',
    groupId: null,
    position: 0,
    currentStepId: 's9',
    steps: [
      step('Pick paper', 'in_progress', {
        id: 's9',
        position: 1,
        deadline: '2026-08-10',
      }),
      step('Order samples', 'not_started', {
        id: 's10',
        position: 2,
        deadline: '2026-08-10',
      }),
      step('Proof invites', 'not_started', {
        id: 's11',
        position: 3,
        deadline: '2026-08-10',
      }),
      step('Send invites', 'not_started', {
        id: 's12',
        position: 4,
        deadline: '2026-08-10',
      }),
    ],
  });

/** Spans years in both directions from the fixture clock. */
const honeymoon = () =>
  workstream({
    id: 'w-honeymoon',
    name: 'Honeymoon',
    icon: '🌴',
    groupId: null,
    position: 0,
    currentStepId: 's13',
    steps: [
      step('Renew passports', 'in_progress', {
        id: 's13',
        position: 1,
        deadline: '2025-12-10',
      }),
      step('Book flights', 'not_started', {
        id: 's14',
        position: 2,
        deadline: '2027-02-14',
      }),
    ],
  });

function overviewWith(workstreams: Workstream[]): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [vendors],
    workstreams,
    users: [alex, sam],
  };
}

function overviewOf(): Overview {
  return overviewWith([catering(), flowers(), music(), venue()]);
}

function panel(): HTMLElement {
  return screen.getByRole('complementary');
}

function rail(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Overview widgets' });
}

function pulseHeader(): HTMLElement {
  return within(panel()).getByRole('button', { name: /Project pulse/ });
}

function calendarHeader(): HTMLElement {
  return within(panel()).getByRole('button', { name: /Calendar/ });
}

function agendaHeader(): HTMLElement {
  return within(panel()).getByRole('button', { name: /Agenda/ });
}

/** Scopes queries away from the agenda, which lists the same steps again. */
function pulseSection(): HTMLElement {
  return within(panel()).getByRole('region', { name: 'Project pulse' });
}

function calendarSection(): HTMLElement {
  return within(panel()).getByRole('region', { name: 'Calendar' });
}

function agendaSection(): HTMLElement {
  return within(panel()).getByRole('region', { name: 'Agenda' });
}

/** The `Overdue` or month block a given agenda header labels. */
function agendaBucket(label: string): HTMLElement {
  return within(agendaSection()).getByText(label).closest('div[id]')!;
}

function nextDeadlineRow(): HTMLElement {
  return within(pulseSection()).getByRole('button', {
    name: /Request quotes/,
  });
}

/** Only days carrying deadlines are buttons, and each names its own count. */
function markedDayNames(): string[] {
  return within(calendarSection())
    .queryAllByRole('button', { name: /\d+ deadlines?$/ })
    .map((day) => day.getAttribute('aria-label') ?? '');
}

function markedDay(name: string): HTMLElement {
  return within(calendarSection()).getByRole('button', { name });
}

/** A stat tile or chip holds exactly its number and its label. */
function expectStat(label: string, value: string): void {
  expect(within(panel()).getByText(label).parentElement).toHaveTextContent(
    new RegExp(String.raw`^${value}\s*${label}$`),
  );
}

/** A month header holds exactly its label and how many entries it covers. */
function expectAgendaMonth(label: string, count: string): void {
  expect(
    within(agendaSection()).getByText(label).parentElement,
  ).toHaveTextContent(new RegExp(String.raw`^${label}\s*${count}$`));
}

function cardOf(name: string): HTMLElement {
  return screen
    .getByRole('button', { name: `Rename ${name}` })
    .closest('article')!;
}

/**
 * The leading click elsewhere is a workaround: Base UI ignores a click that
 * reopens the menu while the pointer still sits where the last one closed it.
 */
async function chooseOwnerFilter(
  agent: ReturnType<typeof userEvent.setup>,
  name: string,
): Promise<void> {
  await agent.click(document.body);
  await agent.click(
    screen.getByRole('button', { name: 'Filter by current-step owner' }),
  );
  await agent.click(await screen.findByRole('menuitemradio', { name }));
}

async function renderPage(overview: Overview = overviewOf()) {
  const api = setupOverviewApi(overview);
  const agent = userEvent.setup();
  const view = renderAtProjectRoute(<OverviewPage />);
  await screen.findByRole('complementary');

  return { api, agent, ...view };
}

const scrollIntoView = vi.fn();

/** Ids of the elements the page has scrolled to, newest last. */
function scrollTargetIds(): string[] {
  return (scrollIntoView.mock.contexts as Element[]).map((target) => target.id);
}

describe('overview widget panel', () => {
  let storage: Storage;

  // jsdom has no layout engine, so the cross-link's scroll target lacks it.
  beforeAll(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    scrollIntoView.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('panel shell', () => {
    it('hides and restores the panel from the rail toggle', async () => {
      const { agent } = await renderPage();

      const hide = within(rail()).getByRole('button', {
        name: 'Hide the widget panel',
      });
      expect(hide).toHaveAttribute('aria-pressed', 'true');

      await agent.click(hide);

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      const show = within(rail()).getByRole('button', {
        name: 'Show the widget panel',
      });
      expect(show).toHaveAttribute('aria-pressed', 'false');

      await agent.click(show);

      expect(within(panel()).getByRole('progressbar')).toBeVisible();
      expect(
        within(rail()).getByRole('button', { name: 'Hide the widget panel' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('collapses a section down to its summary and expands it again', async () => {
      const { agent } = await renderPage();

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');

      await agent.click(pulseHeader());

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'false');
      expect(
        within(panel()).queryByRole('progressbar'),
      ).not.toBeInTheDocument();
      expect(within(panel()).getByText('3/7 steps')).toBeVisible();

      await agent.click(pulseHeader());

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');
      expect(within(panel()).getByRole('progressbar')).toBeVisible();
    });

    it('restores a collapsed section and a closed panel after a remount', async () => {
      const { agent, unmount } = await renderPage();

      await agent.click(pulseHeader());
      await agent.click(
        within(rail()).getByRole('button', { name: 'Hide the widget panel' }),
      );
      expect(storage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ open: false, collapsedSections: ['stats'] }),
      );
      unmount();

      renderAtProjectRoute(<OverviewPage />);
      await screen.findByRole('button', { name: 'Rename Catering' });

      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      await agent.click(
        within(rail()).getByRole('button', { name: 'Show the widget panel' }),
      );

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'false');
      expect(within(panel()).getByText('3/7 steps')).toBeVisible();
    });

    it('restores a collapsed calendar and agenda after a remount', async () => {
      const { agent, unmount } = await renderPage();

      await agent.click(calendarHeader());
      await agent.click(agendaHeader());
      expect(storage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({
          open: true,
          collapsedSections: ['calendar', 'agenda'],
        }),
      );
      unmount();

      renderAtProjectRoute(<OverviewPage />);
      await screen.findByRole('complementary');

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');
      expect(calendarHeader()).toHaveAttribute('aria-expanded', 'false');
      expect(agendaHeader()).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('project pulse', () => {
    it('reports the aggregate as project pulse numbers', async () => {
      await renderPage();

      expectStat('Total', '4');
      expectStat('Active', '2');
      expectStat('Queued', '1');
      expectStat('Done', '1');
      expect(within(panel()).getByRole('progressbar')).toHaveAccessibleName(
        '43% of all steps settled',
      );
      expectStat('blocked', '1');
      expectStat('overdue', '1');
      expect(within(panel()).getByText('Next deadline')).toBeVisible();
      expect(nextDeadlineRow()).toHaveTextContent('Catering');
      expect(nextDeadlineRow()).toHaveTextContent('7d late');
    });

    it('opens the step behind the next deadline in its own card', async () => {
      const { agent } = await renderPage();

      await agent.click(nextDeadlineRow());

      expect(
        within(cardOf('Catering')).getByRole('region', {
          name: 'Step Request quotes',
        }),
      ).toBeVisible();
      expect(
        within(cardOf('Flowers')).queryByRole('region', {
          name: /^Step /,
        }),
      ).not.toBeInTheDocument();
    });

    it('highlights the target card while the next deadline is hovered', async () => {
      const { agent } = await renderPage();

      expect(cardOf('Catering')).not.toHaveAttribute('data-highlighted');

      await agent.hover(nextDeadlineRow());

      expect(cardOf('Catering')).toHaveAttribute('data-highlighted');
      expect(cardOf('Flowers')).not.toHaveAttribute('data-highlighted');

      await agent.unhover(nextDeadlineRow());

      expect(cardOf('Catering')).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('calendar', () => {
    it('marks exactly the aggregate deadline days of the opening month', async () => {
      await renderPage();

      expect(markedDayNames()).toEqual([
        'Aug 5, 1 deadline',
        'Aug 20, 1 deadline',
      ]);
      expect(
        within(calendarSection()).getByText('2 marked days this month'),
      ).toBeVisible();
    });

    it('caps a crowded day at three dots but names them all in its tooltip', async () => {
      await renderPage(overviewWith([stationery()]));

      const crowded = markedDay('Aug 10, 4 deadlines');

      expect(crowded.title.split('\n')).toHaveLength(4);
      expect(
        crowded.querySelectorAll(':scope > span[aria-hidden] > span'),
      ).toHaveLength(3);
    });

    it('expands a collapsed agenda and scrolls to the day’s month', async () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ open: true, collapsedSections: ['agenda'] }),
      );
      const { agent } = await renderPage();

      expect(agendaHeader()).toHaveAttribute('aria-expanded', 'false');

      await agent.click(markedDay('Aug 5, 1 deadline'));

      expect(agendaHeader()).toHaveAttribute('aria-expanded', 'true');
      expect(storage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ open: true, collapsedSections: [] }),
      );
      expect(scrollTargetIds().at(-1)).toMatch(/-2026-08$/);
    });

    it('scrolls to the overdue block for a month that is entirely late', async () => {
      const { agent } = await renderPage();

      await agent.click(
        within(calendarSection()).getByRole('button', {
          name: 'Previous month',
        }),
      );
      expect(within(calendarSection()).getByText('July 2026')).toBeVisible();
      expect(markedDayNames()).toEqual(['Jul 25, 1 deadline']);

      await agent.click(markedDay('Jul 25, 1 deadline'));

      expect(scrollTargetIds().at(-1)).toMatch(/-overdue$/);
    });
  });

  describe('agenda', () => {
    it('buckets the aggregate deadlines into overdue and months', async () => {
      await renderPage();

      expect(agendaHeader()).toHaveTextContent('4 pending');
      expect(
        within(agendaBucket('Overdue')).getByRole('button', {
          name: /Request quotes/,
        }),
      ).toBeVisible();
      expectAgendaMonth('August', '2');
      expectAgendaMonth('September', '1');
      expect(
        within(agendaBucket('August')).getAllByRole('button'),
      ).toHaveLength(2);
    });

    it('names the year on a month bucket outside the current one', async () => {
      await renderPage(overviewWith([honeymoon()]));

      expectAgendaMonth('February 2027', '1');
      expect(
        within(agendaBucket('Overdue')).getByRole('button', {
          name: /Renew passports/,
        }),
      ).toBeVisible();
    });

    it('opens the step behind an agenda entry in its own card', async () => {
      const { agent } = await renderPage();

      await agent.click(
        within(agendaBucket('August')).getByRole('button', {
          name: /Book caterer/,
        }),
      );

      expect(
        within(cardOf('Catering')).getByRole('region', {
          name: 'Step Book caterer',
        }),
      ).toBeVisible();
      expect(
        within(cardOf('Flowers')).queryByRole('region', { name: /^Step / }),
      ).not.toBeInTheDocument();
    });

    it('highlights the target card while an agenda entry is hovered', async () => {
      const { agent } = await renderPage();

      const row = within(agendaBucket('September')).getByRole('button', {
        name: /Shortlist bands/,
      });
      expect(cardOf('Music')).not.toHaveAttribute('data-highlighted');

      await agent.hover(row);

      expect(cardOf('Music')).toHaveAttribute('data-highlighted');
      expect(cardOf('Catering')).not.toHaveAttribute('data-highlighted');

      await agent.unhover(row);

      expect(cardOf('Music')).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('filter mirroring', () => {
    it('mirrors an owner filter in both its counts and its chip', async () => {
      const { agent } = await renderPage();

      expect(
        within(panel()).queryByText(/Mirroring filters/),
      ).not.toBeInTheDocument();

      await chooseOwnerFilter(agent, 'Alex Doe');

      expect(
        within(panel()).getByText('Mirroring filters: owner Alex Doe'),
      ).toBeVisible();
      expectStat('Total', '1');
      expectStat('Done', '0');
      expect(
        within(pulseSection()).getByRole('button', { name: /Request quotes/ }),
      ).toBeVisible();

      await chooseOwnerFilter(agent, 'All owners');

      expect(
        within(panel()).queryByText(/Mirroring filters/),
      ).not.toBeInTheDocument();
      expectStat('Total', '4');
    });

    it('shrinks the grid, the agenda and the pulse by the same set', async () => {
      const { agent } = await renderPage();

      await chooseOwnerFilter(agent, 'Alex Doe');

      // One overdue entry plus one August entry, agreed on by all three widgets.
      expect(agendaHeader()).toHaveTextContent('2 pending');
      expect(markedDayNames()).toEqual(['Aug 20, 1 deadline']);
      expect(
        within(calendarSection()).getByText('1 marked day this month'),
      ).toBeVisible();
      expectAgendaMonth('August', '1');
      expect(
        within(agendaSection()).queryByText('September'),
      ).not.toBeInTheDocument();
      expect(
        within(agendaBucket('Overdue')).getAllByRole('button'),
      ).toHaveLength(1);
      expectStat('overdue', '1');
    });

    it('empties the agenda and the grid when the filter hides every deadline', async () => {
      const { agent } = await renderPage(overviewWith([catering(), budget()]));

      await chooseOwnerFilter(agent, 'Sam Reed');

      expect(
        within(agendaSection()).getByText('No pending deadlines.'),
      ).toBeVisible();
      expect(markedDayNames()).toEqual([]);
      expect(
        within(calendarSection()).getByText('0 marked days this month'),
      ).toBeVisible();
    });
  });

  describe('shared derivation', () => {
    it('renders one deadline set across the grid, the agenda and the pulse', async () => {
      await renderPage();

      const entries = collectDeadlineEntries(overviewOf().workstreams);
      const overdue = entries.filter((entry) => entry.deadline < TODAY);
      const augustDays = new Set(
        entries
          .filter((entry) => entry.deadline.startsWith('2026-08'))
          .map((entry) => entry.deadline),
      );

      expect(agendaHeader()).toHaveTextContent(`${entries.length} pending`);
      expect(
        within(agendaBucket('Overdue')).getAllByRole('button'),
      ).toHaveLength(overdue.length);
      expectStat('overdue', String(overdue.length));
      expect(nextDeadlineRow()).toHaveTextContent(entries[0]!.stepName);
      expect(markedDayNames()).toHaveLength(augustDays.size);
      expect(
        within(calendarSection()).getByText(
          `${augustDays.size} marked days this month`,
        ),
      ).toBeVisible();
    });
  });

  describe('data reads', () => {
    it('reads the aggregate once however much the panel is used', async () => {
      const { api, agent } = await renderPage();
      const fetchesAfterLoad = api.getOverviewFetches();

      await agent.click(pulseHeader());
      await agent.click(pulseHeader());
      await agent.hover(nextDeadlineRow());
      await agent.click(nextDeadlineRow());
      await agent.click(
        within(calendarSection()).getByRole('button', { name: 'Next month' }),
      );
      await agent.click(
        within(calendarSection()).getByRole('button', {
          name: 'Previous month',
        }),
      );
      await agent.click(markedDay('Aug 20, 1 deadline'));
      await agent.click(
        within(agendaBucket('September')).getByRole('button', {
          name: /Shortlist bands/,
        }),
      );
      await agent.click(
        within(rail()).getByRole('button', { name: 'Hide the widget panel' }),
      );
      await agent.click(
        within(rail()).getByRole('button', { name: 'Show the widget panel' }),
      );

      expect(api.getOverviewFetches()).toBe(fetchesAfterLoad);
    });
  });
});
