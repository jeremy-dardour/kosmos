import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useOverview } from '@/api/hooks/use-overview';
import { WorkstreamCard } from '@/features/overview/workstream-card/workstream-card';
import { server, setupOverviewApi } from '@/testing/mock-api';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Overview, Workstream } from '@/api/hooks/use-overview';

const BASE = 'http://localhost:3000';
const PROJECT_ID = 'p1';
const NOW = new Date('2026-07-31T12:00:00');

const vendors = group({ id: 'g1', name: 'Vendors' });

const catering = workstream({
  id: 'w-catering',
  name: 'Catering',
  icon: '🍽️',
  currentStepId: 's2',
  nearestDeadlineStepId: 's3',
  steps: [
    step('Research options', 'done', {
      id: 's1',
      position: 1,
      outcome: 'done',
    }),
    step('Request quotes', 'in_progress', { id: 's2', position: 2 }),
    step('Book caterer', 'not_started', {
      id: 's3',
      position: 3,
      deadline: '2026-08-01',
    }),
  ],
});

const venue = workstream({
  id: 'w-venue',
  name: 'Venue',
  lifecycle: 'complete',
  steps: [
    step('Sign contract', 'done', { id: 's5', position: 1, outcome: 'done' }),
  ],
});

function overviewOf(...workstreams: Workstream[]): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [vendors],
    workstreams,
    users: [user({ id: 'u1', name: 'Alex' })],
  };
}

const noop = vi.fn();

function CardHarness({
  workstreamId,
  openStepId = null,
  onCloseEditors = noop,
}: {
  workstreamId: string;
  openStepId?: string | null;
  onCloseEditors?: () => void;
}) {
  const overview = useOverview(PROJECT_ID);
  const found = overview.data?.workstreams.find((w) => w.id === workstreamId);

  if (!overview.data || !found) return null;

  return (
    <WorkstreamCard
      workstream={found}
      groups={overview.data.groups}
      users={overview.data.users}
      usersById={new Map(overview.data.users.map((u) => [u.id, u]))}
      projectId={PROJECT_ID}
      now={NOW}
      openStepId={openStepId}
      openNotesStepId={null}
      onOpenStep={noop}
      onOpenNotes={noop}
      onCloseEditors={onCloseEditors}
      onInsertStep={noop}
    />
  );
}

/** Captures PATCH bodies while answering with the given workstream. */
function capturePatch(respondWith: Workstream) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${BASE}/api/workstreams/:id`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(respondWith);
    }),
  );
  return bodies;
}

describe('workstreamCard', () => {
  it('commits a rename on blur and renders the patched response without refetch', async () => {
    setupOverviewApi(overviewOf(catering));
    const bodies = capturePatch({ ...catering, name: 'Feasts' });
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Rename Catering' }),
    );
    await agent.clear(screen.getByRole('textbox', { name: 'Rename Catering' }));
    await agent.type(
      screen.getByRole('textbox', { name: 'Rename Catering' }),
      'Feasts',
    );
    await agent.tab();

    expect(
      await screen.findByRole('button', { name: 'Rename Feasts' }),
    ).toHaveTextContent('Feasts');
    expect(bodies).toEqual([{ name: 'Feasts' }]);
  });

  it('sends nothing when a name edit is left unchanged', async () => {
    setupOverviewApi(overviewOf(catering));
    const bodies = capturePatch(catering);
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Rename Catering' }),
    );
    await agent.tab();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Rename Catering' }),
      ).toBeVisible(),
    );
    expect(bodies).toEqual([]);
  });

  it('commits an icon picked from the grid', async () => {
    setupOverviewApi(overviewOf(catering));
    const bodies = capturePatch({ ...catering, icon: '💐' });
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Change icon of Catering' }),
    );
    await agent.click(await screen.findByRole('button', { name: '💐' }));

    await waitFor(() => expect(bodies).toEqual([{ icon: '💐' }]));
    expect(
      screen.getByRole('button', { name: 'Change icon of Catering' }),
    ).toHaveTextContent('💐');
  });

  it('commits a group change and an ungrouping', async () => {
    setupOverviewApi(overviewOf(catering));
    const bodies = capturePatch({ ...catering, groupId: 'g1' });
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', { name: 'Change group of Catering' }),
    );
    await agent.click(await screen.findByRole('menuitem', { name: 'Vendors' }));
    await waitFor(() => expect(bodies).toEqual([{ groupId: 'g1' }]));

    await agent.click(
      screen.getByRole('button', { name: 'Change group of Catering' }),
    );
    await agent.click(
      await screen.findByRole('menuitem', { name: 'No group' }),
    );
    await waitFor(() =>
      expect(bodies).toEqual([{ groupId: 'g1' }, { groupId: null }]),
    );
  });

  it('commits an owner selection', async () => {
    setupOverviewApi(overviewOf(catering));
    const bodies = capturePatch({ ...catering, ownerId: 'u1' });
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', {
        name: 'Change default owner of Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitemradio', { name: 'Alex' }),
    );
    await waitFor(() => expect(bodies).toEqual([{ ownerId: 'u1' }]));
  });

  it('commits an unassignment through the clear option', async () => {
    setupOverviewApi(overviewOf({ ...catering, ownerId: 'u1' }));
    const bodies = capturePatch({ ...catering, ownerId: null });
    const agent = userEvent.setup();
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await agent.click(
      await screen.findByRole('button', {
        name: 'Change default owner of Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitemradio', { name: 'Unassigned' }),
    );
    await waitFor(() => expect(bodies).toEqual([{ ownerId: null }]));
  });

  it('frames a live card and gives a complete card the half-strength frame', async () => {
    setupOverviewApi(overviewOf(catering, venue));
    const { container } = renderWithApp(
      <div>
        <CardHarness workstreamId="w-catering" />
        <CardHarness workstreamId="w-venue" />
      </div>,
    );

    await screen.findByRole('button', { name: 'Rename Catering' });
    const [live, complete] = [...container.querySelectorAll('article')];

    expect(live?.className).toContain('border-border bg-card');
    expect(complete?.className).toContain('border-border/50');
    expect(complete?.firstElementChild?.className).toContain('opacity-65');
  });

  it('restores the accent frame while a step editor is open', async () => {
    setupOverviewApi(overviewOf(catering));
    const { container } = renderWithApp(
      <CardHarness workstreamId="w-catering" openStepId="s2" />,
    );

    await screen.findByRole('button', { name: 'Rename Catering' });
    expect(container.querySelector('article')?.className).toContain(
      'border-step-in-progress/60',
    );
  });

  it('shows lifecycle badges by state', async () => {
    const blocked = workstream({
      id: 'w-blocked',
      name: 'Florist',
      currentStepId: 'sb',
      steps: [step('Choose style', 'in_progress', { id: 'sb', blocked: true })],
    });
    const notStarted = workstream({
      id: 'w-flowers',
      name: 'Flowers',
      lifecycle: 'not_started',
      steps: [step('Find florist', 'not_started', { id: 's4' })],
    });
    setupOverviewApi(overviewOf(blocked, notStarted, venue));
    const { container } = renderWithApp(
      <div>
        <CardHarness workstreamId="w-blocked" />
        <CardHarness workstreamId="w-flowers" />
        <CardHarness workstreamId="w-venue" />
      </div>,
    );

    await screen.findByRole('button', { name: 'Rename Florist' });
    // The pipeline row repeats status words in sr-only text, so the badge
    // assertions scope to each card's header row.
    const headers = [...container.querySelectorAll('article')].map(
      (card) => card.firstElementChild,
    );
    expect(
      within(headers[0] as HTMLElement).getByText('Blocked'),
    ).toBeVisible();
    expect(
      within(headers[1] as HTMLElement).getByText('Not started'),
    ).toBeVisible();
    expect(
      within(headers[2] as HTMLElement).getByText('Complete'),
    ).toBeVisible();
  });

  it('renders the nearest-deadline badge with countdown wording and tooltip', async () => {
    setupOverviewApi(overviewOf(catering));
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    const badge = await screen.findByTitle('Book caterer due 2026-08-01');
    expect(within(badge).getByText('tomorrow')).toBeVisible();
    expect(within(badge).getByText('Book caterer')).toBeVisible();
  });

  it('renders no deadline badge without a nearest-deadline step', async () => {
    setupOverviewApi(overviewOf({ ...catering, nearestDeadlineStepId: null }));
    renderWithApp(<CardHarness workstreamId="w-catering" />);

    await screen.findByRole('button', { name: 'Rename Catering' });
    expect(screen.queryByText('tomorrow')).not.toBeInTheDocument();
  });

  it('closes editors on an outside click but not inside a portalled picker', async () => {
    setupOverviewApi(overviewOf(catering));
    const onCloseEditors = vi.fn();
    const agent = userEvent.setup();
    renderWithApp(
      <div>
        <button type="button">outside</button>
        <CardHarness
          workstreamId="w-catering"
          openStepId="s2"
          onCloseEditors={onCloseEditors}
        />
      </div>,
    );

    // A click inside a portalled picker counts as inside the card.
    await agent.click(
      await screen.findByRole('button', {
        name: 'Change default owner of Catering',
      }),
    );
    await agent.click(
      await screen.findByRole('menuitemradio', { name: 'Alex' }),
    );
    expect(onCloseEditors).not.toHaveBeenCalled();

    await agent.click(screen.getByRole('button', { name: 'outside' }));
    expect(onCloseEditors).toHaveBeenCalled();
  });

  describe('deletion', () => {
    it('deletes the workstream once the confirmation is accepted', async () => {
      const api = setupOverviewApi(overviewOf(catering));
      const agent = userEvent.setup();
      renderWithApp(<CardHarness workstreamId="w-catering" />);

      await agent.click(
        await screen.findByRole('button', { name: 'Delete Catering' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Delete Catering?',
      });
      await agent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Rename Catering' }),
        ).not.toBeInTheDocument(),
      );
      expect(api.getDeletedWorkstreamIds()).toEqual(['w-catering']);
    });

    it('sends nothing when the confirmation is cancelled', async () => {
      const api = setupOverviewApi(overviewOf(catering));
      const agent = userEvent.setup();
      renderWithApp(<CardHarness workstreamId="w-catering" />);

      await agent.click(
        await screen.findByRole('button', { name: 'Delete Catering' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Delete Catering?',
      });
      await agent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Delete Catering?' }),
        ).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole('button', { name: 'Rename Catering' }),
      ).toBeVisible();
      expect(api.getDeletedWorkstreamIds()).toEqual([]);
    });

    it('hides the bin until the card is hovered or the button focused', async () => {
      setupOverviewApi(overviewOf(catering));
      renderWithApp(<CardHarness workstreamId="w-catering" />);

      const bin = await screen.findByRole('button', {
        name: 'Delete Catering',
      });
      expect(bin).toHaveClass(
        'opacity-0',
        'group-hover/card:opacity-100',
        'focus-visible:opacity-100',
      );
      expect(bin).toHaveAttribute('title', 'Delete Catering');
    });
  });
});
