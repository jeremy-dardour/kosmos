import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useOverview } from '@/api/hooks/use-overview';
import { InlineWorkstreamCard } from '@/features/overview/inline-workstream-card';
import { server, setupOverviewApi } from '@/testing/mock-api';
import {
  checklistItem,
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Overview, Step, Workstream } from '@/api/hooks/use-overview';

const BASE = 'http://localhost:3000';
const PROJECT_ID = 'p1';
const NOW = new Date('2026-07-31T12:00:00');

/** past · current · two future steps — one of every mutability class. */
const catering = workstream({
  id: 'w-catering',
  name: 'Catering',
  ownerId: 'u1',
  currentStepId: 's2',
  steps: [
    step('Research options', 'done', {
      id: 's1',
      position: 1,
      outcome: 'done',
      deadline: '2026-06-01',
      checklistItems: [checklistItem('Shortlist three', true, { id: 'i1' })],
    }),
    step('Request quotes', 'in_progress', {
      id: 's2',
      position: 2,
      effectiveOwnerId: 'u1',
      checklistItems: [
        checklistItem('Email each caterer', false, { id: 'i2' }),
      ],
    }),
    step('Book caterer', 'not_started', { id: 's3', position: 3 }),
    step('Confirm menu', 'not_started', { id: 's4', position: 4 }),
  ],
});

function overviewOf(...workstreams: Workstream[]): Overview {
  return {
    project: project({ id: PROJECT_ID }),
    groups: [group({ id: 'g1', name: 'Vendors' })],
    workstreams,
    users: [
      user({ id: 'u1', name: 'Alex' }),
      user({ id: 'u2', name: 'Robin' }),
    ],
  };
}

const noop = vi.fn();

/**
 * Holds the selection the way the list will, so the editor's own navigation,
 * close and delete callbacks travel the real path.
 */
function CardHarness({
  openStep = null,
  openNotes = null,
}: {
  openStep?: string | null;
  openNotes?: string | null;
}) {
  const overview = useOverview(PROJECT_ID);
  const [openStepId, setOpenStepId] = useState<string | null>(openStep);
  const [openNotesStepId, setOpenNotesStepId] = useState<string | null>(
    openNotes,
  );
  const found = overview.data?.workstreams.at(0);

  if (!overview.data || !found) return null;

  return (
    <InlineWorkstreamCard
      workstream={found}
      groups={overview.data.groups}
      usersById={new Map(overview.data.users.map((each) => [each.id, each]))}
      projectId={PROJECT_ID}
      now={NOW}
      openStepId={openStepId}
      openNotesStepId={openNotesStepId}
      onOpenStep={setOpenStepId}
      onOpenNotes={setOpenNotesStepId}
      onCloseEditors={() => {
        setOpenStepId(null);
        setOpenNotesStepId(null);
      }}
      onInsertStep={noop}
    />
  );
}

/** Captures the bodies sent to one route while answering with `respondWith`. */
function captureBodies(
  method: 'patch' | 'put',
  path: string,
  respondWith: Step | Workstream,
) {
  const bodies: unknown[] = [];
  server.use(
    http[method](`${BASE}${path}`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(respondWith);
    }),
  );
  return bodies;
}

async function openEditor(openStep: string) {
  setupOverviewApi(overviewOf(catering));
  const agent = userEvent.setup();
  const rendered = renderWithApp(<CardHarness openStep={openStep} />);
  await screen.findByRole('button', { name: 'Close step editor' });
  return { agent, ...rendered };
}

describe('stepEditor', () => {
  describe('an editable step', () => {
    it('commits a rename through the step endpoint', async () => {
      const { agent } = await openEditor('s2');
      const bodies = captureBodies('patch', '/api/steps/:id', {
        ...catering.steps[1]!,
        name: 'Gather quotes',
      });

      await agent.click(screen.getByRole('button', { name: 'Step name' }));
      await agent.clear(screen.getByRole('textbox', { name: 'Step name' }));
      await agent.type(
        screen.getByRole('textbox', { name: 'Step name' }),
        'Gather quotes',
      );
      await agent.tab();

      await waitFor(() => expect(bodies).toEqual([{ name: 'Gather quotes' }]));
    });

    it('clears the explicit owner back to inheritance', async () => {
      const { agent } = await openEditor('s2');
      const bodies = captureBodies(
        'patch',
        '/api/steps/:id',
        catering.steps[1]!,
      );

      await agent.click(screen.getByRole('button', { name: 'Step owner' }));
      await agent.click(
        await screen.findByRole('menuitemradio', {
          name: 'Inherit workstream owner',
        }),
      );

      await waitFor(() => expect(bodies).toEqual([{ ownerId: null }]));
    });

    it('offers the blocked toggle only on the current step and commits it', async () => {
      const { agent } = await openEditor('s2');

      const toggle = screen.getByRole('button', { name: 'Mark blocked' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await agent.click(toggle);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Blocked' })).toHaveAttribute(
          'aria-pressed',
          'true',
        ),
      );
    });

    it('reports that it saves as you type', async () => {
      await openEditor('s2');
      expect(screen.getByText('Saved as you type')).toBeVisible();
    });

    it('adds, toggles and removes checklist items', async () => {
      const { agent } = await openEditor('s2');

      await agent.click(
        screen.getByRole('button', { name: 'Toggle Email each caterer' }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Toggle Email each caterer' }),
        ).toHaveAttribute('aria-pressed', 'true'),
      );

      await agent.click(screen.getByRole('button', { name: 'Add item' }));
      await agent.type(
        screen.getByRole('textbox', { name: 'New checklist item' }),
        'Compare prices{Enter}',
      );
      expect(
        await screen.findByRole('button', { name: 'Toggle Compare prices' }),
      ).toBeVisible();

      await agent.click(
        screen.getByRole('button', { name: 'Remove Compare prices' }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Toggle Compare prices' }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('a future step', () => {
    it('reorders the whole future tail when moved later', async () => {
      const { agent } = await openEditor('s3');
      const bodies = captureBodies(
        'put',
        '/api/workstreams/:id/step-order',
        catering,
      );

      expect(
        screen.getByRole('button', { name: 'Move Book caterer earlier' }),
      ).toBeDisabled();
      await agent.click(
        screen.getByRole('button', { name: 'Move Book caterer later' }),
      );

      await waitFor(() => expect(bodies).toEqual([{ ids: ['s4', 's3'] }]));
    });

    it('deletes the step and closes the editor', async () => {
      const { agent } = await openEditor('s3');

      await agent.click(
        screen.getByRole('button', { name: 'Delete Book caterer' }),
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Close step editor' }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('a frozen step', () => {
    it('renders its fields as a record and offers no structural controls', async () => {
      await openEditor('s1');
      const editor = screen.getByRole('region', {
        name: 'Step Research options',
      });

      expect(within(editor).getByText('Research options')).toBeVisible();
      expect(within(editor).getByText('Done')).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Step name' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Step deadline' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Step owner' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Mark blocked' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Delete Research options' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Move Research options later' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Frozen — notes only')).toBeVisible();
    });

    it('keeps its checklist as a disabled record and still takes notes', async () => {
      await openEditor('s1');

      expect(
        screen.getByRole('button', { name: 'Toggle Shortlist three' }),
      ).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Add item' }),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByRole('textbox', {
          name: 'Add note to Research options',
        }),
      ).toBeVisible();
    });
  });

  describe('footer navigation', () => {
    it('disables previous on the first step and walks the editor forward', async () => {
      const { agent } = await openEditor('s1');

      expect(
        screen.getByRole('button', { name: 'Edit previous step' }),
      ).toBeDisabled();

      await agent.click(screen.getByRole('button', { name: 'Edit next step' }));

      expect(
        await screen.findByRole('button', { name: 'Mark blocked' }),
      ).toBeVisible();
    });

    it('disables next on the last step and closes on demand', async () => {
      const { agent } = await openEditor('s4');

      expect(
        screen.getByRole('button', { name: 'Edit next step' }),
      ).toBeDisabled();

      await agent.click(
        screen.getByRole('button', { name: 'Close step editor' }),
      );

      expect(
        screen.queryByRole('button', { name: 'Close step editor' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('the note panel', () => {
    it('yields to the step editor when both point at the same step', async () => {
      setupOverviewApi(overviewOf(catering));
      renderWithApp(<CardHarness openStep="s2" openNotes="s2" />);

      await screen.findByRole('button', { name: 'Close step editor' });
      expect(
        screen.queryByRole('button', {
          name: 'Close notes for Request quotes',
        }),
      ).not.toBeInTheDocument();
    });

    it('renders alongside an editor opened on another step', async () => {
      setupOverviewApi(overviewOf(catering));
      renderWithApp(<CardHarness openStep="s2" openNotes="s1" />);

      expect(
        await screen.findByRole('button', {
          name: 'Close notes for Research options',
        }),
      ).toBeVisible();
    });
  });
});
