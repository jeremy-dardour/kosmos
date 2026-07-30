import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { setupOverviewApi } from '@/testing/mock-api';
import { checklistItem, step, workstream } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

describe('checklist interactions', () => {
  it('toggles current and future items immediately while past items stay disabled', async () => {
    const overview = {
      ...defaultOverview,
      workstreams: [
        workstream({
          id: 'w-checklists',
          name: 'Invitations',
          currentStepId: 's-current',
          steps: [
            step('Collect addresses', 'done', {
              id: 's-past',
              position: 1,
              outcome: 'done',
              checklistItems: [
                checklistItem('Family addresses', true, { id: 'ci-past' }),
              ],
            }),
            step('Draft invitations', 'in_progress', {
              id: 's-current',
              position: 2,
              checklistItems: [
                checklistItem('Choose wording', false, { id: 'ci-current' }),
              ],
            }),
            step('Post invitations', 'not_started', {
              id: 's-future',
              position: 3,
              checklistItems: [
                checklistItem('Buy stamps', false, { id: 'ci-future' }),
              ],
            }),
          ],
        }),
      ],
    };
    setupOverviewApi(overview);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Invitations' }),
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Family addresses' }),
    ).not.toBeInTheDocument();
    const current = screen.getByRole('checkbox', { name: 'Choose wording' });
    expect(current).toBeEnabled();

    await agent.click(
      screen.getByRole('button', {
        name: 'Show checklist for Collect addresses',
      }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Family addresses' }),
    ).toBeDisabled();

    await agent.click(
      screen.getByRole('button', {
        name: 'Show checklist for Post invitations',
      }),
    );
    const future = screen.getByRole('checkbox', { name: 'Buy stamps' });
    expect(future).toBeEnabled();

    await agent.click(current);
    expect(
      await screen.findByRole('checkbox', { name: 'Choose wording' }),
    ).toBeChecked();
  });

  it('moves the expanded checklist to the new current step after advancing', async () => {
    const overview = {
      ...defaultOverview,
      workstreams: [
        workstream({
          id: 'w-checklists',
          name: 'Invitations',
          currentStepId: 's-current',
          steps: [
            step('Draft invitations', 'in_progress', {
              id: 's-current',
              position: 1,
              checklistItems: [
                checklistItem('Choose wording', false, { id: 'ci-current' }),
              ],
            }),
            step('Post invitations', 'not_started', {
              id: 's-future',
              position: 2,
              checklistItems: [
                checklistItem('Buy stamps', false, { id: 'ci-future' }),
              ],
            }),
          ],
        }),
      ],
    };
    const api = setupOverviewApi(overview);
    api.mockAdvance('w-checklists', () => {
      api.updateWorkstream('w-checklists', (item) => ({
        ...item,
        currentStepId: 's-future',
        steps: [
          step('Draft invitations', 'done', {
            id: 's-current',
            position: 1,
            outcome: 'done',
            checklistItems: [
              checklistItem('Choose wording', false, { id: 'ci-current' }),
            ],
          }),
          step('Post invitations', 'in_progress', {
            id: 's-future',
            position: 2,
            checklistItems: [
              checklistItem('Buy stamps', false, { id: 'ci-future' }),
            ],
          }),
        ],
      }));
      return { id: 'w-checklists', lifecycle: 'active' };
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Invitations' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Choose wording' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Buy stamps' }),
    ).not.toBeInTheDocument();

    await agent.click(
      screen.getByRole('button', { name: 'Advance Invitations' }),
    );

    expect(
      await screen.findByRole('checkbox', { name: 'Buy stamps' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Choose wording' }),
    ).not.toBeInTheDocument();
  });
});

describe('atomic pipeline editor', () => {
  it('freezes past structure and saves all editable-tail changes together', async () => {
    setupOverviewApi(defaultOverview);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Catering' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));

    const editor = screen.getByRole('form', { name: 'Edit Catering pipeline' });
    expect(
      within(editor).getByRole('textbox', { name: 'Step 1 name' }),
    ).toBeDisabled();
    expect(
      within(editor).getByRole('button', { name: 'Remove Request quotes' }),
    ).toBeDisabled();

    const currentName = within(editor).getByRole('textbox', {
      name: 'Step 2 name',
    });
    await agent.clear(currentName);
    await agent.type(currentName, 'Compare quotes');

    await agent.click(
      within(editor).getByRole('button', {
        name: 'Add checklist item to Compare quotes',
      }),
    );
    await agent.type(
      within(editor).getByRole('textbox', { name: 'New checklist item' }),
      'Call favourite',
    );

    await agent.click(within(editor).getByRole('button', { name: 'Add step' }));
    await agent.type(
      within(editor).getByRole('textbox', { name: 'New step name' }),
      'Confirm menu',
    );
    await agent.click(
      within(editor).getByRole('button', { name: 'Save pipeline' }),
    );

    const panel = await screen.findByRole('complementary', {
      name: 'Catering',
    });
    expect(within(panel).getByText('Compare quotes')).toBeVisible();
    expect(within(panel).getByText('Call favourite')).toBeVisible();
    expect(within(panel).getByText('Confirm menu')).toBeVisible();
    expect(screen.queryByRole('form', { name: /Edit Catering/ })).toBeNull();
  });

  it('does not offer editing for a complete workstream', async () => {
    setupOverviewApi(defaultOverview);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Venue' }),
    );

    expect(
      screen.queryByRole('button', { name: 'Edit pipeline' }),
    ).not.toBeInTheDocument();
  });

  it('discards a stale draft and reloads the latest pipeline', async () => {
    const api = setupOverviewApi(defaultOverview);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Catering' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));

    const editor = screen.getByRole('form', { name: 'Edit Catering pipeline' });
    const currentName = within(editor).getByRole('textbox', {
      name: 'Step 2 name',
    });
    await agent.clear(currentName);
    await agent.type(currentName, 'My stale change');

    api.updateWorkstream('w-catering', (workstream) => ({
      ...workstream,
      updatedAt: '2026-07-28T13:00:00.000Z',
      steps: workstream.steps.map((item) =>
        item.id === 's2' ? { ...item, name: 'Server version' } : item,
      ),
    }));
    api.mockPipelineError('w-catering', 409, {
      type: 'https://wedding-planner.dev/problems/pipeline-stale',
      title: 'Conflict',
      detail: 'This pipeline changed after editing began',
      instance: '/api/workstreams/w-catering/pipeline',
    });

    await agent.click(
      within(editor).getByRole('button', { name: 'Save pipeline' }),
    );

    expect(
      await screen.findByText('This pipeline changed after editing began'),
    ).toBeVisible();
    expect(
      screen.queryByRole('form', { name: 'Edit Catering pipeline' }),
    ).not.toBeInTheDocument();
    const refreshedNames = await screen.findAllByText('Server version');
    expect(refreshedNames.length).toBeGreaterThan(0);
  });

  it('allows the second step to move first before a workstream starts', async () => {
    setupOverviewApi({
      ...defaultOverview,
      workstreams: [
        workstream({
          id: 'w-planning',
          name: 'Planning',
          lifecycle: 'not_started',
          steps: [
            step('First task', 'not_started', {
              id: 's-first',
              position: 1,
            }),
            step('Second task', 'not_started', {
              id: 's-second',
              position: 2,
            }),
          ],
        }),
      ],
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Planning' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));
    const editor = screen.getByRole('form', { name: 'Edit Planning pipeline' });

    const moveUp = within(editor).getByRole('button', {
      name: 'Move Second task up',
    });
    expect(moveUp).toBeEnabled();
    await agent.click(moveUp);
    await agent.click(
      within(editor).getByRole('button', { name: 'Save pipeline' }),
    );

    const panel = await screen.findByRole('complementary', {
      name: 'Planning',
    });
    const second = within(panel).getByText('Second task');
    const first = within(panel).getByText('First task');
    expect(
      second.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('submits detail, owner, structure, and checklist edits atomically', async () => {
    const currentChecklist = [
      checklistItem('First item', false, {
        id: 'ci-first',
        position: 1,
      }),
      checklistItem('Remove item', false, {
        id: 'ci-remove',
        position: 2,
      }),
      checklistItem('Last item', false, {
        id: 'ci-last',
        position: 3,
      }),
    ];
    const api = setupOverviewApi({
      ...defaultOverview,
      workstreams: [
        workstream({
          id: 'w-planning',
          name: 'Planning',
          ownerId: null,
          currentStepId: 's-current',
          steps: [
            step('Current task', 'in_progress', {
              id: 's-current',
              position: 1,
              checklistItems: currentChecklist,
            }),
            step('Future one', 'not_started', {
              id: 's-future-one',
              position: 2,
              explicitOwnerId: 'u1',
              effectiveOwnerId: 'u1',
            }),
            step('Future two', 'not_started', {
              id: 's-future-two',
              position: 3,
            }),
            step('Delete me', 'not_started', {
              id: 's-delete',
              position: 4,
            }),
          ],
        }),
      ],
    });
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Planning' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));
    const editor = screen.getByRole('form', { name: 'Edit Planning pipeline' });
    const current = within(editor).getByRole('region', { name: 'Step 1' });
    const futureOne = within(editor).getByRole('region', { name: 'Step 2' });

    await agent.type(
      within(current).getByLabelText('Current task deadline'),
      '2026-09-10',
    );
    await agent.selectOptions(
      within(current).getByRole('combobox', { name: 'Current task owner' }),
      'u1',
    );
    await agent.click(
      within(current).getByRole('checkbox', { name: 'Blocked' }),
    );
    await agent.selectOptions(
      within(futureOne).getByRole('combobox', { name: 'Future one owner' }),
      '',
    );

    const firstItem = within(current).getByRole('textbox', {
      name: 'Checklist item 1 for Current task',
    });
    await agent.clear(firstItem);
    await agent.type(firstItem, 'Renamed item');
    await agent.click(
      within(current).getByRole('checkbox', { name: 'Renamed item done' }),
    );
    await agent.click(
      within(current).getAllByRole('button', {
        name: 'Move checklist item up',
      })[2]!,
    );
    await agent.click(
      within(current).getAllByRole('button', {
        name: 'Remove checklist item',
      })[2]!,
    );

    await agent.click(
      within(editor).getByRole('button', { name: 'Move Future two up' }),
    );
    await agent.click(
      within(editor).getByRole('button', { name: 'Remove Delete me' }),
    );
    await agent.click(
      within(editor).getByRole('button', { name: 'Save pipeline' }),
    );

    expect(api.getLastPipelineInput()).toEqual({
      expectedUpdatedAt: '2026-07-01T00:00:00.000Z',
      steps: [
        {
          id: 's-current',
          name: 'Current task',
          deadline: '2026-09-10',
          ownerId: 'u1',
          blocked: true,
          checklistItems: [
            { id: 'ci-first', name: 'Renamed item', done: true },
            { id: 'ci-last', name: 'Last item', done: false },
          ],
        },
        {
          id: 's-future-two',
          name: 'Future two',
          deadline: null,
          ownerId: null,
          blocked: false,
          checklistItems: [],
        },
        {
          id: 's-future-one',
          name: 'Future one',
          deadline: null,
          ownerId: null,
          blocked: false,
          checklistItems: [],
        },
      ],
    });
  });

  it('discards the whole draft when editing is cancelled', async () => {
    setupOverviewApi(defaultOverview);
    const agent = userEvent.setup();
    renderWithApp(<OverviewPage />);

    await agent.click(
      await screen.findByRole('button', { name: 'View Catering' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));
    const editor = screen.getByRole('form', { name: 'Edit Catering pipeline' });
    const currentName = within(editor).getByRole('textbox', {
      name: 'Step 2 name',
    });
    await agent.clear(currentName);
    await agent.type(currentName, 'Discard this');
    await agent.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByRole('form', { name: 'Edit Catering pipeline' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Discard this')).not.toBeInTheDocument();

    await agent.click(screen.getByRole('button', { name: 'Edit pipeline' }));
    expect(
      within(
        screen.getByRole('form', { name: 'Edit Catering pipeline' }),
      ).getByRole('textbox', { name: 'Step 2 name' }),
    ).toHaveValue('Request quotes');
  });
});
