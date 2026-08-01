import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useOverview } from '@/api/hooks/use-overview';
import { InlineWorkstreamCard } from '@/features/overview/inline-workstream-card';
import { setupNotesApi, setupOverviewApi } from '@/testing/mock-api';
import {
  group,
  note,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

import type { Overview } from '@/api/hooks/use-overview';
import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

const PROJECT_ID = 'p1';
const NOW = new Date('2026-07-31T12:00:00');
const MINUTE_MS = 60_000;

const ME = { id: STUB_USER.id, name: STUB_USER.name, avatarUrl: null };
const THEM = { id: 'u-other', name: 'Robin', avatarUrl: null };

const invitations = workstream({
  id: 'w-invitations',
  name: 'Invitations',
  currentStepId: 's-current',
  steps: [
    step('Collect addresses', 'done', {
      id: 's-past',
      position: 1,
      outcome: 'done',
      noteCount: 1,
    }),
    step('Draft invitations', 'in_progress', {
      id: 's-current',
      position: 2,
      noteCount: 2,
    }),
  ],
});

const overview: Overview = {
  project: project({ id: PROJECT_ID }),
  groups: [group({ id: 'g1', name: 'Paper' })],
  workstreams: [invitations],
  users: [user({ id: ME.id, name: ME.name })],
};

/** Minutes before `NOW`, so the assertions hold in any timezone. */
function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * MINUTE_MS).toISOString();
}

const noop = vi.fn();

function CardHarness({
  openStep = null,
  openNotes = null,
}: {
  openStep?: string | null;
  openNotes?: string | null;
}) {
  const data = useOverview(PROJECT_ID);
  const [openStepId, setOpenStepId] = useState<string | null>(openStep);
  const [openNotesStepId, setOpenNotesStepId] = useState<string | null>(
    openNotes,
  );
  const found = data.data?.workstreams.at(0);

  if (!data.data || !found) return null;

  return (
    <InlineWorkstreamCard
      workstream={found}
      groups={data.data.groups}
      users={data.data.users}
      usersById={new Map(data.data.users.map((each) => [each.id, each]))}
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

function render(notes: NoteEntry[], open: { step?: string; notes?: string }) {
  setupOverviewApi(overview);
  setupNotesApi(notes, ME);
  const agent = userEvent.setup();
  renderWithApp(
    <CardHarness openStep={open.step ?? null} openNotes={open.notes ?? null} />,
  );
  return agent;
}

describe('note threads', () => {
  it('offers edit and delete on your own entries only', async () => {
    render(
      [
        note({
          id: 'n-mine',
          stepId: 's-current',
          content: 'Mine',
          author: ME,
          createdAt: minutesAgo(30),
        }),
        note({
          id: 'n-theirs',
          stepId: 's-current',
          content: 'Theirs',
          author: THEM,
          createdAt: minutesAgo(30),
        }),
      ],
      { step: 's-current' },
    );

    expect(await screen.findByText('Mine')).toBeVisible();
    expect(
      screen.getAllByRole('button', {
        name: 'Edit your note on Draft invitations',
      }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', {
        name: 'Delete your note on Draft invitations',
      }),
    ).toHaveLength(1);
  });

  it('edits an entry inline on Enter', async () => {
    const agent = render(
      [
        note({
          id: 'n-mine',
          stepId: 's-current',
          content: 'Mine',
          author: ME,
          createdAt: minutesAgo(30),
        }),
      ],
      { step: 's-current' },
    );

    await agent.click(
      await screen.findByRole('button', {
        name: 'Edit your note on Draft invitations',
      }),
    );
    const field = screen.getByRole('textbox', {
      name: 'Edit note on Draft invitations',
    });
    await agent.clear(field);
    await agent.type(field, 'Revised{Enter}');

    // The block's summary line repeats the latest entry, so a body appears twice.
    expect(await screen.findAllByText('Revised')).not.toHaveLength(0);
  });

  it('ignores a whitespace-only composer entry', async () => {
    const agent = render([], { step: 's-current' });

    const composer = await screen.findByRole('textbox', {
      name: 'Add note to Draft invitations',
    });
    await agent.type(composer, ' '.repeat(3));
    await agent.keyboard('{Enter}');

    expect(composer).toHaveValue(' '.repeat(3));
    expect(screen.queryByText('just now')).not.toBeInTheDocument();
  });

  it('renders a URL in an entry as a link', async () => {
    render(
      [
        note({
          id: 'n-link',
          stepId: 's-current',
          content: 'See https://example.com/details.',
          author: THEM,
          createdAt: minutesAgo(10),
        }),
      ],
      { step: 's-current' },
    );

    expect(
      await screen.findByRole('link', { name: 'https://example.com/details' }),
    ).toHaveAttribute('href', 'https://example.com/details');
  });

  it('surfaces a rejected edit and leaves the stored entry alone', async () => {
    setupOverviewApi(overview);
    const notesApi = setupNotesApi(
      [
        note({
          id: 'n-mine',
          stepId: 's-current',
          content: 'Mine',
          author: ME,
          createdAt: minutesAgo(30),
        }),
      ],
      ME,
    );
    const agent = userEvent.setup();
    renderWithApp(<CardHarness openStep="s-current" />);

    await agent.click(
      await screen.findByRole('button', {
        name: 'Edit your note on Draft invitations',
      }),
    );
    const field = screen.getByRole('textbox', {
      name: 'Edit note on Draft invitations',
    });
    await agent.clear(field);
    notesApi.rejectNextUpdate();
    await agent.type(field, 'Forbidden replacement{Enter}');

    // The global dialog is modal, so the thread is only queryable once closed.
    await agent.click(
      within(
        await screen.findByRole('dialog', { name: 'An error occurred' }),
      ).getByRole('button', { name: 'Ok' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the note author can change this note',
    );
    expect(notesApi.getNotes()[0]?.content).toBe('Mine');
  });

  it('deletes an entry', async () => {
    const agent = render(
      [
        note({
          id: 'n-mine',
          stepId: 's-current',
          content: 'Mine',
          author: ME,
          createdAt: minutesAgo(30),
        }),
      ],
      { step: 's-current' },
    );

    await agent.click(
      await screen.findByRole('button', {
        name: 'Delete your note on Draft invitations',
      }),
    );

    await waitFor(() =>
      expect(screen.queryByText('Mine')).not.toBeInTheDocument(),
    );
  });

  it('posts from the composer on Enter and marks the entry as yours', async () => {
    const agent = render([], { step: 's-current' });

    const composer = await screen.findByRole('textbox', {
      name: 'Add note to Draft invitations',
    });
    await agent.type(composer, 'Called the printer{Enter}');

    expect(await screen.findAllByText('Called the printer')).not.toHaveLength(
      0,
    );
    expect(screen.getByText('You')).toBeVisible();
    expect(screen.getByText('just now')).toBeVisible();
    expect(composer).toHaveValue('');
  });

  it('reads ages in minutes, hours and days', async () => {
    render(
      [
        note({
          id: 'n-1',
          stepId: 's-current',
          content: 'Fresh',
          author: THEM,
          createdAt: minutesAgo(5),
        }),
        note({
          id: 'n-2',
          stepId: 's-current',
          content: 'Earlier',
          author: THEM,
          createdAt: minutesAgo(3 * 60),
        }),
        note({
          id: 'n-3',
          stepId: 's-current',
          content: 'Last week',
          author: THEM,
          createdAt: minutesAgo(4 * 24 * 60),
        }),
      ],
      { step: 's-current' },
    );

    expect(await screen.findByText('5m ago')).toBeVisible();
    expect(screen.getByText('3h ago')).toBeVisible();
    expect(screen.getByText('4d ago')).toBeVisible();
  });

  it('keeps a frozen step append-only while still accepting notes', async () => {
    const agent = render(
      [
        note({
          id: 'n-past',
          stepId: 's-past',
          content: 'Sent the list',
          author: ME,
          createdAt: minutesAgo(120),
        }),
      ],
      { step: 's-past' },
    );

    expect(await screen.findAllByText('Sent the list')).not.toHaveLength(0);
    expect(
      screen.queryByRole('button', {
        name: 'Edit your note on Collect addresses',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Delete your note on Collect addresses',
      }),
    ).not.toBeInTheDocument();

    await agent.type(
      screen.getByRole('textbox', { name: 'Add note to Collect addresses' }),
      'One more thing{Enter}',
    );

    expect(await screen.findAllByText('One more thing')).not.toHaveLength(0);
  });

  it('names the step and counts its entries in the note panel', async () => {
    const agent = render(
      [
        note({
          id: 'n-past',
          stepId: 's-past',
          content: 'Sent the list',
          author: THEM,
          createdAt: minutesAgo(120),
        }),
      ],
      { notes: 's-past' },
    );

    const panel = await screen.findByRole('region', {
      name: 'Notes for Collect addresses',
    });
    expect(await within(panel).findByText('Sent the list')).toBeVisible();
    expect(within(panel).getByText('Collect addresses')).toBeVisible();
    expect(within(panel).getByText('1')).toBeVisible();

    await agent.click(
      within(panel).getByRole('button', {
        name: 'Close notes for Collect addresses',
      }),
    );

    expect(
      screen.queryByRole('region', { name: 'Notes for Collect addresses' }),
    ).not.toBeInTheDocument();
  });
});
