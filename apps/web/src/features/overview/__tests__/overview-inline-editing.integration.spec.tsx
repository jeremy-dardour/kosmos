import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const vendors = group({ id: 'g1', name: 'Vendors', position: 0 });
const logistics = group({ id: 'g2', name: 'Logistics', position: 1 });

const catering = workstream({
  id: 'w-catering',
  name: 'Catering',
  groupId: 'g1',
  position: 0,
  currentStepId: 's2',
  steps: [
    step('Research options', 'done', {
      id: 's1',
      position: 1,
      outcome: 'done',
    }),
    step('Request quotes', 'in_progress', { id: 's2', position: 2 }),
    step('Book caterer', 'not_started', { id: 's3', position: 3 }),
  ],
});

const flowers = workstream({
  id: 'w-flowers',
  name: 'Flowers',
  groupId: 'g1',
  position: 1,
  currentStepId: 's4',
  steps: [step('Find florist', 'in_progress', { id: 's4', position: 1 })],
});

const venue = workstream({
  id: 'w-venue',
  name: 'Venue',
  groupId: 'g2',
  position: 0,
  currentStepId: 's5',
  steps: [step('Book venue', 'in_progress', { id: 's5', position: 1 })],
});

function overviewOf(): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [vendors, logistics],
    workstreams: [catering, flowers, venue],
    users: [user({ id: 'u1', name: 'Alex' })],
  };
}

function renderPage() {
  const api = setupOverviewApi(overviewOf());
  const agent = userEvent.setup();
  renderWithApp(<OverviewPage />);
  return { api, agent };
}

function cardOf(name: string): HTMLElement {
  return screen
    .getByRole('button', { name: `Rename ${name}` })
    .closest('article')!;
}

function dotIn(card: HTMLElement, name: string, status: string): HTMLElement {
  return within(card).getByTitle(`${name} — ${status}`).closest('button')!;
}

function ghostIn(card: HTMLElement): HTMLElement {
  return within(card).getByRole('region', { name: 'New step' });
}

/** Opens the ghost at that insert point and returns its focused name field. */
async function openGhost(
  agent: ReturnType<typeof userEvent.setup>,
  card: HTMLElement,
  insertPoint: string,
): Promise<HTMLElement> {
  await agent.click(within(card).getByRole('button', { name: insertPoint }));
  return within(ghostIn(card)).getByRole('textbox', { name: 'New step name' });
}

describe('inline overview editing — the save model', () => {
  it('commits a card rename on blur and renders the response without refetching', async () => {
    const { api, agent } = renderPage();

    await agent.click(
      await screen.findByRole('button', { name: 'Rename Catering' }),
    );
    const fetchesBeforeEdit = api.getOverviewFetches();
    const field = screen.getByRole('textbox', { name: 'Rename Catering' });
    await agent.clear(field);
    await agent.type(field, 'Catering & Bar');
    await agent.tab();

    expect(
      await screen.findByRole('button', { name: 'Rename Catering & Bar' }),
    ).toHaveTextContent('Catering & Bar');
    // Only the mutation response can have produced that name: the aggregate
    // was never read again.
    expect(api.getOverviewFetches()).toBe(fetchesBeforeEdit);
  });

  describe('with fake timers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('holds the reconciling refetch back while a field still has focus', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { api, agent } = renderPage();

      await agent.click(
        await screen.findByRole('button', { name: 'Rename Catering' }),
      );
      const field = screen.getByRole('textbox', { name: 'Rename Catering' });
      await agent.clear(field);
      await agent.type(field, 'Catering & Bar');
      await agent.tab();
      await screen.findByRole('button', { name: 'Rename Catering & Bar' });
      const fetchesAfterEdit = api.getOverviewFetches();

      // Someone starts typing again before the trailing invalidate is due.
      await agent.click(screen.getByRole('button', { name: 'Rename Flowers' }));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(api.getOverviewFetches()).toBe(fetchesAfterEdit);

      await agent.tab();
      await waitFor(() =>
        expect(api.getOverviewFetches()).toBeGreaterThan(fetchesAfterEdit),
      );
    });
  });

  it('advances a workstream from its card and patches the pipeline in place', async () => {
    const { api, agent } = renderPage();
    const advanced = {
      ...catering,
      currentStepId: 's3',
      steps: [
        catering.steps[0]!,
        step('Request quotes', 'done', {
          id: 's2',
          position: 2,
          outcome: 'done',
        }),
        step('Book caterer', 'in_progress', { id: 's3', position: 3 }),
      ],
    };
    api.mockAdvance('w-catering', () => {
      api.updateWorkstream('w-catering', () => advanced);
      return advanced;
    });

    await agent.click(
      await screen.findByRole('button', { name: 'Advance Catering' }),
    );

    expect(
      await within(cardOf('Catering')).findByTitle(
        'Book caterer — In progress',
      ),
    ).toBeVisible();
  });

  it('surfaces a rejected step rename and keeps the step name', async () => {
    const { agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });

    await agent.click(dotIn(cardOf('Catering'), 'Book caterer', 'Not started'));
    const editor = within(cardOf('Catering')).getByRole('region', {
      name: 'Step Book caterer',
    });
    await agent.click(
      within(editor).getByRole('button', { name: 'Step name' }),
    );
    await agent.clear(
      within(editor).getByRole('textbox', { name: 'Step name' }),
    );
    await agent.tab();

    const dialog = await screen.findByRole('dialog', {
      name: 'An error occurred',
    });
    expect(
      within(dialog).getByText('name: name should not be empty'),
    ).toBeVisible();
    await agent.click(within(dialog).getByRole('button', { name: 'Ok' }));

    // Nothing was dropped on the floor: the step still carries its name.
    expect(
      within(cardOf('Catering')).getByTitle('Book caterer — Not started'),
    ).toBeVisible();
  });

  it('filters the list and stops dragging while a filter is active', async () => {
    const { agent } = renderPage();

    await screen.findByRole('button', { name: 'Rename Catering' });
    expect(
      screen.getByRole('button', { name: 'Reorder Catering' }),
    ).toBeVisible();

    await agent.click(
      screen.getByRole('button', { name: 'Show or hide groups' }),
    );
    await agent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Logistics' }),
    );

    expect(
      screen.queryByRole('button', { name: 'Rename Venue' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Reorder / }),
    ).not.toBeInTheDocument();
  });
});

describe('inline overview editing — ghost steps', () => {
  it('creates the step on its first non-empty name commit', async () => {
    const { api, agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });
    const card = cardOf('Catering');

    const field = await openGhost(agent, card, 'Add a step at the end');
    expect(field).toHaveFocus();
    const ghost = ghostIn(card);
    expect(
      within(ghost).getByText('Notes available once the step is saved'),
    ).toBeVisible();
    expect(
      within(ghost).queryByRole('button', { name: 'Add checklist' }),
    ).not.toBeInTheDocument();

    await agent.type(field, 'Tasting{Enter}');

    await waitFor(() =>
      expect(api.getLastCreatedStep()).toEqual({
        name: 'Tasting',
        position: 4,
      }),
    );
    expect(
      await within(cardOf('Catering')).findByTitle('Tasting — Not started'),
    ).toBeVisible();
    expect(
      within(cardOf('Catering')).queryByRole('region', { name: 'New step' }),
    ).not.toBeInTheDocument();
    // The ghost hands off to the created step's editor, keeping the flow open.
    expect(
      await within(cardOf('Catering')).findByRole('region', {
        name: 'Step Tasting',
      }),
    ).toBeVisible();
  });

  it('discards silently on Escape and on an empty commit', async () => {
    const { api, agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });
    const card = cardOf('Catering');

    const typed = await openGhost(agent, card, 'Add a step at the end');
    await agent.type(typed, 'Tasting{Escape}');
    expect(
      within(card).queryByRole('region', { name: 'New step' }),
    ).not.toBeInTheDocument();

    await openGhost(agent, card, 'Add a step at the end');
    await agent.tab();
    await waitFor(() =>
      expect(
        within(card).queryByRole('region', { name: 'New step' }),
      ).not.toBeInTheDocument(),
    );
    expect(api.getLastCreatedStep()).toBeNull();
  });

  it('keeps at most one ghost across the whole list', async () => {
    const { agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });

    await openGhost(agent, cardOf('Catering'), 'Add a step at the end');
    await openGhost(agent, cardOf('Flowers'), 'Add a step at the end');

    expect(
      within(cardOf('Catering')).queryByRole('region', { name: 'New step' }),
    ).not.toBeInTheDocument();
    expect(ghostIn(cardOf('Flowers'))).toBeVisible();
  });

  it('drops the ghost with a message once the position is no longer insertable', async () => {
    const { api, agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });

    const field = await openGhost(
      agent,
      cardOf('Catering'),
      'Insert a step before Book caterer',
    );
    // Somebody else advanced the pipeline meanwhile, so the ghost's position is
    // now the current step's.
    api.updateWorkstream('w-catering', (item) => ({
      ...item,
      currentStepId: 's3',
    }));
    await agent.type(field, 'Tasting{Enter}');

    const dialog = await screen.findByRole('dialog', {
      name: 'An error occurred',
    });
    expect(
      within(dialog).getByText(
        "Position 3 is not in this workstream's future zone",
      ),
    ).toBeVisible();
    await agent.click(within(dialog).getByRole('button', { name: 'Ok' }));

    expect(
      within(cardOf('Catering')).queryByRole('region', { name: 'New step' }),
    ).not.toBeInTheDocument();
  });

  it('hands focus back to the insert point when a ghost is discarded', async () => {
    const { agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });
    const card = cardOf('Catering');
    const insertPoint = within(card).getByRole('button', {
      name: 'Add a step at the end',
    });

    const field = await openGhost(agent, card, 'Add a step at the end');
    await agent.type(field, '{Escape}');

    expect(insertPoint).toHaveFocus();
  });
});

describe('inline overview editing — keyboard paths', () => {
  it('moves focus into a step editor and back to its dot on close', async () => {
    const { agent } = renderPage();
    await screen.findByRole('button', { name: 'Rename Catering' });
    const dot = dotIn(cardOf('Catering'), 'Book caterer', 'Not started');

    await agent.click(dot);
    const editor = within(cardOf('Catering')).getByRole('region', {
      name: 'Step Book caterer',
    });
    expect(editor).toHaveFocus();

    await agent.click(
      within(editor).getByRole('button', { name: 'Close step editor' }),
    );

    expect(dot).toHaveFocus();
    expect(
      within(cardOf('Catering')).queryByRole('region', {
        name: 'Step Book caterer',
      }),
    ).not.toBeInTheDocument();
  });

  it('moves focus into a note panel and back to its marker on close', async () => {
    const api = setupOverviewApi(overviewOf());
    api.updateWorkstream('w-catering', (item) => ({
      ...item,
      steps: item.steps.map((entry) =>
        entry.id === 's1' ? { ...entry, noteCount: 2 } : entry,
      ),
    }));
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);
    await screen.findByRole('button', { name: 'Rename Catering' });

    const marker = within(cardOf('Catering')).getByRole('button', {
      name: 'Show notes for Research options',
    });
    await agent.click(marker);
    const panel = within(cardOf('Catering')).getByRole('region', {
      name: 'Notes for Research options',
    });
    expect(panel).toHaveFocus();

    await agent.click(
      within(panel).getByRole('button', {
        name: 'Close notes for Research options',
      }),
    );

    expect(marker).toHaveFocus();
  });
});
