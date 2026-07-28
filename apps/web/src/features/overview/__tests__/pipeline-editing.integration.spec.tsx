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
      screen.getByRole('checkbox', { name: 'Family addresses' }),
    ).toBeDisabled();
    const current = screen.getByRole('checkbox', { name: 'Choose wording' });
    const future = screen.getByRole('checkbox', { name: 'Buy stamps' });
    expect(current).toBeEnabled();
    expect(future).toBeEnabled();

    await agent.click(current);
    expect(
      await screen.findByRole('checkbox', { name: 'Choose wording' }),
    ).toBeChecked();
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
});
