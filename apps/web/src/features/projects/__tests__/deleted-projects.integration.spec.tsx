import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ProjectListPage } from '@/features/projects/project-list-page';
import { server } from '@/testing/mock-api';
import { project } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { Project } from '@/api/hooks/use-overview';

const BASE = 'http://localhost:3000';
const DELETED_AT = '2026-07-15T09:00:00.000Z';

function conflictBody(slug: string) {
  return {
    type: `https://kosmos.dev/errors/${slug}`,
    title: 'Conflict',
    status: 409,
    detail: 'Rejected',
    instance: '/api/projects',
  };
}

/**
 * Stateful list + restore handlers: restore clears `deletedAt` unless the
 * test marks that id as capped (409 project-limit-reached).
 */
function setupDeletedProjects(initial: Project[], cappedIds: string[] = []) {
  let projects = initial;

  server.use(
    http.get(`${BASE}/api/projects`, () => HttpResponse.json(projects)),
    http.post(`${BASE}/api/projects/:id/restore`, ({ params }) => {
      if (cappedIds.includes(String(params.id))) {
        return HttpResponse.json(conflictBody('project-limit-reached'), {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        });
      }
      projects = projects.map((entry) =>
        entry.id === params.id ? { ...entry, deletedAt: null } : entry,
      );
      const restored = projects.find((entry) => entry.id === params.id);
      return HttpResponse.json(restored);
    }),
  );
}

function renderList() {
  return renderWithApp(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  );
}

describe('project list — deleted section', () => {
  const live = project({ id: 'p-live', name: 'Live One' });
  const deleted = project({
    id: 'p-gone',
    name: 'Gone One',
    deletedAt: DELETED_AT,
  });

  it('collapses deleted projects into a section with a date and no navigation', async () => {
    setupDeletedProjects([live, deleted]);
    const agent = userEvent.setup();
    renderList();

    await screen.findByText('Live One');
    expect(screen.queryByText('Gone One')).not.toBeInTheDocument();

    await agent.click(screen.getByRole('button', { name: /Deleted \(1\)/ }));

    expect(screen.getByText('Gone One')).toBeVisible();
    expect(screen.getByText('Deleted 7/15/2026')).toBeVisible();
    // Not openable: the deleted card is not a link.
    expect(
      screen.queryByRole('link', { name: /Gone One/ }),
    ).not.toBeInTheDocument();
  });

  it('restores a project back into the active list', async () => {
    setupDeletedProjects([live, deleted]);
    const agent = userEvent.setup();
    renderList();

    await screen.findByText('Live One');
    await agent.click(screen.getByRole('button', { name: /Deleted \(1\)/ }));
    await agent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Gone One/ })).toBeVisible(),
    );
    expect(
      screen.queryByRole('button', { name: /Deleted/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the cap error only on the row whose restore failed', async () => {
    const otherDeleted = project({
      id: 'p-gone-2',
      name: 'Gone Two',
      deletedAt: DELETED_AT,
    });
    setupDeletedProjects([live, deleted, otherDeleted], ['p-gone']);
    const agent = userEvent.setup();
    renderList();

    await screen.findByText('Live One');
    await agent.click(screen.getByRole('button', { name: /Deleted \(2\)/ }));

    const [firstRestore] = screen.getAllByRole('button', { name: 'Restore' });
    await agent.click(firstRestore!);

    const messages = await screen.findAllByText(
      "You've reached the limit of projects you can own.",
    );
    expect(messages).toHaveLength(1);
  });
});
