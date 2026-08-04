import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ProjectListPage } from '@/features/projects/project-list-page';
import { setupProjectsApi } from '@/testing/mock-api';
import { project } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';
import { STUB_USER } from '@/testing/stub-auth';

function renderPage() {
  return renderWithApp(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );
}

function ProjectProbe() {
  const { projectId } = useParams();
  return <div>Project probe: {projectId}</div>;
}

function renderPageWithRoutes() {
  return renderWithApp(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('project list page', () => {
  it('renders each project as a link to its overview', async () => {
    setupProjectsApi([
      project({ id: 'p1', name: 'Our Wedding' }),
      project({ id: 'p2', name: 'Alex & Sam', eventDate: null }),
    ]);
    renderPage();

    const first = await screen.findByRole('link', { name: /Our Wedding/ });
    expect(first).toHaveAttribute('href', '/projects/p1');

    const second = screen.getByRole('link', { name: /Alex & Sam/ });
    expect(second).toHaveAttribute('href', '/projects/p2');
  });

  it('shows the empty state when there are no projects', async () => {
    setupProjectsApi([]);
    renderPage();

    expect(await screen.findByText('No projects yet')).toBeVisible();
  });

  it('marks projects owned by the signed-in user, and only those', async () => {
    setupProjectsApi([
      project({ id: 'p1', name: 'Our Wedding', ownerId: STUB_USER.id }),
      project({ id: 'p2', name: 'Shared Trip', ownerId: 'other-user' }),
    ]);
    renderPage();

    const ownedLink = await screen.findByRole('link', { name: /Our Wedding/ });
    expect(within(ownedLink).getByText('Owner')).toBeVisible();

    const sharedLink = screen.getByRole('link', { name: /Shared Trip/ });
    expect(within(sharedLink).queryByText('Owner')).not.toBeInTheDocument();
  });

  it('does not render soft-deleted projects', async () => {
    setupProjectsApi([
      project({ id: 'p1', name: 'Our Wedding' }),
      project({
        id: 'p2',
        name: 'Old Plan',
        deletedAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
    renderPage();

    await screen.findByRole('link', { name: /Our Wedding/ });
    expect(screen.queryByText('Old Plan')).not.toBeInTheDocument();
  });

  it('creates a project from the empty state and navigates to its overview', async () => {
    setupProjectsApi([]);
    const agent = userEvent.setup();
    renderPageWithRoutes();

    await agent.click(
      await screen.findByRole('button', { name: 'Create your first project' }),
    );
    const dialog = await screen.findByRole('dialog');
    await agent.type(within(dialog).getByLabelText('Name'), 'New Adventure');
    await agent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Project probe: mock-project-1'),
    ).toBeVisible();
  });

  it('shows an inline message and keeps the dialog open when the owned-project limit is reached', async () => {
    const projectsApi = setupProjectsApi([
      project({ id: 'p1', name: 'Our Wedding' }),
    ]);
    projectsApi.mockCreateProjectError(409, {
      type: 'https://kosmos.dev/errors/project-limit-reached',
      title: 'Conflict',
      status: 409,
      detail: 'The owned-project limit is reached',
      instance: '/api/projects',
    });
    const agent = userEvent.setup();
    renderPageWithRoutes();

    await agent.click(
      await screen.findByRole('button', { name: 'New project' }),
    );
    const dialog = await screen.findByRole('dialog');
    await agent.type(within(dialog).getByLabelText('Name'), 'One Too Many');
    await agent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(
      await within(dialog).findByText(
        "You've reached the limit of projects you can own.",
      ),
    ).toBeVisible();
    expect(dialog).toBeVisible();
  });
});
