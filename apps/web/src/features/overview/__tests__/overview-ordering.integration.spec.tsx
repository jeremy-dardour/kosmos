import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useOverview } from '@/api/hooks/use-overview';
import { OverviewList } from '@/features/overview/overview-list';
import { setupOverviewApi } from '@/testing/mock-api';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { UserEvent } from '@testing-library/user-event';

const PROJECT_ID = 'p1';
const NOW = new Date('2026-07-31T12:00:00');

const vendors = group({ id: 'g1', name: 'Vendors', position: 0 });
const logistics = group({ id: 'g2', name: 'Logistics', position: 1 });

const catering = workstream({
  id: 'w-catering',
  name: 'Catering',
  groupId: 'g1',
  position: 0,
  currentStepId: 's1',
  steps: [step('Request quotes', 'in_progress', { id: 's1', position: 1 })],
});

const flowers = workstream({
  id: 'w-flowers',
  name: 'Flowers',
  groupId: 'g1',
  position: 1,
  currentStepId: 's2',
  steps: [step('Find florist', 'in_progress', { id: 's2', position: 1 })],
});

const venue = workstream({
  id: 'w-venue',
  name: 'Venue',
  groupId: 'g2',
  position: 0,
  currentStepId: 's3',
  steps: [step('Book venue', 'in_progress', { id: 's3', position: 1 })],
});

const photos = workstream({
  id: 'w-photos',
  name: 'Photos',
  groupId: null,
  position: 0,
  currentStepId: 's4',
  steps: [step('Shortlist studios', 'in_progress', { id: 's4', position: 1 })],
});

const cake = workstream({
  id: 'w-cake',
  name: 'Cake',
  groupId: 'g1',
  lifecycle: 'complete',
  position: 2,
  currentStepId: null,
  steps: [
    step('Order cake', 'done', { id: 's5', position: 1, outcome: 'done' }),
  ],
});

function overviewOf(
  workstreams: Workstream[] = [catering, flowers, venue, photos, cake],
): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [vendors, logistics],
    workstreams,
    users: [user({ id: 'u1', name: 'Alex' })],
  };
}

function ListHarness({ isDragDisabled = false }: { isDragDisabled?: boolean }) {
  const overview = useOverview(PROJECT_ID);
  if (!overview.data) return null;

  return (
    <OverviewList
      overview={overview.data}
      assignableUsers={overview.data.users}
      usersById={new Map(overview.data.users.map((u) => [u.id, u]))}
      projectId={PROJECT_ID}
      now={NOW}
      isDragDisabled={isDragDisabled}
    />
  );
}

/** Card names in render order, read off each card's rename affordance. */
function cardNames(scope: HTMLElement): string[] {
  return [...scope.querySelectorAll('article')].map(
    (card) =>
      within(card).getByRole('button', { name: /^Rename / }).textContent ?? '',
  );
}

function sectionOf(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

const ROW_HEIGHT = 100;

/**
 * dnd-kit sorts by measured geometry, and jsdom measures every element as a
 * zero-size rect at the origin — the keyboard sensor would find no neighbour to
 * move towards. Lay the draggable rows out as a synthetic vertical stack first.
 */
function stackVertically(rows: Element[]): void {
  for (const [index, row] of rows.entries()) {
    const top = index * ROW_HEIGHT;
    row.getBoundingClientRect = () => ({
      x: 0,
      y: top,
      top,
      bottom: top + ROW_HEIGHT,
      left: 0,
      right: 600,
      width: 600,
      height: ROW_HEIGHT,
      toJSON: () => ({}),
    });
  }
}

/** The sensor arms its key listener in a macrotask, so let the queue drain. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Picks the handle up, moves it one row down and drops it, all by keyboard. */
async function dragDown(agent: UserEvent, handleName: string): Promise<void> {
  screen.getByRole('button', { name: handleName }).focus();
  await agent.keyboard('[Space]');
  await settle();
  await agent.keyboard('[ArrowDown]');
  await settle();
  await agent.keyboard('[Space]');
}

/** The sortable node of a card is the wrapper the section puts around it. */
function cardRows(scope: HTMLElement): Element[] {
  return [...scope.querySelectorAll('article')].map(
    (card) => card.parentElement as Element,
  );
}

describe('overview ordering', () => {
  it('reorders cards inside their group and sends the whole scope', async () => {
    const api = setupOverviewApi(overviewOf());
    const agent = userEvent.setup();
    renderWithApp(<ListHarness />);

    await screen.findByRole('region', { name: 'Vendors' });
    stackVertically(cardRows(sectionOf('Vendors')));
    await dragDown(agent, 'Reorder Catering');

    await waitFor(() =>
      expect(api.getLastWorkstreamOrder()).toEqual({
        groupId: 'g1',
        ids: ['w-flowers', 'w-catering'],
      }),
    );
    await waitFor(() =>
      expect(cardNames(sectionOf('Vendors'))).toEqual(['Flowers', 'Catering']),
    );
  });

  it('reorders whole groups and sends every group id', async () => {
    const api = setupOverviewApi(overviewOf());
    const agent = userEvent.setup();
    renderWithApp(<ListHarness />);

    await screen.findByRole('region', { name: 'Vendors' });
    stackVertically([sectionOf('Vendors'), sectionOf('Logistics')]);
    await dragDown(agent, 'Reorder group Vendors');

    await waitFor(() =>
      expect(api.getLastGroupOrder()).toEqual({ ids: ['g2', 'g1'] }),
    );
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.map((heading) => heading.textContent)).toEqual([
        'Logistics',
        'Vendors',
        'Ungrouped',
      ]);
    });
  });

  it('drops a rejected order, refetches and renders what the server has', async () => {
    const api = setupOverviewApi(overviewOf());
    const agent = userEvent.setup();
    renderWithApp(<ListHarness />);

    await screen.findByRole('region', { name: 'Vendors' });
    // Somebody else restarted the completed workstream: the ids this drag is
    // about to submit no longer describe the group's live scope.
    api.updateWorkstream('w-cake', (item) => ({
      ...item,
      lifecycle: 'active',
      currentStepId: 's5',
    }));
    const fetchesBeforeDrag = api.getOverviewFetches();

    stackVertically(cardRows(sectionOf('Vendors')));
    await dragDown(agent, 'Reorder Catering');

    expect(
      await screen.findByText(
        "The submitted ids do not match the scope's live workstreams",
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(api.getOverviewFetches()).toBeGreaterThan(fetchesBeforeDrag),
    );

    // The error dialog is modal, so the list is only queryable once dismissed.
    await agent.click(screen.getByRole('button', { name: 'Ok' }));
    await waitFor(() =>
      expect(cardNames(sectionOf('Vendors'))).toEqual([
        'Catering',
        'Flowers',
        'Cake',
      ]),
    );
  });

  it('gives no handle to a card that is alone in its group', async () => {
    setupOverviewApi(overviewOf());
    renderWithApp(<ListHarness />);

    await screen.findByRole('region', { name: 'Logistics' });
    expect(
      screen.queryByRole('button', { name: 'Reorder Venue' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reorder Catering' }),
    ).toBeVisible();
    // Ungrouped is "not yet filed", pinned last, and never drags as a section.
    expect(
      screen.queryByRole('button', { name: 'Reorder group Ungrouped' }),
    ).not.toBeInTheDocument();
  });

  it('renders no handle at all while a filter is active', async () => {
    setupOverviewApi(overviewOf());
    renderWithApp(<ListHarness isDragDisabled />);

    await screen.findByRole('region', { name: 'Vendors' });
    expect(
      screen.queryByRole('button', { name: /^Reorder / }),
    ).not.toBeInTheDocument();
  });
});

describe('completed section', () => {
  it('keeps complete workstreams out of the groups and behind a collapsed header', async () => {
    setupOverviewApi(overviewOf());
    const agent = userEvent.setup();
    renderWithApp(<ListHarness />);

    await screen.findByRole('region', { name: 'Vendors' });
    expect(cardNames(sectionOf('Vendors'))).toEqual(['Catering', 'Flowers']);

    const toggle = within(sectionOf('Completed')).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Completed');
    expect(toggle).toHaveTextContent('1');
    expect(cardNames(sectionOf('Completed'))).toEqual([]);

    await agent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(cardNames(sectionOf('Completed'))).toEqual(['Cake']);
    // Complete cards cluster under their own group header, never draggable.
    expect(
      within(sectionOf('Completed')).getByRole('heading', { name: 'Vendors' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Reorder Cake' }),
    ).not.toBeInTheDocument();

    await agent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves a card into the Completed section as soon as it completes', async () => {
    const api = setupOverviewApi(overviewOf());
    api.mockAdvance('w-flowers', () => ({
      ...flowers,
      lifecycle: 'complete',
      currentStepId: null,
      steps: [
        step('Find florist', 'done', {
          id: 's2',
          position: 1,
          outcome: 'done',
        }),
      ],
    }));
    const agent = userEvent.setup();
    renderWithApp(<ListHarness />);

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Flowers' }),
    );

    await waitFor(() =>
      expect(cardNames(sectionOf('Vendors'))).toEqual(['Catering']),
    );
    await agent.click(within(sectionOf('Completed')).getByRole('button'));
    expect(cardNames(sectionOf('Completed'))).toEqual(['Flowers', 'Cake']);
  });
});
