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
import { setupOverviewApi } from '@/testing/mock-api';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Overview } from '@/api/hooks/use-overview';

const PROJECT_ID = 'p1';
const NOW = new Date(2026, 7, 1);

// Node 25 defines its own (unusable) `localStorage` global, which shadows the
// jsdom one, so the spec supplies the storage instead.
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => entries.keys().toArray()[index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

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

/** Carries the nearest deadline that is still ahead — the panel's next entry. */
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

function overviewOf(): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [vendors],
    workstreams: [catering(), flowers(), music(), venue()],
    users: [alex, sam],
  };
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

function nextDeadlineRow(): HTMLElement {
  return within(panel()).getByRole('button', { name: /Choose bouquets/ });
}

/** A stat tile or chip holds exactly its number and its label. */
function expectStat(label: string, value: string): void {
  expect(within(panel()).getByText(label).parentElement).toHaveTextContent(
    new RegExp(String.raw`^${value}\s*${label}$`),
  );
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

async function renderPage() {
  const api = setupOverviewApi(overviewOf());
  const agent = userEvent.setup();
  const view = renderWithApp(<OverviewPage />);
  await screen.findByRole('button', { name: 'Rename Catering' });

  return { api, agent, ...view };
}

describe('overview widget panel', () => {
  let storage: Storage;

  // jsdom has no layout engine, so the cross-link's scroll target lacks it.
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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
    expect(nextDeadlineRow()).toHaveTextContent('Flowers');
    expect(nextDeadlineRow()).toHaveTextContent('in 4d');
  });

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
    expect(within(panel()).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(panel()).getByText('3/7 steps')).toBeVisible();

    await agent.click(pulseHeader());

    expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel()).getByRole('progressbar')).toBeVisible();
  });

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
      within(panel()).getByRole('button', { name: /Book caterer/ }),
    ).toBeVisible();

    await chooseOwnerFilter(agent, 'All owners');

    expect(
      within(panel()).queryByText(/Mirroring filters/),
    ).not.toBeInTheDocument();
    expectStat('Total', '4');
  });

  it('opens the step behind the next deadline in its own card', async () => {
    const { agent } = await renderPage();

    await agent.click(nextDeadlineRow());

    expect(
      within(cardOf('Flowers')).getByRole('region', {
        name: 'Step Choose bouquets',
      }),
    ).toBeVisible();
    expect(
      within(cardOf('Catering')).queryByRole('region', {
        name: /^Step /,
      }),
    ).not.toBeInTheDocument();
  });

  it('highlights the target card while the next deadline is hovered', async () => {
    const { agent } = await renderPage();

    expect(cardOf('Flowers')).not.toHaveAttribute('data-highlighted');

    await agent.hover(nextDeadlineRow());

    expect(cardOf('Flowers')).toHaveAttribute('data-highlighted');
    expect(cardOf('Catering')).not.toHaveAttribute('data-highlighted');

    await agent.unhover(nextDeadlineRow());

    expect(cardOf('Flowers')).not.toHaveAttribute('data-highlighted');
  });

  it('restores a collapsed section and a closed panel after a remount', async () => {
    const { agent, unmount } = await renderPage();

    await agent.click(pulseHeader());
    await agent.click(
      within(rail()).getByRole('button', { name: 'Hide the widget panel' }),
    );
    expect(storage.getItem('overview.widget-panel')).toBe(
      JSON.stringify({ open: false, collapsedSections: ['stats'] }),
    );
    unmount();

    renderWithApp(<OverviewPage />);
    await screen.findByRole('button', { name: 'Rename Catering' });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    await agent.click(
      within(rail()).getByRole('button', { name: 'Show the widget panel' }),
    );

    expect(pulseHeader()).toHaveAttribute('aria-expanded', 'false');
    expect(within(panel()).getByText('3/7 steps')).toBeVisible();
  });

  it('reads the aggregate once however much the panel is used', async () => {
    const { api, agent } = await renderPage();
    const fetchesAfterLoad = api.getOverviewFetches();

    await agent.click(pulseHeader());
    await agent.click(pulseHeader());
    await agent.hover(nextDeadlineRow());
    await agent.click(nextDeadlineRow());
    await agent.click(
      within(rail()).getByRole('button', { name: 'Hide the widget panel' }),
    );
    await agent.click(
      within(rail()).getByRole('button', { name: 'Show the widget panel' }),
    );

    expect(api.getOverviewFetches()).toBe(fetchesAfterLoad);
  });
});
