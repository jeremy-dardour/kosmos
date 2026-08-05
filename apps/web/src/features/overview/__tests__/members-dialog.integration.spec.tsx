import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { setupMembersApi, setupOverviewApi } from '@/testing/mock-api';
import { project } from '@/testing/mock-overview-data';
import { renderAtProjectRoute, renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

import type { Member } from '@/api/hooks/use-project-members';

const TS = '2026-07-01T00:00:00.000Z';

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    email: 'someone@example.com',
    userId: 'u1',
    name: 'Alice Doe',
    avatarUrl: null,
    isOwner: false,
    createdAt: TS,
    ...overrides,
  };
}

const ownerRow = member({
  id: 'm-owner',
  email: 'test@example.com',
  userId: STUB_USER.id,
  name: STUB_USER.name,
  isOwner: true,
});
const joinedRow = member({ id: 'm-joined' });
const pendingRow = member({
  id: 'm-pending',
  email: 'invited@example.com',
  userId: null,
  name: null,
});

async function openMembersDialog(members: Member[]) {
  setupOverviewApi(defaultOverview);
  const membersApi = setupMembersApi(members);
  const agent = userEvent.setup();
  renderAtProjectRoute(<OverviewPage />);
  await screen.findByRole('heading', { name: 'Our Wedding' });

  await agent.click(screen.getByRole('button', { name: 'Members' }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByText('test@example.com');

  return { agent, dialog, membersApi };
}

describe('members dialog — owner view', () => {
  it('renders joined, pending and owner rows with badges and controls', async () => {
    const { dialog } = await openMembersDialog([
      ownerRow,
      joinedRow,
      pendingRow,
    ]);

    expect(within(dialog).getByText('Alice Doe')).toBeVisible();
    expect(within(dialog).getByText('invited@example.com')).toBeVisible();
    expect(within(dialog).getByText('Pending')).toBeVisible();
    expect(within(dialog).getByText('Owner')).toBeVisible();

    expect(within(dialog).getByLabelText('Email to add')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Remove Alice Doe' }),
    ).toBeVisible();
    // The owner's own row is irremovable, and the owner cannot leave.
    expect(
      within(dialog).queryByRole('button', {
        name: `Remove ${STUB_USER.name}`,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Leave project' }),
    ).not.toBeInTheDocument();
  });

  it('adds a member by email and shows the pending row', async () => {
    const { agent, dialog } = await openMembersDialog([ownerRow]);

    await agent.type(
      within(dialog).getByLabelText('Email to add'),
      'new-helper@example.com',
    );
    await agent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(
      await within(dialog).findByText('new-helper@example.com'),
    ).toBeVisible();
  });

  it.each([
    ['duplicate-member', 'This email is already a member.'],
    ['member-limit-reached', 'This project has reached its member limit.'],
  ])('shows the inline message for %s', async (slug, message) => {
    const { agent, dialog, membersApi } = await openMembersDialog([ownerRow]);
    membersApi.mockAddMemberError(409, {
      type: `https://kosmos.dev/errors/${slug}`,
      title: 'Conflict',
      status: 409,
      detail: 'Rejected',
      instance: '/api/projects/p1/members',
    });

    await agent.type(
      within(dialog).getByLabelText('Email to add'),
      'someone@example.com',
    );
    await agent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await within(dialog).findByText(message)).toBeVisible();
  });

  it('removes a member after confirmation', async () => {
    const { agent, dialog } = await openMembersDialog([ownerRow, joinedRow]);

    await agent.click(
      within(dialog).getByRole('button', { name: 'Remove Alice Doe' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(within(dialog).queryByText('Alice Doe')).not.toBeInTheDocument(),
    );
  });

  it('closes when the members query 404s (access lost)', async () => {
    const { agent, dialog, membersApi } = await openMembersDialog([ownerRow]);
    membersApi.mockMembersGone();

    // Any mutation refetches the list; the 404 closes the dialog.
    await agent.type(
      within(dialog).getByLabelText('Email to add'),
      'new-helper@example.com',
    );
    await agent.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});

describe('members dialog — non-owner view', () => {
  const sharedOverview = {
    ...defaultOverview,
    project: project({ ownerId: 'u1' }),
  };
  const sharedMembers = [
    member({ id: 'm-other-owner', isOwner: true }),
    member({
      id: 'm-me',
      email: 'test@example.com',
      userId: STUB_USER.id,
      name: STUB_USER.name,
    }),
  ];

  async function openAsMember() {
    setupOverviewApi(sharedOverview);
    setupMembersApi(sharedMembers);
    const agent = userEvent.setup();
    renderWithApp(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/" element={<p>Projects home</p>} />
          <Route path="/projects/:projectId" element={<OverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Our Wedding' });

    await agent.click(screen.getByRole('button', { name: 'Members' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Alice Doe');

    return { agent, dialog };
  }

  it('hides owner-gated controls and offers leave on the own row', async () => {
    const { dialog } = await openAsMember();

    expect(
      within(dialog).queryByLabelText('Email to add'),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /^Remove/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Leave project' }),
    ).toBeVisible();
  });

  it('leaves the project after confirmation and lands on the project list', async () => {
    const { agent, dialog } = await openAsMember();

    await agent.click(
      within(dialog).getByRole('button', { name: 'Leave project' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Leave' }));

    expect(await screen.findByText('Projects home')).toBeVisible();
  });
});
