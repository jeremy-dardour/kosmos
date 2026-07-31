import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { useCreateChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { useCreateStep } from '@/api/hooks/use-create-step';
import { useDeleteChecklistItem } from '@/api/hooks/use-delete-checklist-item';
import { useDeleteStep } from '@/api/hooks/use-delete-step';
import { overviewQueryOptions } from '@/api/hooks/use-overview';
import { useReorderSteps } from '@/api/hooks/use-reorder-steps';
import { useReorderWorkstreams } from '@/api/hooks/use-reorder-workstreams';
import { useUpdateChecklistItem } from '@/api/hooks/use-update-checklist-item';
import { useUpdateStep } from '@/api/hooks/use-update-step';
import {
  useCreateNote,
  useDeleteNote,
  useWorkstreamNotes,
} from '@/api/hooks/use-workstream-notes';
import { formatToApiError } from '@/errors/format-error';
import { setupNotesApi, setupOverviewApi } from '@/testing/mock-api';
import {
  checklistItem,
  group,
  note,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { createStubAuth, STUB_USER } from '@/testing/stub-auth';

import type { Overview } from '@/api/hooks/use-overview';
import type { ReactNode } from 'react';

const PROJECT_ID = 'p1';

function buildOverview(): Overview {
  return {
    project: project(),
    groups: [group()],
    users: [user()],
    workstreams: [
      workstream({
        id: 'w1',
        position: 0,
        currentStepId: 'current',
        steps: [
          step('done', 'done', {
            id: 'past',
            position: 1,
            outcome: 'done',
            outcomeAt: '2026-07-01T00:00:00.000Z',
          }),
          step('current', 'in_progress', { id: 'current', position: 2 }),
          step('later', 'not_started', {
            id: 'later',
            position: 3,
            noteCount: 1,
            checklistItems: [
              checklistItem('taste', false, { id: 'item-1', position: 1 }),
            ],
          }),
        ],
      }),
      workstream({ id: 'w2', position: 1, steps: [] }),
    ],
  };
}

function setup() {
  const overview = buildOverview();
  setApiClient(configureApiClient(createStubAuth().auth));
  setupOverviewApi(overview);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(overviewQueryOptions(PROJECT_ID).queryKey, overview);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const cachedWorkstream = (id: string) =>
    queryClient
      .getQueryData<Overview>(overviewQueryOptions(PROJECT_ID).queryKey)!
      .workstreams.find((item) => item.id === id)!;

  return { queryClient, wrapper, cachedWorkstream };
}

beforeEach(() => {
  setApiClient(configureApiClient(createStubAuth().auth));
});

describe('step mutations', () => {
  it('patches the workstream a created step comes back in', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useCreateStep(PROJECT_ID), { wrapper });

    result.current.mutate({
      params: { path: { id: 'w1' } },
      body: { name: 'Sign contract', position: 3 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').steps.map((item) => item.name)).toEqual([
      'done',
      'current',
      'Sign contract',
      'later',
    ]);
  });

  it('patches a renamed step without touching its siblings', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useUpdateStep(PROJECT_ID), { wrapper });

    result.current.mutate({
      params: { path: { id: 'later' } },
      body: { name: 'Later, renamed' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').steps.map((item) => item.name)).toEqual([
      'done',
      'current',
      'Later, renamed',
    ]);
  });

  it('rejects editing a frozen past step', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useUpdateStep(PROJECT_ID), { wrapper });

    result.current.mutate({
      params: { path: { id: 'past' } },
      body: { name: 'Rewriting history' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(formatToApiError(result.current.error)?.problemType).toMatch(
      /\/step-frozen$/,
    );
    expect(cachedWorkstream('w1').steps[0]!.name).toBe('done');
  });

  it('patches the renumbered workstream a deleted step comes back in', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useDeleteStep(PROJECT_ID), { wrapper });

    result.current.mutate({ params: { path: { id: 'later' } } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      cachedWorkstream('w1').steps.map((item) => [item.id, item.position]),
    ).toEqual([
      ['past', 1],
      ['current', 2],
    ]);
  });

  it('reports an order mismatch and leaves the cache alone', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useReorderSteps(PROJECT_ID), {
      wrapper,
    });

    result.current.mutate({
      params: { path: { id: 'w1' } },
      body: { ids: ['later', 'current'] },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(formatToApiError(result.current.error)?.problemType).toMatch(
      /\/order-mismatch$/,
    );
    expect(cachedWorkstream('w1').steps.map((item) => item.id)).toEqual([
      'past',
      'current',
      'later',
    ]);
  });
});

describe('checklist item mutations', () => {
  it('patches an added, renamed and removed item', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(
      () => ({
        create: useCreateChecklistItem(PROJECT_ID),
        update: useUpdateChecklistItem(PROJECT_ID),
        remove: useDeleteChecklistItem(PROJECT_ID),
      }),
      { wrapper },
    );

    result.current.create.mutate({
      params: { path: { stepId: 'later' } },
      body: { name: 'Call venue' },
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    const created = result.current.create.data!;
    expect(
      cachedWorkstream('w1').steps[2]!.checklistItems.map((item) => item.name),
    ).toEqual(['taste', 'Call venue']);

    result.current.update.mutate({
      params: { path: { id: created.id } },
      body: { name: 'Call venue back', done: true },
    });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').steps[2]!.checklistItems[1]).toMatchObject({
      name: 'Call venue back',
      done: true,
    });

    result.current.remove.mutate({ params: { path: { id: 'item-1' } } });
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(
      cachedWorkstream('w1').steps[2]!.checklistItems.map((item) => item.id),
    ).toEqual([created.id]);
  });
});

describe('workstream ordering', () => {
  it('patches the reordered scope', async () => {
    const { wrapper, cachedWorkstream } = setup();
    const { result } = renderHook(() => useReorderWorkstreams(PROJECT_ID), {
      wrapper,
    });

    result.current.mutate({
      params: { path: { projectId: PROJECT_ID } },
      body: { groupId: null, ids: ['w2', 'w1'] },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').position).toBe(1);
    expect(cachedWorkstream('w2').position).toBe(0);
  });
});

describe('note mutations', () => {
  it('patches the note count and refreshes the thread', async () => {
    const { wrapper, cachedWorkstream } = setup();
    setupNotesApi([note({ id: 'n1', stepId: 'later' })], {
      id: STUB_USER.id,
      name: STUB_USER.name,
      avatarUrl: null,
    });

    const { result } = renderHook(
      () => ({
        notes: useWorkstreamNotes('w1'),
        create: useCreateNote('w1', PROJECT_ID),
        remove: useDeleteNote('w1', PROJECT_ID),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    result.current.create.mutate({
      params: { path: { stepId: 'later' } },
      body: { content: 'Called the venue' },
    });
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').steps[2]!.noteCount).toBe(2);
    await waitFor(() => expect(result.current.notes.data).toHaveLength(2));

    result.current.remove.mutate({ params: { path: { id: 'n1' } } });
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(cachedWorkstream('w1').steps[2]!.noteCount).toBe(1);
    await waitFor(() => expect(result.current.notes.data).toHaveLength(1));
  });
});
