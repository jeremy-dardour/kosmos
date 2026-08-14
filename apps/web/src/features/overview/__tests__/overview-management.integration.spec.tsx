import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { setupOverviewApi } from '@/testing/mock-api';
import { renderAtProjectRoute } from '@/testing/render-with-app';

async function openManagementReady() {
  setupOverviewApi(defaultOverview);
  const agent = userEvent.setup();
  renderAtProjectRoute(<OverviewPage />);
  await screen.findByRole('heading', { name: 'Our Wedding' });
  return agent;
}

describe('workstream management', () => {
  it('creates an ungrouped workstream and shows its card', async () => {
    const agent = await openManagementReady();

    await agent.click(screen.getByRole('button', { name: 'New Workstream' }));
    const dialog = await screen.findByRole('dialog');
    await agent.type(within(dialog).getByLabelText('Name'), 'Music');
    await agent.click(within(dialog).getByLabelText('Icon'));
    await agent.type(
      await screen.findByRole('textbox', { name: 'Custom icon' }),
      '🎶{Enter}',
    );
    await agent.click(within(dialog).getByRole('button', { name: 'Create' }));

    const ungrouped = await screen.findByRole('region', { name: 'Ungrouped' });
    expect(within(ungrouped).getByText('Music')).toBeVisible();
  });

  it('creates a workstream under the selected group', async () => {
    const agent = await openManagementReady();

    await agent.click(screen.getByRole('button', { name: 'New Workstream' }));
    const dialog = await screen.findByRole('dialog');
    await agent.type(within(dialog).getByLabelText('Name'), 'Cake');
    await agent.click(within(dialog).getByLabelText('Icon'));
    await agent.click(await screen.findByRole('button', { name: '🎂' }));
    await agent.selectOptions(within(dialog).getByLabelText('Group'), 'g1');
    await agent.click(within(dialog).getByRole('button', { name: 'Create' }));

    const region = await screen.findByRole('region', {
      name: 'Venue & Catering',
    });
    expect(within(region).getByText('Cake')).toBeVisible();
  });
});

describe('group management', () => {
  it('creates a group', async () => {
    const agent = await openManagementReady();

    await agent.click(screen.getByRole('button', { name: 'Manage groups' }));
    const dialog = await screen.findByRole('dialog');
    await agent.type(within(dialog).getByLabelText('New group name'), 'Decor');
    await agent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await within(dialog).findByLabelText('Decor name')).toBeVisible();
  });

  it('deletes a group and ungroups its workstreams', async () => {
    const agent = await openManagementReady();

    await agent.click(screen.getByRole('button', { name: 'Manage groups' }));
    const dialog = await screen.findByRole('dialog');
    await agent.click(
      within(dialog).getByRole('button', {
        name: 'Delete Venue & Catering',
      }),
    );
    // Confirm sits in its own dialog; the manager stays open (modal), so close
    // it before asserting on the overview behind it.
    await agent.click(screen.getByRole('button', { name: 'Delete' }));
    await agent.click(within(dialog).getByRole('button', { name: 'Done' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Venue & Catering' }),
      ).not.toBeInTheDocument(),
    );
    const ungrouped = screen.getByRole('region', { name: 'Ungrouped' });
    expect(within(ungrouped).getByText('Catering')).toBeVisible();
    expect(within(ungrouped).getByText('Flowers')).toBeVisible();
  });
});

describe('project settings', () => {
  it('edits the project name and event date, updating the countdown', async () => {
    const agent = await openManagementReady();

    // The only element rendering these phrases is the header EventCountdown.
    const countdown = () =>
      screen.getByText(/to go|days ago|^Today$|^Tomorrow$|^Yesterday$/);
    const before = countdown().textContent;

    await agent.click(screen.getByRole('button', { name: 'Project settings' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Project name');
    await agent.clear(name);
    await agent.type(name, 'Our Big Day');
    // Date inputs are awkward to drive by typing; set the value directly.
    fireEvent.change(within(dialog).getByLabelText('Event date'), {
      target: { value: '2028-11-20' },
    });
    await agent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { name: 'Our Big Day' }),
    ).toBeVisible();
    // A different event date must yield a different countdown label.
    await waitFor(() => expect(countdown().textContent).not.toBe(before));
  });
});
