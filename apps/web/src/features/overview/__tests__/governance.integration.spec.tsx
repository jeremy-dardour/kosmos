import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { OverviewPage } from '@/features/overview/overview-page';
import { server, setupOverviewApi } from '@/testing/mock-api';
import { project } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

import type { Member } from '@/api/hooks/use-project-members';

const BASE = 'http://localhost:3000';
const TS = '2026-07-01T00:00:00.000Z';

function renderOverviewWithHome() {
  return renderWithApp(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/" element={<p>Projects home</p>} />
        <Route path="/projects/:projectId" element={<OverviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setupTransferableProject() {
  // Mutable ownership: the overview and members handlers derive from it,
  // so the invalidation-driven refetch after transfer re-gates the dialog.
  let ownerId = STUB_USER.id;

  const rows = [
    {
      id: 'm-me',
      email: 'test@example.com',
      userId: STUB_USER.id,
      name: STUB_USER.name,
    },
    {
      id: 'm-alice',
      email: 'alice@example.com',
      userId: 'u1',
      name: 'Alice Doe',
    },
    { id: 'm-pending', email: 'invited@example.com', userId: null, name: null },
  ];

  setupOverviewApi(defaultOverview);
  server.use(
    http.get(`${BASE}/api/projects/p1/overview`, () =>
      HttpResponse.json({ ...defaultOverview, project: project({ ownerId }) }),
    ),
    http.get(`${BASE}/api/projects/p1/members`, () =>
      HttpResponse.json(
        rows.map(
          (row): Member => ({
            ...row,
            avatarUrl: null,
            isOwner: row.userId === ownerId,
            createdAt: TS,
          }),
        ),
      ),
    ),
    http.post(`${BASE}/api/projects/p1/transfer-ownership`, () => {
      ownerId = 'u1';
      return HttpResponse.json(project({ ownerId }));
    }),
  );
}

describe('ownership transfer', () => {
  it('offers Make owner only on joined non-owner rows and re-gates after transfer', async () => {
    setupTransferableProject();
    const agent = userEvent.setup();
    renderOverviewWithHome();
    await screen.findByRole('heading', { name: 'Our Wedding' });

    await agent.click(screen.getByRole('button', { name: 'Members' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Alice Doe');

    expect(
      within(dialog).getByRole('button', { name: 'Make Alice Doe owner' }),
    ).toBeVisible();
    // Pending rows cannot take ownership.
    expect(
      within(dialog).queryByRole('button', {
        name: 'Make invited@example.com owner',
      }),
    ).not.toBeInTheDocument();

    await agent.click(
      within(dialog).getByRole('button', { name: 'Make Alice Doe owner' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Make owner' }));

    // Ownership moved: owner-gated controls disappear, leave appears.
    await waitFor(() =>
      expect(
        within(dialog).queryByLabelText('Email to add'),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Leave project' }),
    ).toBeVisible();
  });
});

describe('project settings danger zone', () => {
  it('lets the owner delete after confirmation and lands on the project list', async () => {
    setupOverviewApi(defaultOverview);
    server.use(
      http.delete(
        `${BASE}/api/projects/p1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const agent = userEvent.setup();
    renderOverviewWithHome();
    await screen.findByRole('heading', { name: 'Our Wedding' });

    await agent.click(screen.getByRole('button', { name: 'Project settings' }));
    const dialog = await screen.findByRole('dialog');
    await agent.click(
      within(dialog).getByRole('button', { name: 'Delete project' }),
    );
    await agent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Projects home')).toBeVisible();
  });

  it('hides the danger zone from non-owners while settings stay editable', async () => {
    setupOverviewApi({
      ...defaultOverview,
      project: project({ ownerId: 'u1' }),
    });
    const agent = userEvent.setup();
    renderOverviewWithHome();
    await screen.findByRole('heading', { name: 'Our Wedding' });

    await agent.click(screen.getByRole('button', { name: 'Project settings' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText('Project name')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeVisible();
    expect(
      within(dialog).queryByRole('button', { name: 'Delete project' }),
    ).not.toBeInTheDocument();
  });
});
