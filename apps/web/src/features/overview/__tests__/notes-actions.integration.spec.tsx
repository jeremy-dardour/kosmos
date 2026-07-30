import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { setupNotesApi, setupOverviewApi } from '@/testing/mock-api';
import { note, step, workstream } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

const NOTES_WORKSTREAM = workstream({
  id: 'w-notes',
  name: 'Invitations',
  currentStepId: 's-current',
  steps: [
    step('Collect addresses', 'done', {
      id: 's-past',
      position: 1,
      outcome: 'done',
    }),
    step('Draft invitations', 'in_progress', {
      id: 's-current',
      position: 2,
    }),
    step('Post invitations', 'not_started', {
      id: 's-future',
      position: 3,
    }),
  ],
});

const NOTES_OVERVIEW = {
  ...defaultOverview,
  workstreams: [NOTES_WORKSTREAM],
};

const CURRENT_AUTHOR = {
  id: STUB_USER.id,
  name: STUB_USER.name,
  avatarUrl: null,
};

function ownNote(overrides: Partial<NoteEntry> = {}) {
  return note({
    id: 'note-own',
    stepId: 's-current',
    content: 'Initial note',
    author: CURRENT_AUTHOR,
    ...overrides,
  });
}

async function openWorkstream(agent: ReturnType<typeof userEvent.setup>) {
  await agent.click(
    await screen.findByRole('button', { name: 'View Invitations' }),
  );
}

describe('per-step note actions', () => {
  it('groups notes by step, renders URLs and keeps other users read-only', async () => {
    setupOverviewApi(NOTES_OVERVIEW);
    setupNotesApi(
      [
        note({
          id: 'other-note',
          stepId: 's-past',
          content: 'See https://example.com/details.',
          author: { id: 'u-other', name: 'Other User', avatarUrl: null },
        }),
      ],
      CURRENT_AUTHOR,
    );
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await openWorkstream(agent);
    await agent.click(
      screen.getByRole('button', {
        name: 'Show notes for Collect addresses',
      }),
    );

    expect(
      screen.getByRole('link', { name: 'https://example.com/details' }),
    ).toHaveAttribute('href', 'https://example.com/details');
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
  });

  it('adds a note to the selected step and rejects whitespace in the UI', async () => {
    setupOverviewApi(NOTES_OVERVIEW);
    setupNotesApi([], CURRENT_AUTHOR);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await openWorkstream(agent);
    await agent.click(
      screen.getByRole('button', { name: 'Add note to Draft invitations' }),
    );
    const input = screen.getByRole('textbox', {
      name: 'New note for Draft invitations',
    });
    const add = screen.getByRole('button', { name: 'Add now' });

    await agent.type(input, ' '.repeat(3));
    expect(add).toBeDisabled();
    await agent.type(input, 'Venue confirmed');
    await agent.click(add);

    expect(await screen.findByText('Venue confirmed')).toBeVisible();
  });

  it('edits an own note and confirms deletion with the styled dialog', async () => {
    setupOverviewApi(NOTES_OVERVIEW);
    setupNotesApi([ownNote()], CURRENT_AUTHOR);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await openWorkstream(agent);
    await agent.click(
      screen.getByRole('button', {
        name: 'Show notes for Draft invitations',
      }),
    );
    await agent.click(
      screen.getByRole('button', {
        name: 'Edit your note on Draft invitations',
      }),
    );
    const editInput = screen.getByRole('textbox', {
      name: 'Edit note on Draft invitations',
    });
    await agent.clear(editInput);
    await agent.type(editInput, 'Updated note');
    await agent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Updated note')).toBeVisible();
    expect(screen.getByText(/edited /)).toBeVisible();

    await agent.click(
      screen.getByRole('button', {
        name: 'Delete your note on Draft invitations',
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete note?' });
    await agent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Updated note')).toBeVisible();

    await agent.click(
      screen.getByRole('button', {
        name: 'Delete your note on Draft invitations',
      }),
    );
    await agent.click(
      within(screen.getByRole('dialog', { name: 'Delete note?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    );

    expect(
      await screen.findByText('No notes for this step yet.'),
    ).toBeVisible();
    expect(screen.queryByText('Updated note')).not.toBeInTheDocument();
  });

  it('shows a stale-authorization error without replacing the note', async () => {
    setupOverviewApi(NOTES_OVERVIEW);
    const notesApi = setupNotesApi([ownNote()], CURRENT_AUTHOR);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await openWorkstream(agent);
    await agent.click(
      screen.getByRole('button', {
        name: 'Show notes for Draft invitations',
      }),
    );
    await agent.click(
      screen.getByRole('button', {
        name: 'Edit your note on Draft invitations',
      }),
    );
    const editInput = screen.getByRole('textbox', {
      name: 'Edit note on Draft invitations',
    });
    await agent.clear(editInput);
    await agent.type(editInput, 'Forbidden replacement');
    notesApi.rejectNextUpdate();
    await agent.click(screen.getByRole('button', { name: 'Save' }));

    await agent.click(
      within(
        await screen.findByRole('dialog', { name: 'An error occurred' }),
      ).getByRole('button', { name: 'Ok' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the note author can change this note',
    );
    expect(notesApi.getNotes()[0]?.content).toBe('Initial note');
  });

  it('keeps a pipeline draft intact through independent note mutations', async () => {
    const overviewApi = setupOverviewApi(NOTES_OVERVIEW);
    setupNotesApi([ownNote()], CURRENT_AUTHOR);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await openWorkstream(agent);
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));
    const editor = screen.getByRole('form', {
      name: 'Edit Invitations pipeline',
    });
    const stepName = within(editor).getByRole('textbox', {
      name: 'Step 2 name',
    });
    await agent.clear(stepName);
    await agent.type(stepName, 'Draft beautiful invitations');

    await agent.click(
      within(editor).getByRole('button', {
        name: 'Add note to Draft beautiful invitations',
      }),
    );
    await agent.type(
      within(editor).getByRole('textbox', {
        name: 'New note for Draft beautiful invitations',
      }),
      'Independent update',
    );
    await agent.click(within(editor).getByRole('button', { name: 'Add now' }));
    expect(stepName).toHaveValue('Draft beautiful invitations');

    await agent.click(within(editor).getByRole('button', { name: 'Add step' }));
    expect(
      within(editor).getByRole('button', {
        name: 'Add note to New step name',
      }),
    ).toBeDisabled();
    await agent.type(
      within(editor).getByRole('textbox', { name: 'New step name' }),
      'After party',
    );

    await agent.click(
      within(editor).getByRole('button', { name: 'Save pipeline' }),
    );

    const saved = overviewApi.getLastPipelineInput();
    expect(saved?.expectedUpdatedAt).toBe(NOTES_WORKSTREAM.updatedAt);
    expect(saved?.steps[0]).toMatchObject({
      id: 's-current',
      name: 'Draft beautiful invitations',
    });
  });
});
